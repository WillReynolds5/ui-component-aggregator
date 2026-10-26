CREATE TYPE "public"."media_source" AS ENUM('scrape', 'capture');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source" "media_source" DEFAULT 'scrape' NOT NULL;