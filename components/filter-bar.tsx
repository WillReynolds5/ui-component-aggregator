import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";
import { hrefWithFilters } from "@/lib/catalog/url";
import type { SearchFilters } from "@/lib/catalog/search";

const KINDS = [
  { value: undefined, label: "Any kind" },
  { value: "component" as const, label: "Components" },
  { value: "block" as const, label: "Blocks" },
];

const PRICING = [
  { value: undefined, label: "Any price" },
  { value: "free" as const, label: "Free" },
  { value: "freemium" as const, label: "Freemium" },
  { value: "paid" as const, label: "Paid" },
];

const CREATOR_CHIP_LIMIT = 16;

function visibleCreators<T extends { slug: string; count: number }>(
  creators: T[],
  selected?: string[],
): T[] {
  const picked = new Set(selected ?? []);
  const top = creators.slice(0, CREATOR_CHIP_LIMIT);
  const extra = creators.filter(
    (creator) => picked.has(creator.slug) && !top.some((row) => row.slug === creator.slug),
  );
  return [...top, ...extra];
}

const ACCESS = [
  { value: undefined, label: "Any access" },
  { value: "full_code" as const, label: "Full code" },
  { value: "install_only" as const, label: "Install" },
  { value: "link_only" as const, label: "Link only" },
];

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function FilterBar({
  filters,
  tags,
  frameworks,
  creators = [],
  pathname = "/",
}: {
  filters: SearchFilters;
  tags: Array<{ slug: string; name: string }>;
  frameworks: string[];
  creators?: Array<{ slug: string; name: string; xHandle: string | null; count: number }>;
  pathname?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((option) => (
          <Chip
            key={option.label}
            active={filters.kind === option.value || (!filters.kind && !option.value)}
            href={hrefWithFilters(pathname, {
              ...filters,
              kind: option.value,
              offset: 0,
            })}
          >
            {option.label}
          </Chip>
        ))}
        <span className="mx-1 h-7 w-px bg-border" />
        {PRICING.map((option) => (
          <Chip
            key={option.label}
            active={
              filters.pricing === option.value || (!filters.pricing && !option.value)
            }
            href={hrefWithFilters(pathname, {
              ...filters,
              pricing: option.value,
              offset: 0,
            })}
          >
            {option.label}
          </Chip>
        ))}
        <span className="mx-1 h-7 w-px bg-border" />
        {ACCESS.map((option) => (
          <Chip
            key={option.label}
            active={filters.access === option.value || (!filters.access && !option.value)}
            href={hrefWithFilters(pathname, {
              ...filters,
              access: option.value,
              offset: 0,
            })}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {frameworks.map((framework) => {
          const active = filters.framework === framework;
          return (
            <Chip
              key={framework}
              active={active}
              href={hrefWithFilters(pathname, {
                ...filters,
                framework: active ? undefined : framework,
                offset: 0,
              })}
            >
              {framework}
            </Chip>
          );
        })}
      </div>
      {creators.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Creators</span>
          {visibleCreators(creators, filters.creators).map((creator) => {
            const selected = filters.creators?.includes(creator.slug);
            const next = selected
              ? (filters.creators ?? []).filter((value) => value !== creator.slug)
              : [...(filters.creators ?? []), creator.slug];
            return (
              <Chip
                key={creator.slug}
                active={Boolean(selected)}
                href={hrefWithFilters(pathname, {
                  ...filters,
                  creators: next.length ? next : undefined,
                  offset: 0,
                })}
              >
                {creator.xHandle ? `@${creator.xHandle}` : creator.name}
                <span className="ml-1 opacity-70">{creator.count}</span>
              </Chip>
            );
          })}
          <Link
            href="/creators"
            className="inline-flex h-7 items-center px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            All creators
          </Link>
        </div>
      ) : null}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 24).map((tag) => {
            const selected = filters.tags?.includes(tag.slug);
            const nextTags = selected
              ? (filters.tags ?? []).filter((value) => value !== tag.slug)
              : [...(filters.tags ?? []), tag.slug];
            return (
              <Chip
                key={tag.slug}
                active={Boolean(selected)}
                href={hrefWithFilters(pathname, {
                  ...filters,
                  tags: nextTags.length ? nextTags : undefined,
                  offset: 0,
                })}
              >
                {tag.name}
              </Chip>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
