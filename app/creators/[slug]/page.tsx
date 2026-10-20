import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { BrowseResults } from "@/components/browse-results";
import { CatalogShell } from "@/components/catalog-shell";
import { loadBrowse } from "@/db/browse";
import { getCreatorBySlug } from "@/db/queries";
import { parseSearchParams } from "@/lib/catalog/search";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const creator = await getCreatorBySlug(slug);
  if (!creator) return { title: "Creator" };
  return {
    title: creator.name,
    description: `Components and blocks by ${creator.name}.`,
  };
}

type CreatorPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CreatorPage({ params, searchParams }: CreatorPageProps) {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <CreatorBrowse params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CreatorBrowse({ params, searchParams }: CreatorPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const creator = await getCreatorBySlug(slug);
  if (!creator) notFound();

  const filters = parseSearchParams({
    ...query,
    creator: slug,
  });
  const { categories, tags, frameworks, results } = await loadBrowse(filters);

  return (
    <CatalogShell categories={categories} filters={filters}>
      <div className="mb-6 space-y-1">
        <p className="text-xs text-muted-foreground">Creator</p>
        <h1 className="text-2xl font-medium tracking-tight">{creator.name}</h1>
        <p className="text-sm text-muted-foreground">
          {creator.xHandle ? (
            <a
              href={`https://x.com/${creator.xHandle}`}
              className="hover:underline"
            >
              @{creator.xHandle}
            </a>
          ) : null}
          {creator.xHandle && creator.website ? (
            <span className="mx-1.5">·</span>
          ) : null}
          {creator.website ? (
            <a href={creator.website} className="hover:underline">
              {creator.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </p>
      </div>
      <BrowseResults
        filters={filters}
        items={results.items}
        total={results.total}
        tags={tags}
        frameworks={frameworks}
        creators={[]}
        pathname={`/creators/${slug}`}
        heading={`${results.total} ${results.total === 1 ? "item" : "items"}`}
        modeUsed={results.modeUsed}
      />
    </CatalogShell>
  );
}
