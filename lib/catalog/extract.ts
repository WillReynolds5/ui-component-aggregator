/**
 * Turn a library item into one catalog item per component in its shadcn registry.
 * Building and verifying the render happens in the caller (scripts/extract-components.ts),
 * which owns the browser; this module owns the catalog side.
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { enumEq } from "@/db/enum";
import { categories, items, media, mediaKindEnum, mediaSourceEnum } from "@/drizzle/schema";
import {
  displayName,
  fetchJson,
  findRegistry,
  isGlobalStyle,
  type Registry,
  type RegistryEntry,
} from "@/lib/catalog/registry";
import { fetchSitemapUrls } from "@/lib/catalog/component-pages";
import { slugify, slugifyUnique } from "@/lib/catalog/slug";

export type LibraryRecord = {
  id: string;
  slug: string;
  name: string;
  homepage: string;
  sourceId: string;
  creatorId: string | null;
  discoveredViaPostUrl: string | null;
  discoveredAt: Date;
};

/**
 * Library items (category "libraries") with a homepage, one per site: the catalog has a few
 * duplicates (two X posts about the same library), and components should attach to one.
 */
export async function findLibraries(onlySlugs?: string[]): Promise<LibraryRecord[]> {
  const db = getDb();
  const [libraries] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "libraries"));
  if (!libraries) return [];
  // Only library items, filtered in SQL (all items with media would outgrow the Data API cap).
  const rows = await db.query.items.findMany({
    where: and(eq(items.primaryCategoryId, libraries.id), isNull(items.libraryItemId)),
    columns: {
      id: true,
      slug: true,
      name: true,
      sourceUrl: true,
      sourceId: true,
      creatorId: true,
      discoveredViaPostUrl: true,
      discoveredAt: true,
    },
    with: {
      media: { columns: { kind: true, url: true } },
      source: { columns: { homepage: true } },
    },
    orderBy: (table, { asc }) => [asc(table.slug)],
  });

  const byHost = new Map<string, LibraryRecord>();
  for (const row of rows) {
    if (onlySlugs?.length && !onlySlugs.includes(row.slug)) continue;
    const homepage =
      row.media.find((entry) => entry.kind === "demo_url")?.url ?? row.source.homepage ?? row.sourceUrl;
    let host: string;
    try {
      host = new URL(homepage).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (byHost.has(host)) continue;
    byHost.set(host, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      homepage: `https://${host}`,
      sourceId: row.sourceId,
      creatorId: row.creatorId,
      discoveredViaPostUrl: row.discoveredViaPostUrl,
      discoveredAt: row.discoveredAt,
    });
  }
  return [...byHost.values()];
}

export type LibraryRegistry = {
  registry: Registry;
  /** Full entries (with file contents) for the registry's token / theme items. */
  globalStyles: RegistryEntry[];
  /** The site's sitemap, for each component's own docs page. */
  pages: string[];
};

export async function loadLibraryRegistry(library: LibraryRecord): Promise<LibraryRegistry | null> {
  const registry = await findRegistry(library.homepage);
  if (!registry) return null;
  const globalStyles = await Promise.all(
    registry.entries
      .filter((entry) => entry.type === "registry:item" || entry.type === "registry:style" || entry.type === "registry:theme")
      .map((entry) => fetchJson<RegistryEntry>(registry.itemUrl(entry.name)).catch(() => null)),
  );
  return {
    registry,
    globalStyles: globalStyles.filter((entry): entry is RegistryEntry => entry !== null && isGlobalStyle(entry)),
    pages: await fetchSitemapUrls(library.homepage),
  };
}

const categoryIds = new Map<string, string>();

async function categoryId(slug: string) {
  if (!categoryIds.size) {
    const rows = await getDb().select({ id: categories.id, slug: categories.slug }).from(categories);
    for (const row of rows) categoryIds.set(row.slug, row.id);
  }
  const id = categoryIds.get(slug) ?? categoryIds.get("other");
  if (!id) throw new Error(`Unknown category ${slug}; seed the taxonomy first`);
  return id;
}

export type ExtractedComponent = {
  library: LibraryRecord;
  entry: RegistryEntry;
  itemUrl: string;
  categorySlug: string;
  code: string;
  dependencies: string[];
  renderUrl: string;
  posterUrl: string;
  /** The component's own docs page; the library homepage when none was found. */
  pageUrl: string;
};

/** Create or update the component's item (keyed on its registry URL) and its media. */
export async function upsertComponent(component: ExtractedComponent): Promise<{ slug: string; created: boolean }> {
  const db = getDb();
  const { library, entry } = component;
  const name = displayName(entry);
  const payload = {
    kind: entry.type === "registry:block" ? ("block" as const) : ("component" as const),
    name,
    description: entry.description?.trim() || `${name} from ${library.name}.`,
    framework: "react",
    styling: "tailwind",
    dependencies: component.dependencies,
    pricing: "free" as const,
    access: "full_code" as const,
    code: component.code,
    installCommand: `npx shadcn@latest add ${component.itemUrl}`,
    sourceUrl: component.itemUrl,
    sourceId: library.sourceId,
    creatorId: library.creatorId,
    discoveredViaPostUrl: library.discoveredViaPostUrl,
    primaryCategoryId: await categoryId(component.categorySlug),
    // Inherit the library's date so a fresh extraction doesn't flood "New".
    discoveredAt: library.discoveredAt,
    libraryItemId: library.id,
    registryUrl: component.itemUrl,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: items.id, slug: items.slug })
    .from(items)
    .where(eq(items.registryUrl, component.itemUrl));

  let itemId: string;
  let slug: string;
  if (existing) {
    await db.update(items).set(payload).where(eq(items.id, existing.id));
    itemId = existing.id;
    slug = existing.slug;
  } else {
    const taken = await db.select({ slug: items.slug }).from(items);
    slug = slugifyUnique(`${slugify(library.name)}-${entry.name}`, new Set(taken.map((row) => row.slug)));
    const [created] = await db.insert(items).values({ ...payload, slug }).returning({ id: items.id });
    itemId = created.id;
  }

  await db
    .delete(media)
    .where(and(eq(media.itemId, itemId), enumEq(media.source, "capture", mediaSourceEnum)));
  await db.insert(media).values([
    { itemId, kind: "render", source: "capture", url: component.renderUrl, alt: `${name} live preview`, sortOrder: -2 },
    { itemId, kind: "image", source: "capture", url: component.posterUrl, alt: `${name} preview`, sortOrder: -1 },
    { itemId, kind: "demo_url", source: "capture", url: component.pageUrl, alt: `${name} on ${library.name}`, sortOrder: 0 },
  ]);
  return { slug, created: !existing };
}

/** Drop a component that no longer builds or renders, so the grid never shows a dead card. */
export async function removeComponent(itemUrl: string) {
  await getDb().delete(items).where(eq(items.registryUrl, itemUrl));
}

/** Registry URLs already extracted for these libraries (to skip unless --force). */
export async function extractedUrls(libraryIds: string[]): Promise<Set<string>> {
  if (!libraryIds.length) return new Set();
  const rows = await getDb()
    .select({ url: items.registryUrl })
    .from(items)
    .innerJoin(media, eq(media.itemId, items.id))
    .where(
      and(
        inArray(items.libraryItemId, libraryIds),
        isNotNull(items.registryUrl),
        enumEq(media.kind, "render", mediaKindEnum),
      ),
    );
  return new Set(rows.map((row) => row.url!));
}

/** Point an extracted component's "Visit site" at its own page (no rebuild needed). */
export async function setComponentPage(itemUrl: string, pageUrl: string): Promise<boolean> {
  const db = getDb();
  const [item] = await db.select({ id: items.id }).from(items).where(eq(items.registryUrl, itemUrl));
  if (!item) return false;
  await db
    .update(media)
    .set({ url: pageUrl, updatedAt: new Date() })
    .where(and(eq(media.itemId, item.id), enumEq(media.kind, "demo_url", mediaKindEnum)));
  return true;
}
