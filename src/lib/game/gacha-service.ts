// Gacha service — core pull logic, drop rate calculation, pity mechanics

import { getDrizzleClient } from "@/storage/database/drizzle-client";
import { crateConfigs, pullHistory, playerStreaks, guestSessions } from "@/storage/database/shared/schema";
import { eq, desc, and, sql, count, lt } from "drizzle-orm";
import type { GachaQuality } from "./gacha-constants";
import {
  ITEM_NAMES,
  VALUE_RANGES,
  AFFIX_POOL,
  POWERFUL_AFFIX_POOL,
  PITY_THRESHOLD,
  GUEST_DAILY_LIMIT,
  PLAYER_DAILY_LIMIT,
  seededRandom,
} from "./gacha-constants";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PullResult {
  item: {
    id: string;
    name: string;
    quality: GachaQuality;
    value: number;
    affixes: Array<{ type: string; description: string }>;
  };
  ticketsRemaining: number;
  pityProgress: { current: number; target: number };
  isPityTriggered: boolean;
}

export interface CrateInfo {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  dropRates: Record<GachaQuality, number>;
  ticketCost: number;
  starRating: number;
}

export interface CollectionPage {
  items: Array<{
    id: string;
    itemName: string;
    quality: GachaQuality;
    value: number;
    createdAt: string;
  }>;
  total: number;
  page: number;
  hasMore: boolean;
}

export interface PlayerStats {
  totalPulls: number;
  pullsToday: number;
  dailyLimit: number;
  streak: { current: number; longest: number; lastPullDate: string | null };
  pityProgress: { current: number; target: number };
  qualityBreakdown: Record<GachaQuality, number>;
  recentPulls: Array<{ name: string; quality: GachaQuality; createdAt: string }>;
}

// ──────────────────────────────────────────────
// Core pull logic (pure, testable)
// ──────────────────────────────────────────────

/**
 * Determine drop quality from crate drop rates.
 * Uses seeded RNG for deterministic replay during guest sync.
 */
export function rollQuality(
  dropRates: Record<GachaQuality, number>,
  rng: () => number = Math.random,
  forcePity: boolean = false
): GachaQuality {
  if (forcePity) return "red";

  const roll = rng();
  let cumulative = 0;
  const qualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];

  for (const q of qualities) {
    cumulative += dropRates[q];
    if (roll < cumulative) return q;
  }
  return "white"; // fallback
}

/**
 * Generate a random item for the given quality tier.
 */
export function generateItem(
  quality: GachaQuality,
  rng: () => number = Math.random
): { name: string; value: number; affixes: Array<{ type: string; description: string }> } {
  const names = ITEM_NAMES[quality];
  const name = names[Math.floor(rng() * names.length)];

  const [minVal, maxVal] = VALUE_RANGES[quality];
  const value = Math.floor(minVal + rng() * (maxVal - minVal));

  // Affixes: quality determines count
  const affixCount = quality === "white" ? 1 : quality === "blue" ? 1 : quality === "purple" ? 2 : quality === "red" ? 3 : 4;
  const affixes: Array<{ type: string; description: string }> = [];

  for (let i = 0; i < affixCount; i++) {
    if (i === 0 && (quality === "red" || quality === "gold")) {
      // First affix for red/gold is from powerful pool
      const pool = POWERFUL_AFFIX_POOL;
      const affix = pool[Math.floor(rng() * pool.length)];
      affixes.push({ type: affix.type, description: affix.desc() });
    } else {
      const affix = AFFIX_POOL[Math.floor(rng() * AFFIX_POOL.length)];
      const val = Math.floor(affix.min + rng() * (affix.max - affix.min));
      affixes.push({ type: affix.type, description: affix.desc(val) });
    }
  }

  return { name, value, affixes };
}

// ──────────────────────────────────────────────
// Database operations
// ──────────────────────────────────────────────

/**
 * Execute a gacha pull as a single atomic operation.
 * 1. Check idempotency (return existing if duplicate)
 * 2. Atomic pity increment via UPDATE...RETURNING
 * 3. Roll quality (force red if pity triggered)
 * 4. Insert pull_history record
 * 5. Return result
 */
export async function executePull(params: {
  playerId: string;
  crateId: string;
  idempotencyKey: string;
  isGuest: boolean;
}): Promise<PullResult> {
  const { playerId, crateId, idempotencyKey, isGuest } = params;
  const db = getDrizzleClient();

  // 1. Check idempotency
  const existing = await db
    .select()
    .from(pullHistory)
    .where(
      and(
        eq(pullHistory.playerId, playerId),
        eq(pullHistory.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const streakData = await getPlayerStreak(playerId, isGuest);
    return {
      item: {
        id: row.id,
        name: row.itemName,
        quality: row.quality as GachaQuality,
        value: row.value,
        affixes: (row.affixes as Array<{ type: string; description: string }>) || [],
      },
      ticketsRemaining: getRemainingTickets(streakData, isGuest),
      pityProgress: { current: streakData?.pityCount ?? 0, target: PITY_THRESHOLD },
      isPityTriggered: false,
    };
  }

  // 2. Get crate config
  const crates = await db
    .select()
    .from(crateConfigs)
    .where(and(eq(crateConfigs.id, crateId), eq(crateConfigs.active, true)))
    .limit(1);

  if (crates.length === 0) {
    throw new Error("crate_not_found");
  }

  const crate = crates[0];
  const dropRates = crate.dropRates as Record<GachaQuality, number>;

  // 3. Atomic pity increment
  const isToday = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  };

  let streakData = await getPlayerStreak(playerId, isGuest);

  // Reset pullsToday if new day
  if (!isToday(streakData?.lastPullDate ?? null) && streakData) {
    await db
      .update(playerStreaks)
      .set({ pullsToday: 0, failStreak: 0 })
      .where(eq(playerStreaks.playerId, playerId));
    if (streakData) streakData.pullsToday = 0;
  }

  // Check ticket limit
  const dailyLimit = isGuest ? GUEST_DAILY_LIMIT : PLAYER_DAILY_LIMIT;
  if (streakData && streakData.pullsToday >= dailyLimit) {
    throw new Error("no_tickets");
  }

  // 4. Atomic pity update
  const pityResult = await db.execute(sql`
    UPDATE player_streaks
    SET
      pity_count = CASE WHEN pity_count >= ${PITY_THRESHOLD - 1} THEN 0 ELSE pity_count + 1 END,
      pulls_today = pulls_today + 1,
      total_pulls = total_pulls + 1,
      last_pull_date = NOW(),
      updated_at = NOW()
    WHERE player_id = ${playerId}
    RETURNING pity_count, (pity_count >= ${PITY_THRESHOLD - 1}) as pity_triggered
  `);

  const row = pityResult.rows?.[0] as any;
  const pityCount = Number(row?.pity_count ?? 0);
  const pityTriggered = Boolean(row?.pity_triggered);

  // 5. Roll quality and generate item
  const rng = seededRandom(idempotencyKey);
  const quality = rollQuality(dropRates, rng, pityTriggered);
  const { name, value, affixes } = generateItem(quality, rng);

  // If natural red/gold drop, reset pity
  if ((quality === "red" || quality === "gold") && !pityTriggered) {
    await db.execute(sql`
      UPDATE player_streaks SET pity_count = 0 WHERE player_id = ${playerId}
    `);
  }

  // Update streak
  if (quality === "red" || quality === "gold") {
    await db.execute(sql`
      UPDATE player_streaks SET fail_streak = 0 WHERE player_id = ${playerId}
    `);
  } else {
    await db.execute(sql`
      UPDATE player_streaks SET fail_streak = fail_streak + 1 WHERE player_id = ${playerId}
    `);
  }

  // 6. Insert pull history
  const inserted = await db
    .insert(pullHistory)
    .values({
      playerId,
      crateId,
      itemName: name,
      quality,
      value,
      affixes,
      idempotencyKey,
    })
    .returning();

  const item = inserted[0];
  const newPity = (quality === "red" || quality === "gold") && !pityTriggered ? 0 : pityCount;
  const ticketsUsed = (streakData?.pullsToday ?? 0) + 1;

  return {
    item: {
      id: item.id,
      name: item.itemName,
      quality: item.quality as GachaQuality,
      value: item.value,
      affixes: (item.affixes as Array<{ type: string; description: string }>) || [],
    },
    ticketsRemaining: Math.max(0, dailyLimit - ticketsUsed),
    pityProgress: { current: newPity, target: PITY_THRESHOLD },
    isPityTriggered: pityTriggered,
  };
}

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

async function getPlayerStreak(
  playerId: string,
  isGuest: boolean
): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastPullDate: string | null;
  failStreak: number;
  pityCount: number;
  totalPulls: number;
  pullsToday: number;
  dailyLimit: number;
} | null> {
  const db = getDrizzleClient();
  const rows = await db
    .select()
    .from(playerStreaks)
    .where(eq(playerStreaks.playerId, playerId))
    .limit(1);
  return (rows[0] as any) ?? null;
}

function getRemainingTickets(
  streakData: any,
  isGuest: boolean
): number {
  const dailyLimit = isGuest ? GUEST_DAILY_LIMIT : PLAYER_DAILY_LIMIT;
  return Math.max(0, dailyLimit - (streakData?.pullsToday ?? 0));
}

/**
 * Initialize player_streaks row if it doesn't exist.
 */
export async function ensurePlayerStreak(
  playerId: string,
  dailyLimit: number = PLAYER_DAILY_LIMIT
): Promise<void> {
  const db = getDrizzleClient();
  await db.insert(playerStreaks).values({
    playerId,
    dailyLimit,
  }).onConflictDoNothing();
}

/**
 * Create a guest session.
 */
export async function createGuestSession(): Promise<{
  sessionId: string;
  ticketsRemaining: number;
  dailyLimit: number;
}> {
  const db = getDrizzleClient();
  const inserted = await db
    .insert(guestSessions)
    .values({ dailyLimit: GUEST_DAILY_LIMIT })
    .returning();

  const session = inserted[0];
  return {
    sessionId: session.id,
    ticketsRemaining: GUEST_DAILY_LIMIT,
    dailyLimit: GUEST_DAILY_LIMIT,
  };
}

/**
 * Get crate listing.
 */
export async function getCrates(): Promise<CrateInfo[]> {
  const db = getDrizzleClient();
  const rows = await db
    .select()
    .from(crateConfigs)
    .where(eq(crateConfigs.active, true))
    .orderBy(crateConfigs.sortOrder);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    dropRates: r.dropRates as Record<GachaQuality, number>,
    ticketCost: r.ticketCost,
    starRating: r.starRating,
  }));
}

/**
 * Get paginated collection.
 */
export async function getCollection(
  playerId: string,
  page: number = 1,
  limit: number = 20,
  quality?: GachaQuality
): Promise<CollectionPage> {
  const db = getDrizzleClient();
  const offset = (page - 1) * limit;

  const conditions = [eq(pullHistory.playerId, playerId)];
  if (quality) conditions.push(eq(pullHistory.quality, quality));

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(pullHistory)
      .where(and(...conditions))
      .orderBy(desc(pullHistory.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(pullHistory)
      .where(and(...conditions)),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    items: items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      quality: i.quality as GachaQuality,
      value: i.value,
      createdAt: String(i.createdAt),
    })),
    total,
    page,
    hasMore: offset + items.length < total,
  };
}

/**
 * Get player stats.
 */
export async function getStats(playerId: string): Promise<PlayerStats> {
  const db = getDrizzleClient();

  const [streakRow, qualityCounts, recentPulls] = await Promise.all([
    getPlayerStreak(playerId, false),
    db
      .select({ quality: pullHistory.quality, count: count() })
      .from(pullHistory)
      .where(eq(pullHistory.playerId, playerId))
      .groupBy(pullHistory.quality),
    db
      .select({ name: pullHistory.itemName, quality: pullHistory.quality, createdAt: pullHistory.createdAt })
      .from(pullHistory)
      .where(eq(pullHistory.playerId, playerId))
      .orderBy(desc(pullHistory.createdAt))
      .limit(10),
  ]);

  const breakdown: Record<GachaQuality, number> = {
    white: 0, blue: 0, purple: 0, red: 0, gold: 0,
  };
  for (const row of qualityCounts) {
    breakdown[row.quality as GachaQuality] = row.count;
  }

  const dailyLimit = streakRow?.dailyLimit ?? PLAYER_DAILY_LIMIT;

  return {
    totalPulls: streakRow?.totalPulls ?? 0,
    pullsToday: streakRow?.pullsToday ?? 0,
    dailyLimit,
    streak: {
      current: streakRow?.currentStreak ?? 0,
      longest: streakRow?.longestStreak ?? 0,
      lastPullDate: streakRow?.lastPullDate ?? null,
    },
    pityProgress: {
      current: streakRow?.pityCount ?? 0,
      target: PITY_THRESHOLD,
    },
    qualityBreakdown: breakdown,
    recentPulls: recentPulls.map((p) => ({
      name: p.name,
      quality: p.quality as GachaQuality,
      createdAt: String(p.createdAt),
    })),
  };
}
