import {
  listCategories,
  listCreatorFacets,
  listFrameworks,
  listTags,
  searchCatalog,
} from "@/db/queries";
import type { SearchFilters } from "@/lib/catalog/search";

export async function loadBrowse(filters: SearchFilters) {
  const [categories, tags, frameworks, creators, results] = await Promise.all([
    listCategories(),
    listTags(),
    listFrameworks(),
    listCreatorFacets(filters),
    searchCatalog(filters),
  ]);
  return { categories, tags, frameworks, creators, results };
}
