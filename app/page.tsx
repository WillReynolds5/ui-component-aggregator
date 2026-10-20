import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { BrowseResults } from "@/components/browse-results";
import { CatalogShell } from "@/components/catalog-shell";
import { loadBrowse } from "@/db/browse";
import { parseSearchParams } from "@/lib/catalog/search";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeBrowse searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeBrowse({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const params = await searchParams;
  const filters = parseSearchParams(params);
  const { categories, tags, frameworks, creators, results } = await loadBrowse(filters);

  return (
    <CatalogShell categories={categories} filters={filters}>
      <BrowseResults
        filters={filters}
        items={results.items}
        total={results.total}
        tags={tags}
        frameworks={frameworks}
        creators={creators}
        heading={filters.q ? `Results for “${filters.q}”` : "Browse the catalog"}
        modeUsed={results.modeUsed}
      />
    </CatalogShell>
  );
}

function HomeFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <BrowseSkeleton />
    </div>
  );
}
