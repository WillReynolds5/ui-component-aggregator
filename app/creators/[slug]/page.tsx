import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { BrowseResults } from "@/components/browse-results";
import { BrowseSkeleton } from "@/components/browse-skeleton";
import { CreatorAvatar } from "@/components/creator-avatar";
import { loadBrowse } from "@/db/browse";
import { getCreatorBySlug } from "@/db/queries";
import { parseSearchParams } from "@/lib/catalog/search";

type CreatorPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const creator = await getCreatorBySlug(slug);
  if (!creator) return { title: "Creator" };
  return {
    title: creator.name,
    description: `Components, blocks, and libraries by ${creator.name}.`,
  };
}

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

  const filters = parseSearchParams({ ...query, creator: slug });
  const { tags, frameworks, results } = await loadBrowse(filters);
  const links = [
    creator.xHandle ? { label: `@${creator.xHandle}`, href: `https://x.com/${creator.xHandle}` } : null,
    creator.website
      ? { label: creator.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: creator.website }
      : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  return (
    <BrowseResults
      filters={filters}
      items={results.items}
      total={results.total}
      tags={tags}
      frameworks={frameworks}
      creators={[]}
      pathname={`/creators/${slug}`}
      lockedCreator={slug}
      eyebrow="Creator"
      heading={
        <span className="flex items-center gap-4">
          <CreatorAvatar name={creator.name} size="lg" />
          {creator.name}
        </span>
      }
      description={
        links.length ? (
          <span className="flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[13px] text-foreground hover:bg-muted/70"
              >
                {link.label}
                <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />
              </a>
            ))}
          </span>
        ) : undefined
      }
      modeUsed={results.modeUsed}
    />
  );
}
