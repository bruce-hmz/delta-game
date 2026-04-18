-- Migration: 0002_extraction_game
-- Adds extraction game tables: runs, run_inventory, enemy_templates

-- Create run_status enum
CREATE TYPE "run_status" AS ENUM ('active', 'completed', 'aborted', 'dead');

-- Runs table
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"player_id" varchar(36) NOT NULL,
	"zone_id" varchar(50) NOT NULL,
	"status" "run_status" NOT NULL DEFAULT 'active',
	"map_data" jsonb NOT NULL,
	"current_node_id" varchar(50) NOT NULL,
	"visited_node_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"hp" integer NOT NULL DEFAULT 100,
	"max_hp" integer NOT NULL DEFAULT 100,
	"backpack_capacity" integer NOT NULL DEFAULT 8,
	"evac_wait_turns" integer NOT NULL DEFAULT 0,
	"seed" varchar(100) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Partial unique index: one active run per player
CREATE UNIQUE INDEX "runs_one_active_per_player" ON "runs" ("player_id") WHERE "status" = 'active';

-- Index for querying runs by player + status
CREATE INDEX "runs_player_status_idx" ON "runs" ("player_id", "status");

-- Run inventory table
CREATE TABLE "run_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
	"item_name" varchar(100) NOT NULL,
	"quality" "quality" NOT NULL,
	"value" integer NOT NULL,
	"affixes" jsonb,
	"source_node_id" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "run_inventory_run_idx" ON "run_inventory" ("run_id");

-- Enemy templates table (stub for Phase 2)
CREATE TABLE "enemy_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(100) NOT NULL,
	"hp_min" integer NOT NULL,
	"hp_max" integer NOT NULL,
	"atk_min" integer NOT NULL,
	"atk_max" integer NOT NULL,
	"behavior_pattern" varchar(50) NOT NULL,
	"zone_id" varchar(50) NOT NULL,
	"loot_drop_rate" numeric NOT NULL DEFAULT '0.5',
	"active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
