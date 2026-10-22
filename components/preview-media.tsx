import { cn } from "cn";
import { hostLabel } from "@/lib/catalog/mapping";

const TINTS = [
  "from-violet-200/70 via-fuchsia-100/60 to-white dark:from-violet-500/25 dark:via-fuchsia-500/10 dark:to-transparent",
  "from-sky-200/70 via-cyan-100/60 to-white dark:from-sky-500/25 dark:via-cyan-500/10 dark:to-transparent",
  "from-emerald-200/70 via-teal-100/60 to-white dark:from-emerald-500/25 dark:via-teal-500/10 dark:to-transparent",
  "from-amber-200/70 via-orange-100/60 to-white dark:from-amber-500/25 dark:via-orange-500/10 dark:to-transparent",
  "from-rose-200/70 via-pink-100/60 to-white dark:from-rose-500/25 dark:via-pink-500/10 dark:to-transparent",
  "from-zinc-200/80 via-zinc-100/60 to-white dark:from-zinc-500/25 dark:via-zinc-500/10 dark:to-transparent",
];

export function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

/**
 * The tile image. With no screenshot yet, a typographic poster so the grid still reads as
 * designed rather than broken.
 */
export function PreviewMedia({
  name,
  imageUrl,
  siteUrl,
  className,
  priority = false,
  sizes = "card",
}: {
  name: string;
  imageUrl?: string | null;
  siteUrl?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: "card" | "hero";
}) {
  return (
    <div className={cn("relative overflow-hidden bg-tile", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${name} preview`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover object-top"
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br px-6 text-center",
            tintFor(name),
          )}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:16px_16px] text-foreground/20 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          />
          <span
            className={cn(
              "relative line-clamp-2 font-semibold tracking-tight text-foreground/85",
              sizes === "hero" ? "text-4xl sm:text-5xl" : "text-xl",
            )}
          >
            {name}
          </span>
          {siteUrl ? (
            <span
              className={cn(
                "relative mt-2 rounded-full bg-background/70 px-2.5 py-0.5 font-mono text-muted-foreground backdrop-blur",
                sizes === "hero" ? "text-sm" : "text-[11px]",
              )}
            >
              {hostLabel(siteUrl)}
            </span>
          ) : null}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5 dark:ring-white/5" />
    </div>
  );
}
