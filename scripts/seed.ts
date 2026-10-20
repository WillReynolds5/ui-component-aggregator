import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { categories, items, variants } from "@/drizzle/schema";
import { getDb, usesDataApi } from "@/db";
import { ingestScrapeRecords, linkParts } from "@/lib/catalog/ingest";
import type { ScrapeRecord } from "@/lib/catalog/mapping";
import { flattenTaxonomy, TAXONOMY } from "@/lib/catalog/taxonomy";

async function seedTaxonomy() {
  const db = getDb();
  const rows = flattenTaxonomy();
  const idBySlug = new Map<string, string>();

  for (const row of rows) {
    const parentId = row.parentSlug ? idBySlug.get(row.parentSlug) ?? null : null;
    const existing = await db.query.categories.findFirst({
      where: eq(categories.slug, row.slug),
    });
    if (existing) {
      await db
        .update(categories)
        .set({
          name: row.name,
          description: row.description,
          parentId,
          sortOrder: row.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, existing.id));
      idBySlug.set(row.slug, existing.id);
      continue;
    }
    const [created] = await db
      .insert(categories)
      .values({
        slug: row.slug,
        name: row.name,
        description: row.description,
        parentId,
        sortOrder: row.sortOrder,
      })
      .returning({ id: categories.id });
    idBySlug.set(row.slug, created.id);
  }

  return idBySlug;
}

async function addDemoRelations() {
  await linkParts("transitions-dev", "skeleton-effect-ui-generation-skill-transitions-dev");
  await linkParts("hero-ui-v3", "gauge-ui");

  const db = getDb();
  const animate = await db.query.items.findFirst({
    where: eq(items.slug, "animate-ui-2-0"),
  });
  if (animate) {
    await db
      .insert(variants)
      .values({
        itemId: animate.id,
        slug: "dark",
        name: "Dark",
        description: "Dark-mode motion primitives.",
        previewUrl: "https://animate-ui.com",
        sortOrder: 1,
      })
      .onConflictDoNothing();
  }
}

async function main() {
  if (!process.env.DATABASE_URL && !usesDataApi()) {
    throw new Error("DATABASE_URL or AURORA_* Data API env is required");
  }

  console.log("Seeding taxonomy (%s roots)...", TAXONOMY.length);
  await seedTaxonomy();

  const path = resolve(process.cwd(), "data/seed/components.json");
  const records = JSON.parse(readFileSync(path, "utf8")) as ScrapeRecord[];
  console.log("Ingesting %s scrape records...", records.length);
  const result = await ingestScrapeRecords(records);
  console.log(result);

  await addDemoRelations();

  const db = getDb();
  await db.execute(sql`
    delete from creators
    where id not in (
      select creator_id from items where creator_id is not null
    )
  `);
  console.log("Removed unused creators after remap.");
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
