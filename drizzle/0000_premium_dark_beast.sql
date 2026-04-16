CREATE TYPE "public"."quality" AS ENUM('white', 'blue', 'purple', 'red', 'gold');--> statement-breakpoint
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
	CONSTRAINT "drop_rates_sum_check" CHECK ((
			(table.drop_rates->>'white')::float +
			(table.drop_rates->>'blue')::float +
			(table.drop_rates->>'purple')::float +
			(table.drop_rates->>'red')::float +
			(table.drop_rates->>'gold')::float
		) = 1.0),
	CONSTRAINT "drop_rates_non_negative" CHECK ((
			(table.drop_rates->>'white')::float >= 0 AND
			(table.drop_rates->>'blue')::float >= 0 AND
			(table.drop_rates->>'purple')::float >= 0 AND
			(table.drop_rates->>'red')::float >= 0 AND
			(table.drop_rates->>'gold')::float >= 0
		))
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" text,
	"pulls_today" integer DEFAULT 0 NOT NULL,
	"daily_limit" integer DEFAULT 3 NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "pull_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"crate_id" uuid NOT NULL,
	"item_name" varchar(100) NOT NULL,
	"quality" "quality" NOT NULL,
	"value" integer NOT NULL,
	"affixes" jsonb,
	"idempotency_key" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pull_history" ADD CONSTRAINT "pull_history_crate_id_crate_configs_id_fk" FOREIGN KEY ("crate_id") REFERENCES "public"."crate_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_sessions_last_active_idx" ON "guest_sessions" USING btree ("last_active");--> statement-breakpoint
CREATE INDEX "pull_history_player_created_idx" ON "pull_history" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_history_idempotency_idx" ON "pull_history" USING btree ("player_id","idempotency_key");