import { pgTable, serial, timestamp, varchar, integer, boolean, jsonb, text, index, uuid, pgEnum, numeric, uniqueIndex, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Quality enum for gacha drops
export const qualityEnum = pgEnum("quality", ["white", "blue", "purple", "red", "gold"]);

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
