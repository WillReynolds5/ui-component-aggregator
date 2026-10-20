import { FilterBar } from "@/components/filter-bar";
import { ItemGrid } from "@/components/item-grid";
import { SearchBar } from "@/components/search-bar";
import type { CreatorFacet, ItemCardRecord } from "@/db/queries";
import type { SearchFilters } from "@/lib/catalog/search";

export function BrowseResults({
  filters,
  items,
  total,
  tags,
  frameworks,
  creators = [],
  pathname = "/",
  heading,
  modeUsed,
}: {
  filters: SearchFilters;
  items: ItemCardRecord[];
  total: number;
  tags: Array<{ slug: string; name: string }>;
  frameworks: string[];
  creators?: CreatorFacet[];
  pathname?: string;
  heading: string;
  modeUsed: "keyword" | "hybrid";
}) {
  return (
    <div className="min-w-0 space-y-6">
      <SearchBar filters={filters} pathname={pathname} autoFocus={pathname === "/"} />
      <FilterBar
        filters={filters}
        tags={tags}
        frameworks={frameworks}
        creators={creators}
        pathname={pathname}
      />
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-medium tracking-tight">{heading}</h1>
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? "item" : "items"}
          {filters.q ? ` · ${modeUsed} search` : ""}
        </p>
      </div>
      <ItemGrid items={items} />
    </div>
  );
}
