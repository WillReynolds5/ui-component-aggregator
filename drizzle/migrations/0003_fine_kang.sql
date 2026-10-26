ALTER TYPE "public"."media_kind" ADD VALUE 'render';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "library_item_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "registry_url" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_library_item_id_items_id_fk" FOREIGN KEY ("library_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_library_item_idx" ON "items" USING btree ("library_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_registry_url_idx" ON "items" USING btree ("registry_url");