import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRightIcon } from "lucide-react";
import { CodeViewer } from "@/components/code-viewer";
import { CopyButton } from "@/components/copy-button";
import { ItemGrid } from "@/components/item-grid";
import { PreviewMedia } from "@/components/preview-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogShell } from "@/components/catalog-shell";
import { getItemBySlug, listCategories, relatedItems } from "@/db/queries";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, categories] = await Promise.all([getItemBySlug(slug), listCategories()]);
  if (!item) notFound();

  const related = await relatedItems(item.id, item.primaryCategoryId);
  const preview =
    item.media.find((entry) => entry.kind === "image") ??
    item.media.find((entry) => entry.kind === "video") ??
    item.media[0];
  const demo = item.media.find((entry) => entry.kind === "demo_url");

  return (
    <CatalogShell
      categories={categories}
      filters={{ categorySlug: item.primaryCategory.slug }}
    >
      <article className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.8fr)]">
          <PreviewMedia
            name={item.name}
            url={preview?.url}
            kind={preview?.kind}
            className="rounded-xl ring-1 ring-foreground/10"
          />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{item.kind}</Badge>
              <Badge variant="outline">{item.framework}</Badge>
              {item.styling ? <Badge variant="outline">{item.styling}</Badge> : null}
              <Badge variant={item.pricing === "paid" ? "secondary" : "outline"}>
                {item.pricing}
              </Badge>
              <Badge variant="outline">{item.access.replace("_", " ")}</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-medium tracking-tight">{item.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.creator ? (
                  <>
                    <Link
                      href={`/creators/${item.creator.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.creator.xHandle
                        ? `@${item.creator.xHandle}`
                        : item.creator.name}
                    </Link>
                    <span className="mx-1.5">·</span>
                  </>
                ) : null}
                {item.source.homepage ? (
                  <a
                    href={item.source.homepage}
                    className="underline-offset-2 hover:underline"
                  >
                    {item.source.name}
                  </a>
                ) : (
                  item.source.name
                )}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button render={<a href={item.sourceUrl} target="_blank" rel="noreferrer" />}>
                View source
                <ArrowUpRightIcon />
              </Button>
              {demo ? (
                <Button
                  variant="outline"
                  render={<a href={demo.url} target="_blank" rel="noreferrer" />}
                >
                  Open demo
                </Button>
              ) : null}
              {item.source.repoUrl ? (
                <Button
                  variant="outline"
                  render={
                    <a href={item.source.repoUrl} target="_blank" rel="noreferrer" />
                  }
                >
                  GitHub
                </Button>
              ) : null}
              {item.discoveredViaPostUrl ? (
                <Button
                  variant="ghost"
                  render={
                    <a href={item.discoveredViaPostUrl} target="_blank" rel="noreferrer" />
                  }
                >
                  X post
                </Button>
              ) : null}
            </div>
            {item.installCommand ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
                <code className="truncate font-mono text-xs">{item.installCommand}</code>
                <CopyButton value={item.installCommand} label="Install" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Link key={tag.slug} href={`/?tag=${tag.slug}`}>
                  <Badge variant="secondary">{tag.name}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {item.code ? <CodeViewer code={item.code} /> : (
          <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No inlined code for this item. Use View source
            {item.installCommand ? " or the install command" : ""}.
          </p>
        )}

        {item.variants.length ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Variants</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {item.variants.map((variant) => (
                <li key={variant.id} className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">{variant.name}</p>
                  {variant.description ? (
                    <p className="text-muted-foreground">{variant.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <RelationList title="Built from" items={item.builtFrom} empty="No child components linked yet." />
          <RelationList title="Used in" items={item.usedIn} empty="Not referenced by another block yet." />
        </div>

        {related.length ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">More in {item.primaryCategory.name}</h2>
            <ItemGrid items={related} />
          </section>
        ) : null}
      </article>
    </CatalogShell>
  );
}

function RelationList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ slug: string; name: string; kind: string }>;
  empty: string;
}) {
  return (
    <section className="rounded-xl border px-4 py-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((entry) => (
            <li key={entry.slug}>
              <Link href={`/items/${entry.slug}`} className="hover:underline">
                {entry.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">{entry.kind}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
