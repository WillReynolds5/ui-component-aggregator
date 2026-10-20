import { and, eq } from "drizzle-orm";
import {
  categories,
  creators,
  itemParts,
  items,
  itemTags,
  media,
  sources,
  tags,
} from "@/drizzle/schema";
import { getDb } from "@/db";
import { mapScrapeRecord, type MappedItem, type ScrapeRecord } from "@/lib/catalog/mapping";
import { slugify, slugifyUnique } from "@/lib/catalog/slug";

export type IngestResult = {
  created: number;
  updated: number;
  skipped: number;
  slugs: string[];
};

async function ensureCategoryId(
  db: ReturnType<typeof getDb>,
  slug: string,
  cache: Map<string, string>,
) {
  const hit = cache.get(slug);
  if (hit) return hit;
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  if (!row) {
    throw new Error(`Unknown category slug: ${slug}`);
  }
  cache.set(slug, row.id);
  return row.id;
}

async function upsertSource(
  db: ReturnType<typeof getDb>,
  mapped: MappedItem,
  used: Set<string>,
) {
  const homepage = mapped.sourceHomepage;
  if (homepage) {
    const existing = await db.query.sources.findFirst({
      where: eq(sources.homepage, homepage),
    });
    if (existing) {
      await db
        .update(sources)
        .set({
          name: mapped.sourceName,
          repoUrl: mapped.sourceRepoUrl ?? existing.repoUrl,
          registryUrl: mapped.sourceRegistryUrl ?? existing.registryUrl,
          updatedAt: new Date(),
        })
        .where(eq(sources.id, existing.id));
      return existing.id;
    }
  }
  const [created] = await db
    .insert(sources)
    .values({
      name: mapped.sourceName,
      slug: slugifyUnique(mapped.sourceName, used),
      homepage,
      repoUrl: mapped.sourceRepoUrl,
      registryUrl: mapped.sourceRegistryUrl,
    })
    .returning({ id: sources.id });
  return created.id;
}

async function upsertCreator(
  db: ReturnType<typeof getDb>,
  mapped: MappedItem,
  used: Set<string>,
) {
  const slug = mapped.creatorSlug || slugify(mapped.creatorName);
  const byHandle = mapped.creatorHandle
    ? await db.query.creators.findFirst({
        where: eq(creators.xHandle, mapped.creatorHandle),
      })
    : undefined;
  const bySlug = await db.query.creators.findFirst({
    where: eq(creators.slug, slug),
  });

  if (byHandle && bySlug && byHandle.id !== bySlug.id) {
    await db
      .update(items)
      .set({ creatorId: bySlug.id, updatedAt: new Date() })
      .where(eq(items.creatorId, byHandle.id));
    await db.delete(creators).where(eq(creators.id, byHandle.id));
    await db
      .update(creators)
      .set({
        name: mapped.creatorName,
        xHandle: mapped.creatorHandle ?? bySlug.xHandle,
        website: mapped.creatorWebsite ?? bySlug.website,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, bySlug.id));
    used.add(bySlug.slug);
    return bySlug.id;
  }

  const found = byHandle ?? bySlug;
  if (found) {
    const nextSlug = bySlug && bySlug.id !== found.id ? found.slug : slug;
    await db
      .update(creators)
      .set({
        name: mapped.creatorName,
        slug: nextSlug,
        xHandle: mapped.creatorHandle ?? found.xHandle,
        website: mapped.creatorWebsite ?? found.website,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, found.id));
    used.add(nextSlug);
    return found.id;
  }

  used.add(slug);
  const [created] = await db
    .insert(creators)
    .values({
      name: mapped.creatorName,
      slug,
      xHandle: mapped.creatorHandle,
      website: mapped.creatorWebsite,
    })
    .returning({ id: creators.id });
  return created.id;
}

async function upsertTags(
  db: ReturnType<typeof getDb>,
  names: string[],
  used: Set<string>,
) {
  const ids: string[] = [];
  for (const name of names) {
    const slug = slugify(name);
    const existing = await db.query.tags.findFirst({ where: eq(tags.slug, slug) });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const [created] = await db
      .insert(tags)
      .values({ slug: slugifyUnique(name, used), name })
      .returning({ id: tags.id });
    ids.push(created.id);
  }
  return ids;
}

async function writeMappedItem(
  db: ReturnType<typeof getDb>,
  mapped: MappedItem,
  caches: {
    categories: Map<string, string>;
    sourceSlugs: Set<string>;
    creatorSlugs: Set<string>;
    tagSlugs: Set<string>;
    itemSlugs: Set<string>;
  },
): Promise<"created" | "updated"> {
  const categoryId = await ensureCategoryId(db, mapped.categorySlug, caches.categories);
  const sourceId = await upsertSource(db, mapped, caches.sourceSlugs);
  const creatorId = await upsertCreator(db, mapped, caches.creatorSlugs);
  const tagIds = await upsertTags(db, mapped.tags, caches.tagSlugs);

  const existing = await db.query.items.findFirst({
    where: eq(items.sourceUrl, mapped.sourceUrl),
  });

  const payload = {
    kind: mapped.kind,
    name: mapped.name,
    description: mapped.description,
    framework: mapped.framework,
    styling: mapped.styling,
    dependencies: mapped.dependencies,
    pricing: mapped.pricing,
    license: mapped.license,
    access: mapped.access,
    code: mapped.code,
    installCommand: mapped.installCommand,
    sourceUrl: mapped.sourceUrl,
    sourceId,
    creatorId,
    discoveredViaPostUrl: mapped.discoveredViaPostUrl,
    primaryCategoryId: categoryId,
    discoveredAt: mapped.discoveredAt,
    updatedAt: new Date(),
  };

  let itemId: string;
  let status: "created" | "updated";
  if (existing) {
    await db.update(items).set(payload).where(eq(items.id, existing.id));
    itemId = existing.id;
    status = "updated";
    await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
    await db.delete(media).where(eq(media.itemId, itemId));
  } else {
    const slug = slugifyUnique(mapped.name, caches.itemSlugs);
    const [created] = await db
      .insert(items)
      .values({ ...payload, slug })
      .returning({ id: items.id, slug: items.slug });
    itemId = created.id;
    status = "created";
  }

  if (tagIds.length) {
    await db
      .insert(itemTags)
      .values(tagIds.map((tagId) => ({ itemId, tagId })))
      .onConflictDoNothing();
  }

  if (mapped.media.length) {
    await db.insert(media).values(
      mapped.media.map((entry, index) => ({
        itemId,
        kind: entry.kind,
        url: entry.url,
        alt: entry.alt,
        sortOrder: index,
      })),
    );
  }

  return status;
}

export async function ingestMappedItems(records: MappedItem[]): Promise<IngestResult> {
  const db = getDb();
  const [existingItems, existingSources, existingCreators, existingTags, existingCategories] =
    await Promise.all([
      db.select({ slug: items.slug }).from(items),
      db.select({ slug: sources.slug }).from(sources),
      db.select({ slug: creators.slug }).from(creators),
      db.select({ slug: tags.slug }).from(tags),
      db.select({ slug: categories.slug, id: categories.id }).from(categories),
    ]);

  const caches = {
    categories: new Map(existingCategories.map((row) => [row.slug, row.id])),
    sourceSlugs: new Set(existingSources.map((row) => row.slug)),
    creatorSlugs: new Set(existingCreators.map((row) => row.slug)),
    tagSlugs: new Set(existingTags.map((row) => row.slug)),
    itemSlugs: new Set(existingItems.map((row) => row.slug)),
  };

  const result: IngestResult = { created: 0, updated: 0, skipped: 0, slugs: [] };
  for (const mapped of records) {
    if (!mapped.sourceUrl) {
      result.skipped += 1;
      continue;
    }
    const status = await writeMappedItem(db, mapped, caches);
    result[status] += 1;
    result.slugs.push(mapped.slugHint);
  }
  return result;
}

export async function ingestScrapeRecords(records: ScrapeRecord[]): Promise<IngestResult> {
  return ingestMappedItems(records.map(mapScrapeRecord));
}

export async function linkParts(parentSlug: string, childSlug: string) {
  const db = getDb();
  const parent = await db.query.items.findFirst({ where: eq(items.slug, parentSlug) });
  const child = await db.query.items.findFirst({ where: eq(items.slug, childSlug) });
  if (!parent || !child || parent.id === child.id) return false;
  await db
    .insert(itemParts)
    .values({ parentItemId: parent.id, childItemId: child.id })
    .onConflictDoNothing();
  return true;
}

export { and, eq };
