/**
 * Read a library's shadcn registry (https://ui.shadcn.com/docs/registry): the index of its
 * components and, per component, the source files and dependencies needed to build it.
 */
import { lookupCategory } from "@/lib/catalog/taxonomy";

export type RegistryFile = {
  path: string;
  content?: string;
  type?: string;
  target?: string;
};

export type RegistryEntry = {
  name: string;
  type?: string;
  title?: string;
  description?: string;
  categories?: string[];
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  cssVars?: Record<string, Record<string, string>>;
  css?: Record<string, unknown>;
};

export type Registry = {
  /** Where the index was found. */
  indexUrl: string;
  entries: RegistryEntry[];
  /** JSON URL for one entry. */
  itemUrl: (name: string) => string;
};

const INDEX_PATHS = ["r/registry.json", "registry.json", "r/index.json"];

/** shadcn/ui itself serves its index at /r/index.json but items under a style folder. */
const SHADCN_STYLE = "new-york-v4";

export class RateLimitedError extends Error {}

/**
 * GET JSON from someone else's registry. On 429 it waits as told (Retry-After, else 15s) and
 * tries twice more, then throws RateLimitedError so the caller stops asking that host.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      headers: { "user-agent": "ui-component-aggregator (registry reader)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) {
      if (attempt >= 2) throw new RateLimitedError(`HTTP 429 for ${url}`);
      const wait = Number(res.headers.get("retry-after")) || 15;
      await new Promise((done) => setTimeout(done, Math.min(wait, 60) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
}

export async function findRegistry(homepage: string): Promise<Registry | null> {
  const origin = new URL(homepage).origin;
  for (const path of INDEX_PATHS) {
    const indexUrl = `${origin}/${path}`;
    try {
      const data = await fetchJson<RegistryEntry[] | { items?: RegistryEntry[] }>(indexUrl);
      const entries = Array.isArray(data) ? data : data.items;
      if (!entries?.length) continue;
      const dir = indexUrl.slice(0, indexUrl.lastIndexOf("/"));
      const itemUrl =
        new URL(origin).hostname === "ui.shadcn.com"
          ? (name: string) => `${origin}/r/styles/${SHADCN_STYLE}/${name}.json`
          : (name: string) => `${dir}/${name}.json`;
      return { indexUrl, entries, itemUrl };
    } catch {
      continue;
    }
  }
  return null;
}

const RENDERABLE = new Set(["registry:ui", "registry:component", "registry:block", "registry:example"]);

/**
 * Whether an index entry is a component worth its own card. Skips hooks, utilities, token
 * files, and icon sets (animate-ui ships 773 icons; one card each would bury everything).
 */
export function isExtractable(entry: RegistryEntry): boolean {
  if (!entry.type || !RENDERABLE.has(entry.type)) return false;
  if (/^icons?-/.test(entry.name)) return false;
  return true;
}

/** Library-wide CSS (tokens, themes) that every component in the registry assumes. */
export function isGlobalStyle(entry: RegistryEntry): boolean {
  return (
    (entry.type === "registry:item" || entry.type === "registry:style" || entry.type === "registry:theme") &&
    Boolean(entry.files?.some((file) => file.path.endsWith(".css")))
  );
}

function singular(word: string) {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Taxonomy slug for a registry component. Its own name is the most specific signal
 * ("split-button" → buttons, "event-calendar-3" → calendars); registry categories (Arc tags
 * every item) come next; then blocks go to page sections and the rest to "other".
 */
export function categorizeEntry(entry: Pick<RegistryEntry, "name" | "type" | "title" | "categories">): string {
  const words = entry.name
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter((word) => word && !/^\d+$/.test(word));
  const candidates = [
    words.join(" "),
    entry.title ?? "",
    ...words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`),
    ...[...words].reverse(),
    ...[...words].reverse().map(singular),
    ...(entry.categories ?? []),
  ];
  for (const candidate of candidates) {
    const hit = candidate ? lookupCategory(candidate) : undefined;
    if (hit) return hit;
  }
  return entry.type === "registry:block" ? "blocks" : "other";
}

/** "split-button" → "Split button"; keeps a registry-provided title when there is one. */
export function displayName(entry: Pick<RegistryEntry, "name" | "title">): string {
  if (entry.title?.trim()) return entry.title.trim();
  const words = entry.name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "motion@12" → ["motion", "12"]; "@radix-ui/react-slot" → ["@radix-ui/react-slot", ""]. */
export function splitDependency(spec: string): [string, string] {
  const match = spec.match(/^(@?[^@]+)(?:@(.+))?$/);
  return match ? [match[1], match[2] ?? ""] : [spec, ""];
}
