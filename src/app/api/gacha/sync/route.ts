import { NextRequest, NextResponse } from "next/server";
import { getDrizzleClient } from "@/storage/database/drizzle-client";
import { pullHistory, playerStreaks } from "@/storage/database/shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { rollQuality, generateItem } from "@/lib/game/gacha-service";
import { getCrates } from "@/lib/game/gacha-service";
import { seededRandom, PITY_THRESHOLD } from "@/lib/game/gacha-constants";
import type { GachaQuality } from "@/lib/game/gacha-constants";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pulls } = body as { pulls: Array<{ idempotencyKey: string; crateId: string }> };

    if (!pulls || !Array.isArray(pulls)) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    // Must be a registered user (not guest)
    const auth = await getPlayerId(request);
    if (!auth || auth.isGuest) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const playerId = auth.playerId;

    // Get guest session ID from cookie to identify the source
    const guestId = request.cookies.get("guest_session")?.value;
    if (!guestId) {
      return NextResponse.json({ error: "no_guest_session" }, { status: 400 });
    }

    const db = getDrizzleClient();
    let synced = 0;
    let skipped = 0;

    // Fetch all crate configs for drop rate lookups
    const crates = await getCrates();
    const crateMap = new Map(crates.map((c) => [c.id, c]));

    for (const pull of pulls) {
      // Check if this pull already exists (by idempotency key, registered to this player)
      const existing = await db
        .select()
        .from(pullHistory)
        .where(
          and(
            eq(pullHistory.playerId, playerId),
            eq(pullHistory.idempotencyKey, pull.idempotencyKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Server-authoritative: re-generate the drop using idempotencyKey as seed
      const crate = crateMap.get(pull.crateId);
      if (!crate) {
        skipped++;
        continue;
      }

      const rng = seededRandom(pull.idempotencyKey);
      const quality = rollQuality(crate.dropRates, rng);
      const { name, value, affixes } = generateItem(quality, rng);

      // Insert as server-authoritative record
      await db.insert(pullHistory).values({
        playerId,
        crateId: pull.crateId,
        itemName: name,
        quality,
        value,
        affixes,
        idempotencyKey: pull.idempotencyKey,
      });

      synced++;
    }

    // Recalculate pity server-side from authoritative pull history
    const allPulls = await db
      .select({ quality: pullHistory.quality, createdAt: pullHistory.createdAt })
      .from(pullHistory)
      .where(eq(pullHistory.playerId, playerId))
      .orderBy(pullHistory.createdAt);

    let pityCount = 0;
    for (const p of allPulls) {
      if (p.quality === "red" || p.quality === "gold") {
        pityCount = 0;
      } else {
        pityCount++;
        if (pityCount >= PITY_THRESHOLD) pityCount = 0;
      }
    }

    await db
      .update(playerStreaks)
      .set({
        pityCount,
        totalPulls: allPulls.length,
        updatedAt: sql`NOW()`,
      })
      .where(eq(playerStreaks.playerId, playerId));

    return NextResponse.json({
      synced,
      skipped,
      pityProgress: { current: pityCount, target: PITY_THRESHOLD },
    });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
