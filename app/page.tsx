import { Suspense } from "react";
import { BrowseResults } from "@/components/browse-results";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { loadBrowse, loadNav } from "@/db/browse";
import { parseSearchParams } from "@/lib/catalog/search";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <HomeBrowse searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeBrowse({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseSearchParams(await searchParams);
  const [{ tags, frameworks, creators, results }, nav] = await Promise.all([
    loadBrowse(filters),
    loadNav(),
  ]);

  return (
    <BrowseResults
      filters={filters}
      items={results.items}
      total={results.total}
      tags={tags}
      frameworks={frameworks}
      creators={creators}
      heading={filters.q ? `Results for “${filters.q}”` : "Discover"}
      description={
        filters.q
          ? undefined
          : "The newest UI components, blocks, and libraries shared on X, collected around the clock."
      }
      aside={
        filters.q ? undefined : (
          <dl className="flex gap-6 text-sm">
            <Stat label="In the catalog" value={nav.total} />
            <Stat label="This week" value={nav.newThisWeek} live />
          </dl>
        )
      }
      modeUsed={results.modeUsed}
    />
  );
}

function Stat({ label, value, live = false }: { label: string; value: number; live?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {live ? (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
        ) : null}
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}
