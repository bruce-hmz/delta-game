-- Step 1: Create enum and tables (paste into Supabase SQL Editor)
-- If you already ran the previous version, run: DROP TABLE IF EXISTS pull_history, player_streaks, guest_sessions, crate_configs; DROP TYPE IF EXISTS quality;
-- Then run this.

CREATE TYPE "public"."quality" AS ENUM('white', 'blue', 'purple', 'red', 'gold');

CREATE TABLE "crate_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "image_url" varchar(500),
  "star_rating" integer DEFAULT 1 NOT NULL,
  "ticket_cost" integer DEFAULT 1 NOT NULL,
  "drop_rates" jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "drop_rates_sum_check" CHECK (abs(
    (drop_rates->>'white')::float +
    (drop_rates->>'blue')::float +
    (drop_rates->>'purple')::float +
    (drop_rates->>'red')::float +
    (drop_rates->>'gold')::float - 1.0
  ) < 0.001),
  CONSTRAINT "drop_rates_non_negative" CHECK (
    (drop_rates->>'white')::float >= 0 AND
    (drop_rates->>'blue')::float >= 0 AND
    (drop_rates->>'purple')::float >= 0 AND
    (drop_rates->>'red')::float >= 0 AND
    (drop_rates->>'gold')::float >= 0
  )
);

CREATE TABLE "guest_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ip_hash" varchar(64),
  "user_agent" text,
  "pulls_today" integer DEFAULT 0 NOT NULL,
  "daily_limit" integer DEFAULT 3 NOT NULL,
  "last_active" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "player_streaks" (
  "player_id" varchar(36) PRIMARY KEY NOT NULL,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_pull_date" timestamp with time zone,
  "fail_streak" integer DEFAULT 0 NOT NULL,
  "pity_count" integer DEFAULT 0 NOT NULL,
  "total_pulls" integer DEFAULT 0 NOT NULL,
  "pulls_today" integer DEFAULT 0 NOT NULL,
  "daily_limit" integer DEFAULT 5 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone
);

CREATE TABLE "pull_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" varchar(36) NOT NULL,
  "crate_id" uuid NOT NULL REFERENCES "crate_configs"("id"),
  "item_name" varchar(100) NOT NULL,
  "quality" "quality" NOT NULL,
  "value" integer NOT NULL,
  "affixes" jsonb,
  "idempotency_key" varchar(200) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "guest_sessions_last_active_idx" ON "guest_sessions" USING btree ("last_active");
CREATE INDEX "pull_history_player_created_idx" ON "pull_history" USING btree ("player_id","created_at");
CREATE UNIQUE INDEX "pull_history_idempotency_idx" ON "pull_history" USING btree ("player_id","idempotency_key");

-- Step 2: Seed crate data

INSERT INTO crate_configs (id, name, description, star_rating, ticket_cost, drop_rates, active, sort_order) VALUES
  (
    gen_random_uuid(),
    '军用补给箱',
    '标准军用物资箱，包含基础到稀有品质的装备',
    1, 1,
    '{"white": 0.60, "blue": 0.25, "purple": 0.10, "red": 0.04, "gold": 0.01}'::jsonb,
    true, 1
  ),
  (
    gen_random_uuid(),
    '空投补给箱',
    '高级空投物资，保底蓝色品质以上',
    2, 1,
    '{"white": 0.00, "blue": 0.40, "purple": 0.30, "red": 0.20, "gold": 0.10}'::jsonb,
    true, 2
  ),
  (
    gen_random_uuid(),
    '黑市军火箱',
    '黑市稀有军火，只有紫色以上品质',
    3, 1,
    '{"white": 0.00, "blue": 0.00, "purple": 0.30, "red": 0.40, "gold": 0.30}'::jsonb,
    true, 3
  );
