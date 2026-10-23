import { DEFAULT_LIMIT, type SearchFilters } from "@/lib/catalog/search";

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.framework) params.set("framework", filters.framework);
  if (filters.pricing) params.set("pricing", filters.pricing);
  if (filters.access) params.set("access", filters.access);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.library) params.set("library", filters.library);
  if (filters.tags?.length) params.set("tag", filters.tags.join(","));
  if (filters.creators?.length) params.set("creator", filters.creators.join(","));
  if (filters.mode && filters.mode !== "keyword") params.set("mode", filters.mode);
  if (filters.limit && filters.limit !== DEFAULT_LIMIT) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  return params;
}

export function hrefWithFilters(pathname: string, filters: SearchFilters): string {
  const params = filtersToParams(filters);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
