import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrowseResults } from "@/components/browse-results";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { loadBrowse, loadNav } from "@/db/browse";
import { getCategoryByPath } from "@/db/queries";
import { categoryTrail } from "@/lib/catalog/category-tree";
import { parseSearchParams } from "@/lib/catalog/search";

type CategoryPageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryByPath(slug);
  if (!category) return { title: "Category" };
  return { title: category.name, description: category.description ?? undefined };
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <CategoryBrowse params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoryBrowse({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await getCategoryByPath(slug);
  if (!category) notFound();

  const filters = parseSearchParams({ ...query, category: category.slug });
  const [{ tags, frameworks, creators, results }, nav] = await Promise.all([
    loadBrowse(filters),
    loadNav(),
  ]);
  const trail = categoryTrail(nav.tree, category.slug);
  const node = trail.at(-1);
  const parent = trail.length > 1 ? trail[0] : null;

  return (
    <BrowseResults
      filters={filters}
      items={results.items}
      total={results.total}
      tags={tags}
      frameworks={frameworks}
      creators={creators}
      pathname={`/categories/${category.slug}`}
      eyebrow={
        parent ? (
          <Link href={`/categories/${parent.slug}`} className="hover:text-foreground">
            {parent.name}
          </Link>
        ) : (
          "Category"
        )
      }
      heading={category.name}
      description={category.description}
      aside={
        node && node.children.length ? (
          <nav aria-label={`${category.name} types`} className="flex max-w-xl flex-wrap justify-end gap-1.5">
            {node.children.map((child) => (
              <Link
                key={child.id}
                href={`/categories/${child.slug}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] hover:bg-muted/70"
              >
                {child.name}
                {child.count ? <span className="text-xs text-muted-foreground tabular-nums">{child.count}</span> : null}
              </Link>
            ))}
          </nav>
        ) : undefined
      }
      modeUsed={results.modeUsed}
    />
  );
}
