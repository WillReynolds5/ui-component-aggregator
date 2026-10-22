import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon, CodeIcon, TerminalIcon } from "lucide-react";
import { CodeViewer } from "@/components/code-viewer";
import { CopyButton } from "@/components/copy-button";
import { CreatorAvatar } from "@/components/creator-avatar";
import { isNew, pricingLabel } from "@/components/item-card";
import { ItemGrid } from "@/components/item-grid";
import { LivePreview } from "@/components/live-preview";
import { PreviewMedia } from "@/components/preview-media";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LoadedItem } from "@/db/item";
import { hostLabel } from "@/lib/catalog/mapping";
import { demoUrl, pickPreview, pickRender } from "@/lib/catalog/preview";

const ACCESS_LABEL = {
  full_code: "Full source",
  install_only: "Install command",
  link_only: "Link only",
} as const;

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The scrape stores "<post text>\n\nExtraction: <note>"; show them separately. */
function splitDescription(description: string) {
  const [post, note] = description.split(/\n\nExtraction: /);
  return { post: post.trim(), note: note?.trim() || null };
}

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
          >
            {part.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function ItemDetail({ data, inModal = false }: { data: LoadedItem; inModal?: boolean }) {
  const { item, related, components, trail } = data;
  const preview = pickPreview(item.media);
  const render = pickRender(item.media);
  const site = demoUrl(item.media, item.sourceUrl);
  const { post, note } = splitDescription(item.description);
  const creatorLabel = item.creator?.xHandle ? `@${item.creator.xHandle}` : item.creator?.name;

  return (
    <article className={inModal ? "px-5 pt-2 pb-10 sm:px-8" : "mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-8"}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {trail.map((node, index) => (
          <span key={node.id} className="flex items-center gap-1">
            {index > 0 ? <ChevronRightIcon className="size-3.5 opacity-50" /> : null}
            <Link href={`/categories/${node.slug}`} className="hover:text-foreground">
              {node.name}
            </Link>
          </span>
        ))}
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {item.name}
            {isNew(item.discoveredAt) ? (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium tracking-normal text-emerald-700 dark:text-emerald-300">
                New
              </span>
            ) : null}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {item.creator ? (
              <Link href={`/creators/${item.creator.slug}`} className="flex items-center gap-2 text-foreground hover:underline">
                <CreatorAvatar name={item.creator.name} size="sm" />
                {creatorLabel}
              </Link>
            ) : null}
            {item.library ? (
              <Link href={`/items/${item.library.slug}`} className="hover:text-foreground">
                Part of {item.library.name}
              </Link>
            ) : null}
            {item.source.homepage ? (
              <a href={item.source.homepage} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {hostLabel(item.source.homepage) ?? item.source.name}
              </a>
            ) : (
              <span>{item.source.name}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.discoveredViaPostUrl ? (
            <Button variant="outline" size="lg" nativeButton={false} className="rounded-full px-4" render={<a href={item.discoveredViaPostUrl} target="_blank" rel="noreferrer" />}>
              View on X
            </Button>
          ) : null}
          {item.source.repoUrl ? (
            <Button variant="outline" size="lg" nativeButton={false} className="rounded-full px-4" render={<a href={item.source.repoUrl} target="_blank" rel="noreferrer" />}>
              <CodeIcon />
              Source
            </Button>
          ) : null}
          {site ? (
            <Button size="lg" nativeButton={false} className="rounded-full px-4" render={<a href={site} target="_blank" rel="noreferrer" />}>
              Visit site
              <ArrowUpRightIcon />
            </Button>
          ) : null}
        </div>
      </header>

      {render ? (
        <div className="mt-6">
          <LivePreview
            src={render.url}
            poster={preview?.url}
            title={item.name}
            eager
            className="aspect-[16/10] rounded-2xl"
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Live component. Click, hover, and type to try it.
          </p>
        </div>
      ) : (
        <a
          href={site ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="group relative mt-6 block overflow-hidden rounded-2xl"
        >
          <PreviewMedia
            name={item.name}
            imageUrl={preview?.url}
            siteUrl={site}
            priority
            sizes="hero"
            className="aspect-[16/10] rounded-2xl"
          />
          {site ? (
            <span className="absolute right-4 bottom-4 inline-flex translate-y-1 items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-[13px] font-medium opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">
              Open {hostLabel(site)}
              <ArrowUpRightIcon className="size-3.5" />
            </span>
          ) : null}
        </a>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          {item.installCommand ? (
            <section>
              <SectionTitle>Install</SectionTitle>
              <div className="mt-3 flex items-center gap-3 rounded-xl border bg-surface py-2 pr-2 pl-3.5">
                <TerminalIcon className="size-4 shrink-0 text-muted-foreground" />
                <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{item.installCommand}</code>
                <CopyButton value={item.installCommand} />
              </div>
            </section>
          ) : null}

          {post ? (
            <section>
              <SectionTitle>
                {item.discoveredViaPostUrl && !item.libraryItemId ? "From the post on X" : "About"}
              </SectionTitle>
              <blockquote className="mt-3 rounded-xl border-l-2 border-foreground/15 bg-surface py-4 pr-5 pl-5 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/85">
                <Linkified text={post} />
              </blockquote>
            </section>
          ) : null}

          {item.code ? <CodeViewer code={item.code} /> : null}

          {item.variants.length ? (
            <section>
              <SectionTitle>Variants</SectionTitle>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.variants.map((variant) => (
                  <li key={variant.id} className="rounded-xl border px-4 py-3 text-sm">
                    <p className="font-medium">{variant.name}</p>
                    {variant.description ? <p className="mt-0.5 text-muted-foreground">{variant.description}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.builtFrom.length || item.usedIn.length ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <RelationList title="Built from" items={item.builtFrom} />
              <RelationList title="Used in" items={item.usedIn} />
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <dl className="divide-y rounded-xl border text-sm">
            <Detail label="Category">
              <Link href={`/categories/${item.primaryCategory.slug}`} className="hover:underline">
                {item.primaryCategory.name}
              </Link>
            </Detail>
            <Detail label="Type">{item.kind === "block" ? "Block" : "Component"}</Detail>
            <Detail label="Price">{pricingLabel(item.pricing)}</Detail>
            <Detail label="Access">{ACCESS_LABEL[item.access]}</Detail>
            {item.framework !== "unknown" ? <Detail label="Framework">{item.framework}</Detail> : null}
            {item.styling ? <Detail label="Styling">{item.styling}</Detail> : null}
            <Detail label="Found">{DATE.format(item.discoveredAt)}</Detail>
          </dl>
          {note ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              {note.charAt(0).toUpperCase() + note.slice(1)}
            </p>
          ) : null}
          {item.tags.length ? (
            <div>
              <SectionTitle>Style</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/?tag=${tag.slug}`}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {components.length ? (
        <section className="mt-16 border-t pt-10">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Components in {item.name}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">{components.length}</span>
          </div>
          <ItemGrid items={components} dense />
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-16 border-t pt-10">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">More in {item.primaryCategory.name}</h2>
            <Link href={`/categories/${item.primaryCategory.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
              See all
            </Link>
          </div>
          <ItemGrid items={related} dense />
        </section>
      ) : null}
    </article>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-medium text-muted-foreground">{children}</h2>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{children}</dd>
    </div>
  );
}

function RelationList({ title, items }: { title: string; items: Array<{ slug: string; name: string; kind: string }> }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <ul className="mt-3 divide-y rounded-xl border text-sm">
        {items.map((entry) => (
          <li key={entry.slug}>
            <Link href={`/items/${entry.slug}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/60">
              {entry.name}
              <span className="text-xs text-muted-foreground">{entry.kind}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ItemDetailSkeleton({ inModal = false }: { inModal?: boolean }) {
  return (
    <div className={inModal ? "px-5 pt-2 pb-10 sm:px-8" : "mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-8"} aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 flex justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <Skeleton className="mt-6 aspect-[16/10] rounded-2xl" />
    </div>
  );
}
