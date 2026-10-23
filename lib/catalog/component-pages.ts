/**
 * Find a component's own docs page on its library's site, so "Visit site" lands on the
 * component instead of the homepage. Registries don't carry a docs URL, but every library we
 * extract publishes a sitemap: one request per library, then matching is local.
 */

const SITEMAP_PATHS = ["sitemap.xml", "sitemap-0.xml", "sitemap_index.xml"];

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ui-component-aggregator (page finder)" },
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
}

/** Every page URL in the site's sitemap (following a sitemap index a few levels). */
export async function fetchSitemapUrls(origin: string): Promise<string[]> {
  for (const file of SITEMAP_PATHS) {
    const xml = await fetchText(`${origin}/${file}`);
    if (!xml) continue;
    const entries = locs(xml);
    const nested = entries.filter((url) => url.endsWith(".xml")).slice(0, 5);
    const pages = entries.filter((url) => !url.endsWith(".xml"));
    for (const child of nested) {
      const childXml = await fetchText(child);
      if (childXml) pages.push(...locs(childXml).filter((url) => !url.endsWith(".xml")));
    }
    if (pages.length) return [...new Set(pages)];
  }
  return [];
}

/** "/ja/components/x" → "/components/x"; localized copies shouldn't win over the default. */
function withoutLocale(pathname: string): { path: string; localized: boolean } {
  const match = pathname.match(/^\/([a-z]{2}(?:-[A-Za-z]{2})?)(\/.*)$/);
  return match ? { path: match[2], localized: true } : { path: pathname, localized: false };
}

/**
 * The page for registry item `name`: a path ending in the name ("/components/split-button"),
 * or in its first word as a section ("backgrounds-bubble" → "/docs/backgrounds/bubble").
 * Prefers the default locale, shadcn's radix pages (what the registry ships), then the
 * shortest path. Null when nothing matches; callers fall back to the homepage.
 */
export function findComponentPage(urls: string[], name: string): string | null {
  const dash = name.indexOf("-");
  const sectioned = dash > 0 ? `/${name.slice(0, dash)}/${name.slice(dash + 1)}` : null;
  const matches = urls
    .map((url) => {
      try {
        const parsed = new URL(url);
        const { path, localized } = withoutLocale(parsed.pathname.replace(/\/+$/, ""));
        const exact = path.endsWith(`/${name}`) || (sectioned !== null && path.endsWith(sectioned));
        return exact ? { url, path, localized } : null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { url: string; path: string; localized: boolean } => entry !== null);
  if (!matches.length) return null;
  const rank = (entry: { path: string; localized: boolean }) =>
    (entry.localized ? 100 : 0) +
    (/\/radix\//.test(entry.path) ? -10 : /\/(aria|base)\//.test(entry.path) ? 10 : 0) +
    entry.path.split("/").length;
  return matches.sort((a, b) => rank(a) - rank(b) || a.path.length - b.path.length)[0].url;
}
