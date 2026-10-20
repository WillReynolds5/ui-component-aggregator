CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."access" AS ENUM('full_code', 'install_only', 'link_only');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('component', 'block');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'demo_url');--> statement-breakpoint
CREATE TYPE "public"."pricing" AS ENUM('free', 'paid', 'freemium');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"x_handle" text,
	"website" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"text_embedding" vector(1536),
	"image_embedding" vector(768),
	"content" text,
	"extra" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_item_id" uuid NOT NULL,
	"child_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_tags" (
	"item_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "item_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "item_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"framework" text DEFAULT 'unknown' NOT NULL,
	"styling" text,
	"dependencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"pricing" "pricing" DEFAULT 'free' NOT NULL,
	"license" text,
	"access" "access" DEFAULT 'link_only' NOT NULL,
	"code" text,
	"install_command" text,
	"source_url" text NOT NULL,
	"source_id" uuid NOT NULL,
	"creator_id" uuid,
	"discovered_via_post_url" text,
	"primary_category_id" uuid NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"homepage" text,
	"repo_url" text,
	"registry_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"code" text,
	"preview_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_parts" ADD CONSTRAINT "item_parts_parent_item_id_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_parts" ADD CONSTRAINT "item_parts_child_item_id_items_id_fk" FOREIGN KEY ("child_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_slug_idx" ON "creators" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_x_handle_idx" ON "creators" USING btree ("x_handle");--> statement-breakpoint
CREATE INDEX "embeddings_text_hnsw_idx" ON "embeddings" USING hnsw ("text_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "item_parts_parent_child_idx" ON "item_parts" USING btree ("parent_item_id","child_item_id");--> statement-breakpoint
CREATE INDEX "item_parts_child_idx" ON "item_parts" USING btree ("child_item_id");--> statement-breakpoint
CREATE INDEX "item_tags_tag_idx" ON "item_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_slug_idx" ON "items" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_url_idx" ON "items" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "items_framework_idx" ON "items" USING btree ("framework");--> statement-breakpoint
CREATE INDEX "items_pricing_idx" ON "items" USING btree ("pricing");--> statement-breakpoint
CREATE INDEX "items_access_idx" ON "items" USING btree ("access");--> statement-breakpoint
CREATE INDEX "items_source_id_idx" ON "items" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "items_creator_id_idx" ON "items" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("primary_category_id");--> statement-breakpoint
CREATE INDEX "items_name_trgm_idx" ON "items" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "items_description_trgm_idx" ON "items" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "media_item_idx" ON "media" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_slug_idx" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_homepage_idx" ON "sources" USING btree ("homepage");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_item_slug_idx" ON "variants" USING btree ("item_id","slug");--> statement-breakpoint
CREATE INDEX "variants_item_idx" ON "variants" USING btree ("item_id");