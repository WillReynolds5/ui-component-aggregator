import Link from "next/link";
import { ArrowUpRightIcon, Maximize2Icon } from "lucide-react";
import { CreatorAvatar } from "@/components/creator-avatar";
import { LivePreview } from "@/components/live-preview";
import { PreviewMedia } from "@/components/preview-media";
import type { ItemCardRecord } from "@/db/queries";
import { demoUrl, pickPreview, pickRender } from "@/lib/catalog/preview";

const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export function isNew(discoveredAt: Date, now = Date.now()) {
  return now - discoveredAt.getTime() < NEW_FOR_MS;
}

export function pricingLabel(pricing: ItemCardRecord["pricing"]) {
  if (pricing === "paid") return "Paid";
  if (pricing === "freemium") return "Freemium";
  return "Free";
}

export function ItemCard({ item, priority = false }: { item: ItemCardRecord; priority?: boolean }) {
  const preview = pickPreview(item.media);
  const render = pickRender(item.media);
  const site = demoUrl(item.media, item.sourceUrl);
  const creatorLabel = item.creator
    ? item.creator.xHandle
      ? `@${item.creator.xHandle}`
      : item.creator.name
    : item.source.name;
  const href = `/items/${item.slug}`;

  return (
    <article className="group relative">
      {render ? (
        // Live components take clicks themselves; the name and the expand button open the item.
        <LivePreview
          src={render.url}
          poster={preview?.url}
          title={item.name}
          className="aspect-[4/3] rounded-2xl transition duration-300 group-hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)]"
        />
      ) : (
        <Link
          href={href}
          scroll={false}
          className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PreviewMedia
            name={item.name}
            imageUrl={preview?.url}
            siteUrl={site}
            priority={priority}
            className="aspect-[4/3] rounded-2xl transition duration-300 group-hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-[1.03]"
          />
          <span className="sr-only">Open {item.name}</span>
        </Link>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
        <div className="flex gap-1">
          {render ? null : isNew(item.discoveredAt) ? <TileBadge>New</TileBadge> : null}
          {item.pricing !== "free" ? <TileBadge>{pricingLabel(item.pricing)}</TileBadge> : null}
        </div>
        {render ? (
          <Link
            href={href}
            scroll={false}
            aria-label={`Expand ${item.name}`}
            className="pointer-events-auto grid size-8 translate-y-1 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 hover:bg-background focus-visible:opacity-100"
          >
            <Maximize2Icon className="size-3.5" />
          </Link>
        ) : site ? (
          <a
            href={site}
            target="_blank"
            rel="noreferrer"
            aria-label={`Visit ${item.name}`}
            className="pointer-events-auto grid size-8 translate-y-1 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 hover:bg-background focus-visible:opacity-100"
          >
            <ArrowUpRightIcon className="size-4" />
          </a>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-2.5 px-0.5">
        <CreatorAvatar name={item.creator?.name ?? item.source.name} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            scroll={false}
            className="block truncate text-sm font-medium leading-tight hover:underline"
          >
            {item.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {item.library ? (
              <Link href={`/items/${item.library.slug}`} scroll={false} className="hover:text-foreground">
                {item.library.name}
              </Link>
            ) : item.creator ? (
              <Link href={`/creators/${item.creator.slug}`} className="hover:text-foreground">
                {creatorLabel}
              </Link>
            ) : (
              creatorLabel
            )}
            <span className="mx-1 text-muted-foreground/50">·</span>
            <Link href={`/categories/${item.primaryCategory.slug}`} className="hover:text-foreground">
              {item.primaryCategory.name}
            </Link>
          </p>
        </div>
      </div>
    </article>
  );
}

function TileBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur">
      {children}
    </span>
  );
}
