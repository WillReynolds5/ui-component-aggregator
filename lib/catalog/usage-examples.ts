/**
 * The author's own usage example for a component, from its docs page's markdown. Rendering a
 * component bare (no props, no content) shows an empty Alert or a stateless toggle; the
 * library's showcase is always a small composition, and many docs sites publish that code
 * as markdown (Arc: `<page>/markdown`; shadcn, animate-ui, audiocn, reui: `<page>.md`).
 */

const MARKDOWN_SUFFIXES = ["/markdown", ".md"];

async function fetchMarkdown(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ui-component-aggregator (usage examples)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // A 200 HTML page is a site's not-found or app shell, not markdown.
    return /<!doctype html|<html/i.test(text.slice(0, 500)) ? null : text;
  } catch {
    return null;
  }
}

/** tsx/jsx code blocks, with the heading they sit under. */
export function codeBlocks(markdown: string): Array<{ heading: string; code: string }> {
  const blocks: Array<{ heading: string; code: string }> = [];
  let heading = "";
  const pattern = /^(#{1,4})\s+(.+)$|^```(tsx|jsx|typescript|javascript|ts|js)?[^\n]*\n([\s\S]*?)^```/gm;
  for (const match of markdown.matchAll(pattern)) {
    if (match[1]) heading = match[2].trim();
    else if (match[3] && /tsx|jsx/.test(match[3])) blocks.push({ heading, code: match[4] });
  }
  return blocks;
}

/**
 * Turn a code block into a module whose export renders the example: a block that already
 * exports a component is used as-is; a bare snippet (imports + one JSX expression) is
 * wrapped. Anything else (prop tables in code, multi-statement fragments) is skipped.
 */
export function toExampleModule(code: string): string | null {
  if (/export\s+(default\s+)?function\s+[A-Z]|export\s+const\s+[A-Z]\w*\s*=/.test(code)) return code;
  // Peel leading import statements; an import clause never contains a quote before its
  // module path, so a lazy match up to the first quoted string ends each statement.
  const imports: string[] = [];
  let rest = code.trim();
  for (let match = rest.match(/^import\s[\s\S]*?["'][^"']+["'];?/); match; match = rest.match(/^import\s[\s\S]*?["'][^"']+["'];?/)) {
    imports.push(match[0]);
    rest = rest.slice(match[0].length).trimStart();
  }
  const body = rest.trim();
  if (!imports.length || !/^<[A-Za-z]/.test(body) || !/>$/.test(body)) return null;
  return `${imports.join("\n")}\n\nexport default function UsageExample() {\n  return (\n    <>\n${body}\n    </>\n  );\n}\n`;
}

/**
 * The usage example for `componentName` (its exported names, e.g. ["Alert"]) from the docs
 * page's markdown, or null. Prefers blocks under a "Usage"/"Example" heading, and requires
 * the block to actually use one of the component's exports.
 */
export async function findUsageExample(pageUrl: string | null, exportNames: string[]): Promise<string | null> {
  if (!pageUrl || !exportNames.length) return null;
  const page = pageUrl.replace(/\/+$/, "");
  for (const suffix of MARKDOWN_SUFFIXES) {
    const markdown = await fetchMarkdown(`${page}${suffix}`);
    if (!markdown) continue;
    const uses = (code: string) => exportNames.some((name) => new RegExp(`<${name}[\\s/>]`).test(code));
    const ranked = codeBlocks(markdown)
      .filter((block) => uses(block.code))
      .sort((a, b) => Number(/usage|example|demo|preview/i.test(b.heading)) - Number(/usage|example|demo|preview/i.test(a.heading)));
    for (const block of ranked) {
      const example = toExampleModule(block.code);
      if (example) return example;
    }
  }
  return null;
}

/** Exported component names in a source file: `export function Alert`, `export const Alert =`, `export { Alert }`. */
export function exportedComponents(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z]\w*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z]/.test(name) && !name.startsWith("type ")) names.add(name);
    }
  }
  return [...names];
}
