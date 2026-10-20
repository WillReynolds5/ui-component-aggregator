import { and, asc, cosineDistance, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  categories,
  creators,
  embeddings,
  itemParts,
  items,
  itemTags,
  tags,
} from "@/drizzle/schema";
import { getDb } from "@/db";
import {
  EmbeddingNotConfiguredError,
  getEmbeddingProvider,
} from "@/lib/catalog/embeddings";
import {
  hybridReady,
  keywordPattern,
  type SearchFilters,
} from "@/lib/catalog/search";

export type ItemCardRecord = {
  id: string;
  slug: string;
  kind: "component" | "block";
  name: string;
  description: string;
  framework: string;
  styling: string | null;
  pricing: "free" | "paid" | "freemium";
  access: "full_code" | "install_only" | "link_only";
  sourceUrl: string;
  discoveredViaPostUrl: string | null;
  source: { id: string; name: string; homepage: string | null; repoUrl: string | null };
  creator: {
    id: string;
    slug: string;
    name: string;
    xHandle: string | null;
    website: string | null;
    avatarUrl: string | null;
  } | null;
  primaryCategory: { id: string; slug: string; name: string };
  tags: Array<{ slug: string; name: string }>;
  media: Array<{
    id: string;
    kind: "image" | "video" | "demo_url";
    url: string;
    alt: string | null;
  }>;
};

export async function listCategories() {
  const db = getDb();
  return db.query.categories.findMany({
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });
}

export async function listTags() {
  const db = getDb();
  return db.query.tags.findMany({ orderBy: [asc(tags.name)] });
}

export async function categoryDescendantSlugs(rootSlug: string): Promise<string[]> {
  const all = await listCategories();
  const byParent = new Map<string | null, typeof all>();
  for (const category of all) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }
  const root = all.find((category) => category.slug === rootSlug);
  if (!root) return [rootSlug];
  const slugs = [root.slug];
  const walk = (id: string) => {
    for (const child of all.filter((category) => category.parentId === id)) {
      slugs.push(child.slug);
      walk(child.id);
    }
  };
  walk(root.id);
  return slugs;
}

function cardFromRow(row: {
  id: string;
  slug: string;
  kind: ItemCardRecord["kind"];
  name: string;
  description: string;
  framework: string;
  styling: string | null;
  pricing: ItemCardRecord["pricing"];
  access: ItemCardRecord["access"];
  sourceUrl: string;
  discoveredViaPostUrl: string | null;
  source: ItemCardRecord["source"];
  creator: ItemCardRecord["creator"];
  primaryCategory: ItemCardRecord["primaryCategory"];
  tags: Array<{ tag: { slug: string; name: string } }>;
  media: ItemCardRecord["media"];
}): ItemCardRecord {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    description: row.description,
    framework: row.framework,
    styling: row.styling,
    pricing: row.pricing,
    access: row.access,
    sourceUrl: row.sourceUrl,
    discoveredViaPostUrl: row.discoveredViaPostUrl,
    source: {
      id: row.source.id,
      name: row.source.name,
      homepage: row.source.homepage,
      repoUrl: row.source.repoUrl,
    },
    creator: row.creator
      ? {
          id: row.creator.id,
          slug: row.creator.slug,
          name: row.creator.name,
          xHandle: row.creator.xHandle,
          website: row.creator.website,
          avatarUrl: row.creator.avatarUrl,
        }
      : null,
    primaryCategory: {
      id: row.primaryCategory.id,
      slug: row.primaryCategory.slug,
      name: row.primaryCategory.name,
    },
    tags: row.tags.map((entry) => entry.tag),
    media: row.media.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      url: entry.url,
      alt: entry.alt,
    })),
  };
}

export type CreatorFacet = {
  slug: string;
  name: string;
  xHandle: string | null;
  count: number;
};

async function catalogConditions(
  filters: SearchFilters,
  options: { omitCreators?: boolean } = {},
) {
  const db = getDb();
  const conditions = [];

  if (filters.kind) conditions.push(eq(items.kind, filters.kind));
  if (filters.framework) conditions.push(eq(items.framework, filters.framework));
  if (filters.pricing) conditions.push(eq(items.pricing, filters.pricing));
  if (filters.access) conditions.push(eq(items.access, filters.access));

  if (filters.categorySlug) {
    const slugs = await categoryDescendantSlugs(filters.categorySlug);
    const cats = await db.query.categories.findMany({
      where: inArray(categories.slug, slugs),
    });
    conditions.push(
      inArray(
        items.primaryCategoryId,
        cats.map((category) => category.id),
      ),
    );
  }

  if (filters.q) {
    const pattern = keywordPattern(filters.q);
    const matchingCreators = await db
      .select({ id: creators.id })
      .from(creators)
      .where(
        or(ilike(creators.name, pattern), ilike(creators.xHandle, pattern), ilike(creators.slug, pattern)),
      );
    const creatorIds = matchingCreators.map((row) => row.id);
    const textMatch = [
      ilike(items.name, pattern),
      ilike(items.description, pattern),
      ilike(items.framework, pattern),
      ...(creatorIds.length ? [inArray(items.creatorId, creatorIds)] : []),
    ];
    conditions.push(or(...textMatch));
  }

  if (filters.tags?.length) {
    const wanted = await db.query.tags.findMany({
      where: inArray(tags.slug, filters.tags),
    });
    if (!wanted.length) return { empty: true as const, where: undefined };
    const links = await db
      .select({ itemId: itemTags.itemId })
      .from(itemTags)
      .where(
        inArray(
          itemTags.tagId,
          wanted.map((tag) => tag.id),
        ),
      );
    const taggedIds = [...new Set(links.map((link) => link.itemId))];
    if (!taggedIds.length) return { empty: true as const, where: undefined };
    conditions.push(inArray(items.id, taggedIds));
  }

  if (!options.omitCreators && filters.creators?.length) {
    const wanted = await db.query.creators.findMany({
      where: inArray(creators.slug, filters.creators),
    });
    if (!wanted.length) return { empty: true as const, where: undefined };
    conditions.push(
      inArray(
        items.creatorId,
        wanted.map((creator) => creator.id),
      ),
    );
  }

  return {
    empty: false as const,
    where: conditions.length ? and(...conditions) : undefined,
  };
}

export async function searchCatalog(filters: SearchFilters): Promise<{
  items: ItemCardRecord[];
  total: number;
  modeUsed: "keyword" | "hybrid";
  semanticAvailable: boolean;
}> {
  const db = getDb();
  const built = await catalogConditions(filters);
  if (built.empty) {
    return { items: [], total: 0, modeUsed: "keyword", semanticAvailable: false };
  }
  const where = built.where;

  let queryVector: number[] | null = null;
  let semanticAvailable = false;
  if (filters.q && (filters.mode === "semantic" || filters.mode === "hybrid")) {
    try {
      queryVector = await getEmbeddingProvider().embedText(filters.q);
      semanticAvailable = true;
    } catch (error) {
      if (!(error instanceof EmbeddingNotConfiguredError)) throw error;
      semanticAvailable = false;
    }
  }

  const useHybrid = hybridReady(Boolean(queryVector), filters.mode ?? "keyword");

  if (useHybrid && queryVector) {
    const distance = cosineDistance(embeddings.textEmbedding, queryVector);
    const ranked = await db
      .select({
        id: items.id,
        distance,
      })
      .from(items)
      .leftJoin(embeddings, eq(embeddings.itemId, items.id))
      .where(where)
      .orderBy(sql`${distance} asc nulls last`, desc(items.discoveredAt))
      .limit(filters.limit ?? 48)
      .offset(filters.offset ?? 0);

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(where);
    const ids = ranked.map((row) => row.id);
    const records = ids.length
      ? await db.query.items.findMany({
          where: inArray(items.id, ids),
          with: {
            source: true,
            creator: true,
            primaryCategory: true,
            tags: { with: { tag: true } },
            media: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
          },
        })
      : [];
    const byId = new Map(records.map((record) => [record.id, record]));
    return {
      items: ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((row) => cardFromRow(row as Parameters<typeof cardFromRow>[0])),
      total: countRows[0]?.count ?? 0,
      modeUsed: "hybrid",
      semanticAvailable: true,
    };
  }

  const [rows, countRows] = await Promise.all([
    db.query.items.findMany({
      where,
      with: {
        source: true,
        creator: true,
        primaryCategory: true,
        tags: { with: { tag: true } },
        media: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
      },
      orderBy: [desc(items.discoveredAt), asc(items.name)],
      limit: filters.limit ?? 48,
      offset: filters.offset ?? 0,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(items).where(where),
  ]);

  return {
    items: rows.map((row) => cardFromRow(row as Parameters<typeof cardFromRow>[0])),
    total: countRows[0]?.count ?? 0,
    modeUsed: "keyword",
    semanticAvailable,
  };
}

export async function getItemBySlug(slug: string) {
  const db = getDb();
  const item = await db.query.items.findFirst({
    where: eq(items.slug, slug),
    with: {
      source: true,
      creator: true,
      primaryCategory: true,
      tags: { with: { tag: true } },
      media: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
      variants: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
    },
  });
  if (!item) return null;

  const [builtFromLinks, usedInLinks] = await Promise.all([
    db.query.itemParts.findMany({
      where: eq(itemParts.parentItemId, item.id),
      with: { child: { columns: { slug: true, name: true, kind: true } } },
    }),
    db.query.itemParts.findMany({
      where: eq(itemParts.childItemId, item.id),
      with: { parent: { columns: { slug: true, name: true, kind: true } } },
    }),
  ]);

  return {
    ...item,
    tags: item.tags.map((entry) => entry.tag),
    builtFrom: builtFromLinks.map((link) => link.child),
    usedIn: usedInLinks.map((link) => link.parent),
  };
}

export async function getCategoryByPath(slugs: string[]) {
  const leaf = slugs.at(-1);
  if (!leaf) return null;
  const db = getDb();
  return db.query.categories.findFirst({
    where: eq(categories.slug, leaf),
  });
}

export async function listFrameworks() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ framework: items.framework })
    .from(items)
    .orderBy(asc(items.framework));
  return rows.map((row) => row.framework).filter(Boolean);
}

export async function listCreatorFacets(filters: SearchFilters): Promise<CreatorFacet[]> {
  const db = getDb();
  const built = await catalogConditions(filters, { omitCreators: true });
  if (built.empty) return [];
  const rows = await db
    .select({
      slug: creators.slug,
      name: creators.name,
      xHandle: creators.xHandle,
      count: sql<number>`count(*)::int`,
    })
    .from(items)
    .innerJoin(creators, eq(creators.id, items.creatorId))
    .where(built.where)
    .groupBy(creators.id, creators.slug, creators.name, creators.xHandle)
    .orderBy(desc(sql`count(*)`), asc(creators.name));
  return rows;
}

export async function listCreators() {
  const db = getDb();
  const rows = await db
    .select({
      id: creators.id,
      slug: creators.slug,
      name: creators.name,
      xHandle: creators.xHandle,
      website: creators.website,
      avatarUrl: creators.avatarUrl,
      count: sql<number>`count(${items.id})::int`,
    })
    .from(creators)
    .innerJoin(items, eq(items.creatorId, creators.id))
    .groupBy(
      creators.id,
      creators.slug,
      creators.name,
      creators.xHandle,
      creators.website,
      creators.avatarUrl,
    )
    .orderBy(desc(sql`count(${items.id})`), asc(creators.name));
  return rows;
}

export async function getCreatorBySlug(slug: string) {
  const db = getDb();
  return db.query.creators.findFirst({
    where: eq(creators.slug, slug),
  });
}

export async function relatedItems(itemId: string, categoryId: string, take = 6) {
  const db = getDb();
  const rows = await db.query.items.findMany({
    where: and(eq(items.primaryCategoryId, categoryId), sql`${items.id} <> ${itemId}`),
    with: {
      source: true,
      creator: true,
      primaryCategory: true,
      tags: { with: { tag: true } },
      media: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
    },
    orderBy: [desc(items.discoveredAt)],
    limit: take,
  });
  return rows.map((row) => cardFromRow(row as Parameters<typeof cardFromRow>[0]));
}

