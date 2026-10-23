import type { ReactNode } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { FilterMenu, type FilterOption } from "@/components/filter-menu";
import { ItemGrid } from "@/components/item-grid";
import type { CreatorFacet, ItemCardRecord } from "@/db/queries";
import { DEFAULT_LIMIT, MAX_LIMIT, type SearchFilters } from "@/lib/catalog/search";
import { hrefWithFilters } from "@/lib/catalog/url";

const PRICING = [
  { value: "free" as const, label: "Free" },
  { value: "freemium" as const, label: "Freemium" },
  { value: "paid" as const, label: "Paid" },
];

const ACCESS = [
  { value: "full_code" as const, label: "Full code" },
  { value: "install_only" as const, label: "Install command" },
  { value: "link_only" as const, label: "Link only" },
];

const KINDS = [
  { value: "component" as const, label: "Components" },
  { value: "block" as const, label: "Blocks" },
];

function toggleList(list: string[] | undefined, value: string) {
  const next = list?.includes(value) ? list.filter((entry) => entry !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

export function BrowseResults({
  filters,
  items,
  total,
  tags,
  frameworks,
  creators = [],
  pathname = "/",
  lockedCreator,
  eyebrow,
  heading,
  description,
  aside,
  modeUsed,
}: {
  filters: SearchFilters;
  items: ItemCardRecord[];
  total: number;
  tags: Array<{ slug: string; name: string }>;
  frameworks: string[];
  creators?: CreatorFacet[];
  pathname?: string;
  /** The creator a creator page is about: always applied, so never shown as a removable filter. */
  lockedCreator?: string;
  eyebrow?: ReactNode;
  heading: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  modeUsed: "keyword" | "hybrid";
}) {
  const base = { ...filters, offset: 0, limit: undefined };
  const href = (next: SearchFilters) => hrefWithFilters(pathname, next);

  const single = <T extends string>(
    key: "pricing" | "access" | "kind",
    choices: Array<{ value: T; label: string }>,
  ): FilterOption[] =>
    choices.map((choice) => {
      const active = filters[key] === choice.value;
      return { label: choice.label, active, href: href({ ...base, [key]: active ? undefined : choice.value }) };
    });

  const frameworkOptions: FilterOption[] = frameworks
    .filter((value) => value !== "unknown")
    .map((value) => {
      const active = filters.framework === value;
      return { label: value, active, href: href({ ...base, framework: active ? undefined : value }) };
    });

  const creatorOptions: FilterOption[] = creators.slice(0, 40).map((creator) => ({
    label: creator.xHandle ? `@${creator.xHandle}` : creator.name,
    count: creator.count,
    active: Boolean(filters.creators?.includes(creator.slug)),
    href: href({ ...base, creators: toggleList(filters.creators, creator.slug) }),
  }));

  const tagOptions: FilterOption[] = tags.map((tag) => ({
    label: tag.name,
    active: Boolean(filters.tags?.includes(tag.slug)),
    href: href({ ...base, tags: toggleList(filters.tags, tag.slug) }),
  }));

  const labelOf = <T extends string>(choices: Array<{ value: T; label: string }>, value?: T) =>
    choices.find((choice) => choice.value === value)?.label;

  const chips: Array<{ label: string; href: string }> = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, href: href({ ...base, q: undefined }) });
  if (filters.library) {
    chips.push({ label: `Library: ${filters.library}`, href: href({ ...base, library: undefined }) });
  }
  for (const slug of (filters.creators ?? []).filter((value) => value !== lockedCreator)) {
    const creator = creators.find((entry) => entry.slug === slug);
    chips.push({
      label: creator?.xHandle ? `@${creator.xHandle}` : (creator?.name ?? slug),
      href: href({ ...base, creators: toggleList(filters.creators, slug) }),
    });
  }
  for (const slug of filters.tags ?? []) {
    chips.push({
      label: `#${tags.find((tag) => tag.slug === slug)?.name ?? slug}`,
      href: href({ ...base, tags: toggleList(filters.tags, slug) }),
    });
  }

  const anyFilter = Boolean(
    filters.q ||
      filters.kind ||
      filters.pricing ||
      filters.access ||
      filters.framework ||
      filters.library ||
      (filters.creators ?? []).some((value) => value !== lockedCreator) ||
      filters.tags?.length,
  );
  const shown = items.length;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const offset = filters.offset ?? 0;

  return (
    <div className="min-w-0 px-4 pt-8 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <div className="mb-1.5 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
          {description ? (
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside}
      </header>

      <div className="sticky top-14 z-20 -mx-4 mt-6 mb-6 flex items-center gap-2 overflow-x-auto border-b scrollbar-none sm:flex-wrap bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <FilterMenu label="Type" options={single("kind", KINDS)} activeLabel={labelOf(KINDS, filters.kind)} />
        <FilterMenu label="Price" options={single("pricing", PRICING)} activeLabel={labelOf(PRICING, filters.pricing)} />
        <FilterMenu label="Access" options={single("access", ACCESS)} activeLabel={labelOf(ACCESS, filters.access)} />
        <FilterMenu label="Framework" options={frameworkOptions} activeLabel={filters.framework} />
        <FilterMenu
          label="Creator"
          options={creatorOptions}
          activeLabel={filters.creators?.length ? `${filters.creators.length} creator${filters.creators.length > 1 ? "s" : ""}` : undefined}
        />
        <FilterMenu
          label="Style"
          options={tagOptions}
          activeLabel={filters.tags?.length ? `${filters.tags.length} style${filters.tags.length > 1 ? "s" : ""}` : undefined}
        />
        {chips.map((chip) => (
          <Link
            key={chip.href + chip.label}
            href={chip.href}
            scroll={false}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-muted pr-2 pl-3 text-[13px] hover:bg-muted/70"
          >
            {chip.label}
            <XIcon className="size-3.5 text-muted-foreground" />
          </Link>
        ))}
        {anyFilter ? (
          <Link
            href={pathname}
            scroll={false}
            className="shrink-0 px-2 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear all
          </Link>
        ) : null}
        <p className="ml-auto shrink-0 pl-2 text-[13px] tabular-nums text-muted-foreground">
          {total} {total === 1 ? "result" : "results"}
          {filters.q && modeUsed === "hybrid" ? " · semantic" : ""}
        </p>
      </div>

      <ItemGrid
        items={items}
        emptyTitle={anyFilter ? "No matches" : undefined}
        emptyBody={anyFilter ? "Try a broader search, or clear a filter." : undefined}
      />

      {total > offset + shown || offset > 0 ? (
        <div className="mt-12 flex items-center justify-center gap-2">
          {offset > 0 ? (
            <Link
              href={href({ ...filters, offset: Math.max(offset - limit, 0) })}
              className="inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium hover:bg-muted"
            >
              Previous
            </Link>
          ) : null}
          {total > offset + shown ? (
            limit < MAX_LIMIT ? (
              <Link
                href={href({ ...filters, limit: Math.min(limit + DEFAULT_LIMIT, MAX_LIMIT) })}
                scroll={false}
                className="inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium hover:bg-muted"
              >
                Show more
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {offset + shown} of {total}
                </span>
              </Link>
            ) : (
              <Link
                href={href({ ...filters, offset: offset + limit })}
                className="inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium hover:bg-muted"
              >
                Next page
              </Link>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
