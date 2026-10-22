"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  BellRingIcon,
  BookOpenIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  CompassIcon,
  LayersIcon,
  LayoutGridIcon,
  LibraryIcon,
  MousePointerClickIcon,
  PanelsTopLeftIcon,
  SearchIcon,
  SparklesIcon,
  TextCursorInputIcon,
  UsersIcon,
  WandSparklesIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CategoryNode } from "@/lib/catalog/category-tree";

const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  libraries: LibraryIcon,
  actions: MousePointerClickIcon,
  inputs: TextCursorInputIcon,
  navigation: CompassIcon,
  overlays: LayersIcon,
  "data-display": LayoutGridIcon,
  feedback: BellRingIcon,
  charts: ChartColumnIcon,
  blocks: PanelsTopLeftIcon,
  "ai-agent-ui": SparklesIcon,
  effects: WandSparklesIcon,
  resources: BookOpenIcon,
};

const COLLAPSED_KEY = "sidebar:collapsed";

/**
 * Collapsed sections persist in localStorage. useSyncExternalStore renders the server
 * snapshot (everything open) during hydration, then the stored one, without a mismatch.
 */
const collapsedStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    collapsedStore.listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      collapsedStore.listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  read(): string {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) ?? "[]";
    } catch {
      return "[]";
    }
  },
  write(slugs: string[]) {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(slugs));
    } catch {
      // Private mode or storage disabled: collapse state just won't persist.
    }
    collapsedStore.listeners.forEach((listener) => listener());
  },
};

function parseSlugs(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function activeSlug(pathname: string): string | null {
  const match = pathname.match(/^\/categories\/(?:.*\/)?([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function CategoryNav({
  tree,
  total,
  newThisWeek,
  onNavigate,
}: {
  tree: CategoryNode[];
  total: number;
  newThisWeek: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = activeSlug(pathname);
  const [query, setQuery] = useState("");
  const collapsedRaw = useSyncExternalStore(
    collapsedStore.subscribe,
    collapsedStore.read,
    () => "[]",
  );
  const collapsed = useMemo(() => parseSlugs(collapsedRaw), [collapsedRaw]);

  const toggle = (slug: string, open: boolean) => {
    const next = open
      ? collapsed.filter((value) => value !== slug)
      : [...new Set([...collapsed, slug])];
    collapsedStore.write(next);
  };

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return tree;
    return tree
      .map((section) => {
        if (section.name.toLowerCase().includes(needle)) return section;
        const children = section.children.filter((child) =>
          child.name.toLowerCase().includes(needle),
        );
        return children.length ? { ...section, children } : null;
      })
      .filter((section): section is CategoryNode => section !== null);
  }, [tree, needle]);

  return (
    <nav aria-label="Browse" className="flex flex-col gap-5 pb-8 text-sm">
      <div className="flex flex-col gap-0.5">
        <NavRow
          href="/"
          icon={ZapIcon}
          label="Discover"
          count={total}
          active={pathname === "/"}
          onNavigate={onNavigate}
        />
        <NavRow
          href="/creators"
          icon={UsersIcon}
          label="Creators"
          active={pathname.startsWith("/creators")}
          onNavigate={onNavigate}
        />
        {newThisWeek > 0 ? (
          <p className="px-2.5 pt-1.5 text-xs text-muted-foreground">
            <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-emerald-500" />
            {newThisWeek} added this week
          </p>
        ) : null}
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a category"
          aria-label="Filter categories"
          className="h-8 w-full rounded-lg bg-muted/70 pr-2 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus:bg-muted focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        {visible.map((section) => {
          const Icon = SECTION_ICONS[section.slug] ?? LayoutGridIcon;
          if (!section.children.length) {
            return (
              <NavRow
                key={section.id}
                href={`/categories/${section.slug}`}
                icon={Icon}
                label={section.name}
                count={section.count}
                active={current === section.slug}
                onNavigate={onNavigate}
              />
            );
          }

          const containsActive = section.children.some((child) => child.slug === current);
          const open = Boolean(needle) || containsActive || !collapsed.includes(section.slug);
          return (
            <Collapsible
              key={section.id}
              open={open}
              onOpenChange={(next) => toggle(section.slug, next)}
            >
              <div
                className={cn(
                  "group/section flex items-center rounded-lg pr-1 transition-colors hover:bg-muted/70",
                  current === section.slug && "bg-muted",
                )}
              >
                <Link
                  href={`/categories/${section.slug}`}
                  onClick={onNavigate}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2.5 font-medium"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{section.name}</span>
                  <Count value={section.count} />
                </Link>
                <CollapsibleTrigger
                  aria-label={`${open ? "Collapse" : "Expand"} ${section.name}`}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <ChevronRightIcon
                    className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <ul className="relative mt-0.5 mb-2 ml-[1.0625rem] flex flex-col gap-px border-l pl-2">
                  {section.children.map((child) => {
                    const active = child.slug === current;
                    return (
                      <li key={child.id}>
                        <Link
                          href={`/categories/${child.slug}`}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors",
                            active
                              ? "bg-foreground font-medium text-background"
                              : child.count
                                ? "text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                                : "text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{child.name}</span>
                          <Count value={child.count} inverted={active} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {!visible.length ? (
          <p className="px-2.5 py-2 text-[13px] text-muted-foreground">
            No category matches “{query}”.
          </p>
        ) : null}
      </div>
    </nav>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  count,
  active,
  onNavigate,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors",
        active ? "bg-muted text-foreground" : "hover:bg-muted/70",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      {count !== undefined ? <Count value={count} /> : null}
    </Link>
  );
}

function Count({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "ml-auto text-xs font-normal tabular-nums",
        inverted ? "text-background/70" : "text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}
