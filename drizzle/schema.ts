import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const TEXT_EMBEDDING_DIMS = 1536;
export const IMAGE_EMBEDDING_DIMS = 768;

export const itemKindEnum = pgEnum("item_kind", ["component", "block"]);
export const pricingEnum = pgEnum("pricing", ["free", "paid", "freemium"]);
export const accessEnum = pgEnum("access", [
  "full_code",
  "install_only",
  "link_only",
]);
export const mediaKindEnum = pgEnum("media_kind", ["image", "video", "demo_url"]);
/** `scrape` rows are replaced on every re-ingest; `capture` rows (our screenshots) survive it. */
export const mediaSourceEnum = pgEnum("media_source", ["scrape", "capture"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    homepage: text("homepage"),
    repoUrl: text("repo_url"),
    registryUrl: text("registry_url"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sources_slug_idx").on(table.slug),
    uniqueIndex("sources_homepage_idx").on(table.homepage),
  ],
);

export const creators = pgTable(
  "creators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    xHandle: text("x_handle"),
    website: text("website"),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("creators_slug_idx").on(table.slug),
    uniqueIndex("creators_x_handle_idx").on(table.xHandle),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug),
    index("categories_parent_idx").on(table.parentId),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    kind: itemKindEnum("kind").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    framework: text("framework").notNull().default("unknown"),
    styling: text("styling"),
    dependencies: text("dependencies")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pricing: pricingEnum("pricing").notNull().default("free"),
    license: text("license"),
    access: accessEnum("access").notNull().default("link_only"),
    code: text("code"),
    installCommand: text("install_command"),
    sourceUrl: text("source_url").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    creatorId: uuid("creator_id").references(() => creators.id, {
      onDelete: "set null",
    }),
    discoveredViaPostUrl: text("discovered_via_post_url"),
    primaryCategoryId: uuid("primary_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("items_slug_idx").on(table.slug),
    uniqueIndex("items_source_url_idx").on(table.sourceUrl),
    index("items_kind_idx").on(table.kind),
    index("items_framework_idx").on(table.framework),
    index("items_pricing_idx").on(table.pricing),
    index("items_access_idx").on(table.access),
    index("items_source_id_idx").on(table.sourceId),
    index("items_creator_id_idx").on(table.creatorId),
    index("items_category_idx").on(table.primaryCategoryId),
    index("items_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
    index("items_description_trgm_idx").using(
      "gin",
      sql`${table.description} gin_trgm_ops`,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tags_slug_idx").on(table.slug)],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.tagId] }),
    index("item_tags_tag_idx").on(table.tagId),
  ],
);

export const itemParts = pgTable(
  "item_parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentItemId: uuid("parent_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    childItemId: uuid("child_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("item_parts_parent_child_idx").on(
      table.parentItemId,
      table.childItemId,
    ),
    index("item_parts_child_idx").on(table.childItemId),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    code: text("code"),
    previewUrl: text("preview_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("variants_item_slug_idx").on(table.itemId, table.slug),
    index("variants_item_idx").on(table.itemId),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    source: mediaSourceEnum("source").notNull().default("scrape"),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (table) => [index("media_item_idx").on(table.itemId)],
);

export const embeddings = pgTable(
  "embeddings",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    textEmbedding: vector("text_embedding", {
      dimensions: TEXT_EMBEDDING_DIMS,
    }),
    imageEmbedding: vector("image_embedding", {
      dimensions: IMAGE_EMBEDDING_DIMS,
    }),
    content: text("content"),
    extra: jsonb("extra").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("embeddings_text_hnsw_idx").using(
      "hnsw",
      table.textEmbedding.op("vector_cosine_ops"),
    ),
  ],
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  items: many(items),
}));

export const creatorsRelations = relations(creators, ({ many }) => ({
  items: many(items),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_tree",
  }),
  children: many(categories, { relationName: "category_tree" }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  source: one(sources, {
    fields: [items.sourceId],
    references: [sources.id],
  }),
  creator: one(creators, {
    fields: [items.creatorId],
    references: [creators.id],
  }),
  primaryCategory: one(categories, {
    fields: [items.primaryCategoryId],
    references: [categories.id],
  }),
  tags: many(itemTags),
  media: many(media),
  variants: many(variants),
  embedding: one(embeddings, {
    fields: [items.id],
    references: [embeddings.itemId],
  }),
  builtFrom: many(itemParts, { relationName: "parent_parts" }),
  usedIn: many(itemParts, { relationName: "child_parts" }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  items: many(itemTags),
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id],
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id],
  }),
}));

export const itemPartsRelations = relations(itemParts, ({ one }) => ({
  parent: one(items, {
    fields: [itemParts.parentItemId],
    references: [items.id],
    relationName: "parent_parts",
  }),
  child: one(items, {
    fields: [itemParts.childItemId],
    references: [items.id],
    relationName: "child_parts",
  }),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  item: one(items, {
    fields: [variants.itemId],
    references: [items.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  item: one(items, {
    fields: [media.itemId],
    references: [items.id],
  }),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  item: one(items, {
    fields: [embeddings.itemId],
    references: [items.id],
  }),
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type Creator = typeof creators.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type ItemPart = typeof itemParts.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;
