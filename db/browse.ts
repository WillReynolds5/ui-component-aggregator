import { cache } from "react";
import { connection } from "next/server";
import {
  countItems,
  listCategories,
  listCategoryCounts,
  listCreatorFacets,
  listFrameworks,
  listTags,
  searchCatalog,
} from "@/db/queries";
import { buildCategoryTree } from "@/lib/catalog/category-tree";
import type { SearchFilters } from "@/lib/catalog/search";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sidebar + header data. `cache` dedupes it within one request, so the desktop sidebar,
 * the mobile sheet, and a page can all call it. `connection()` marks the read as
 * request-time: the RDS Data API client generates random ids, which Next refuses to
 * run while prerendering.
 */
export const loadNav = cache(async () => {
  await connection();
  const [categories, counts, total, newThisWeek] = await Promise.all([
    listCategories(),
    listCategoryCounts(),
    countItems(),
    countItems(new Date(Date.now() - WEEK_MS)),
  ]);
  return { tree: buildCategoryTree(categories, counts), total, newThisWeek };
});

export async function loadBrowse(filters: SearchFilters) {
  await connection();
  const [tags, frameworks, creators, results] = await Promise.all([
    listTags(),
    listFrameworks(),
    listCreatorFacets(filters),
    searchCatalog(filters),
  ]);
  return { tags, frameworks, creators, results };
}
