import { pgTable, serial, timestamp, varchar, integer, boolean, jsonb, text, index, uuid, pgEnum, numeric, uniqueIndex, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Quality enum for gacha drops
export const qualityEnum = pgEnum("quality", ["white", "blue", "purple", "red", "gold"]);

// Run status enum for extraction game
export const runStatusEnum = pgEnum("run_status", ["active", "completed", "aborted", "dead"]);

// System health check (Supabase system table, do not modify)
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ──────────────────────────────────────────────
// Gacha Schema
// ──────────────────────────────────────────────

/**
 * Crate configurations. Each crate type has its own drop table and visual style.
 * Decision #4: 3 crate types at launch (Military, Supply Drop, Black Market).
 */
export const crateConfigs = pgTable(
	"crate_configs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		imageUrl: varchar("image_url", { length: 500 }),
		starRating: integer("star_rating").notNull().default(1),
		ticketCost: integer("ticket_cost").notNull().default(1),
		dropRates: jsonb("drop_rates").notNull().$type<{
			white: number;
			blue: number;
			purple: number;
			red: number;
			gold: number;
		}>(),
		active: boolean("active").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		check("drop_rates_sum_check", sql`(
			(table.drop_rates->>'white')::float +
			(table.drop_rates->>'blue')::float +
			(table.drop_rates->>'purple')::float +
			(table.drop_rates->>'red')::float +
			(table.drop_rates->>'gold')::float
		) = 1.0`),
		check("drop_rates_non_negative", sql`(
			(table.drop_rates->>'white')::float >= 0 AND
			(table.drop_rates->>'blue')::float >= 0 AND
			(table.drop_rates->>'purple')::float >= 0 AND
			(table.drop_rates->>'red')::float >= 0 AND
			(table.drop_rates->>'gold')::float >= 0
		)`),
	]
);

/**
 * Pull history. Every pull is recorded with idempotency key for dedup.
 * Indexed for collection pagination (player_id + created_at DESC).
 */
export const pullHistory = pgTable(
	"pull_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playerId: varchar("player_id", { length: 36 }).notNull(),
		crateId: uuid("crate_id").notNull().references(() => crateConfigs.id),
		itemName: varchar("item_name", { length: 100 }).notNull(),
		quality: qualityEnum("quality").notNull(),
		value: integer("value").notNull(),
		affixes: jsonb("affixes").$type<Array<{ type: string; description: string }>>(),
		idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("pull_history_player_created_idx").on(table.playerId, table.createdAt),
		uniqueIndex("pull_history_idempotency_idx").on(table.playerId, table.idempotencyKey),
	]
);

/**
 * Guest sessions. Server-generated UUID stored in httpOnly cookie.
 * Cleaned up after 7 days of inactivity.
 */
export const guestSessions = pgTable(
	"guest_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ipHash: varchar("ip_hash", { length: 64 }),
		userAgent: text("user_agent"),
		pullsToday: integer("pulls_today").notNull().default(0),
		dailyLimit: integer("daily_limit").notNull().default(3),
		lastActive: timestamp("last_active", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("guest_sessions_last_active_idx").on(table.lastActive),
	]
);

/**
 * Player streaks and pity counters. One row per registered player.
 * pity_count incremented atomically via UPDATE...RETURNING.
 */
export const playerStreaks = pgTable(
	"player_streaks",
	{
		playerId: varchar("player_id", { length: 36 }).primaryKey(),
		email: varchar("email", { length: 255 }).unique(),
		supabaseUid: varchar("supabase_uid", { length: 36 }),
		isRegistered: boolean("is_registered").notNull().default(false),
		upgradedAt: timestamp("upgraded_at", { withTimezone: true }),
		currentStreak: integer("current_streak").notNull().default(0),
		longestStreak: integer("longest_streak").notNull().default(0),
		lastPullDate: timestamp("last_pull_date", { withTimezone: true }),
		failStreak: integer("fail_streak").notNull().default(0),
		pityCount: integer("pity_count").notNull().default(0),
		totalPulls: integer("total_pulls").notNull().default(0),
		pullsToday: integer("pulls_today").notNull().default(0),
		dailyLimit: integer("daily_limit").notNull().default(5),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
	}
);

// ──────────────────────────────────────────────
// Extraction Game Schema
// ──────────────────────────────────────────────

/**
 * Runs. Each extraction game session is a run.
 * Map data stored as JSONB for single-query fetch.
 * Partial unique index enforces one active run per player.
 */
export const runs = pgTable(
	"runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playerId: varchar("player_id", { length: 36 }).notNull(),
		zoneId: varchar("zone_id", { length: 50 }).notNull(),
		status: runStatusEnum("status").notNull().default("active"),
		mapData: jsonb("map_data").notNull(),
		currentNodeId: varchar("current_node_id", { length: 50 }).notNull(),
		visitedNodeIds: jsonb("visited_node_ids").notNull().$type<string[]>().default([]),
		hp: integer("hp").notNull().default(100),
		maxHp: integer("max_hp").notNull().default(100),
		backpackCapacity: integer("backpack_capacity").notNull().default(8),
		evacWaitTurns: integer("evac_wait_turns").notNull().default(0),
		seed: varchar("seed", { length: 100 }).notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("runs_player_status_idx").on(table.playerId, table.status),
	]
);

/**
 * Run inventory. Items in the player's backpack during a run.
 * Cleared on extraction (banked) or death (lost).
 */
export const runInventory = pgTable(
	"run_inventory",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
		itemName: varchar("item_name", { length: 100 }).notNull(),
		quality: qualityEnum("quality").notNull(),
		value: integer("value").notNull(),
		affixes: jsonb("affixes").$type<Array<{ type: string; description: string }>>(),
		sourceNodeId: varchar("source_node_id", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("run_inventory_run_idx").on(table.runId),
	]
);

/**
 * Enemy templates. Config for enemy types (Phase 2 combat).
 * Schema stub created now so it's stable across phases.
 */
export const enemyTemplates = pgTable(
	"enemy_templates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		hpMin: integer("hp_min").notNull(),
		hpMax: integer("hp_max").notNull(),
		atkMin: integer("atk_min").notNull(),
		atkMax: integer("atk_max").notNull(),
		behaviorPattern: varchar("behavior_pattern", { length: 50 }).notNull(),
		zoneId: varchar("zone_id", { length: 50 }).notNull(),
		lootDropRate: numeric("loot_drop_rate").notNull().default("0.5"),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	}
);
