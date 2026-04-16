ALTER TABLE "player_streaks" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "player_streaks" ADD COLUMN "supabase_uid" varchar(36);--> statement-breakpoint
ALTER TABLE "player_streaks" ADD COLUMN "is_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player_streaks" ADD COLUMN "upgraded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_streaks" ADD CONSTRAINT "player_streaks_email_unique" UNIQUE("email");