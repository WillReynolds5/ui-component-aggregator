import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PreviewMedia } from "@/components/preview-media";
import type { ItemCardRecord } from "@/db/queries";

function pricingLabel(pricing: ItemCardRecord["pricing"]) {
  if (pricing === "paid") return "Paid";
  if (pricing === "freemium") return "Freemium";
  return "Free";
}

export function ItemCard({ item }: { item: ItemCardRecord }) {
  const preview =
    item.media.find((entry) => entry.kind === "image") ??
    item.media.find((entry) => entry.kind === "video") ??
    item.media[0];

  return (
    <article className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-sm">
      <Link
        href={`/items/${item.slug}`}
        className="group block outline-none ring-offset-background focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PreviewMedia
          name={item.name}
          url={preview?.url}
          kind={preview?.kind}
        />
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <h2 className="line-clamp-1 text-sm font-medium leading-tight group-hover:underline">
            {item.name}
          </h2>
          <Badge variant={item.pricing === "paid" ? "secondary" : "outline"}>
            {pricingLabel(item.pricing)}
          </Badge>
        </div>
      </Link>
      <p className="line-clamp-1 px-3 pt-1 pb-3 text-xs text-muted-foreground">
        {item.creator ? (
          <Link
            href={`/creators/${item.creator.slug}`}
            className="hover:text-foreground hover:underline"
          >
            {item.creator.xHandle ? `@${item.creator.xHandle}` : item.creator.name}
          </Link>
        ) : (
          "Unknown"
        )}
        <span className="mx-1.5 text-border">·</span>
        {item.source.name}
      </p>
    </article>
  );
}
