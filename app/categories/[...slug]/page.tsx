import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { BrowseResults } from "@/components/browse-results";
import { CatalogShell } from "@/components/catalog-shell";
import { loadBrowse } from "@/db/browse";
import { getCategoryByPath } from "@/db/queries";
import { parseSearchParams } from "@/lib/catalog/search";

type CategoryPageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <CategoryBrowse params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoryBrowse({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await getCategoryByPath(slug);
  if (!category) notFound();

  const filters = parseSearchParams({ ...query, category: category.slug });
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
        pathname={`/categories/${slug.join("/")}`}
        heading={category.name}
        modeUsed={results.modeUsed}
      />
      {category.description ? (
        <p className="-mt-2 text-sm text-muted-foreground">{category.description}</p>
      ) : null}
    </CatalogShell>
  );
}
