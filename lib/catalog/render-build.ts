/**
 * Build one registry component into a standalone, interactive HTML page.
 *
 * Source comes from the library's shadcn registry (lib/catalog/registry.ts). esbuild bundles
 * the component and its registry dependencies from memory; npm packages stay external and
 * load from esm.sh through an import map with versions pinned at build time; Tailwind is
 * compiled here so cards don't run a CSS compiler in the browser. The page is meant to sit
 * in a sandboxed iframe: it scales the component to fit, and posts its status to the parent.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { build, type Plugin } from "esbuild";
import {
  fetchJson,
  isSafeRef,
  splitDependency,
  type Registry,
  type RegistryEntry,
} from "@/lib/catalog/registry";

const SHADCN_BASE = "https://ui.shadcn.com/r/styles/new-york-v4";
const SOURCE_EXT = /\.(tsx|ts|jsx|js)$/;

export type ResolvedComponent = {
  entry: RegistryEntry;
  /** path → content for the component and every registry dependency. */
  files: Map<string, string>;
  /** npm package → version spec ("" when the registry didn't pin one). */
  npmDeps: Map<string, string>;
  mainPath: string;
  /** Fetch another registry item into `files` (for imports its dependencies didn't declare). */
  fetchMore: (name: string) => Promise<boolean>;
  /** The library site the registry lives on; root-relative demo assets come from here. */
  origin: string;
};

function normalizePath(file: string) {
  return file.replace(/^~\//, "").replace(/^\.?\//, "");
}

/**
 * The file that exports the component: the one named after the entry ("tree-view.tsx",
 * ".../tree-view/index.tsx"), else the first .tsx, else any source. Registries often list a
 * helper (styles, types) first.
 */
export function mainFile(entry: Pick<RegistryEntry, "name" | "files">) {
  const sources = (entry.files ?? []).filter((file) => SOURCE_EXT.test(file.path) && file.content);
  const base = (file: { path: string }) => path.posix.basename(file.path).replace(SOURCE_EXT, "").toLowerCase();
  const dir = (file: { path: string }) => path.posix.basename(path.posix.dirname(file.path)).toLowerCase();
  const name = entry.name.toLowerCase();
  const short = name.split("-").slice(1).join("-");
  return (
    sources.find((file) => base(file) === name || (base(file) === "index" && dir(file) === name)) ??
    sources.find((file) => short && (base(file) === short || (base(file) === "index" && dir(file) === short))) ??
    sources.find((file) => file.path.endsWith(".tsx")) ??
    sources[0]
  );
}

/** "backgrounds-fireworks" → "BackgroundsFireworks". */
function pascal(value: string) {
  return value.replace(/(^|[-_\s]+)([a-z0-9])/gi, (_, __, char: string) => char.toUpperCase());
}

/** Fetch the entry and, recursively, every registry item it depends on. */
export async function resolveComponent(
  registry: Registry,
  name: string,
  globalStyles: RegistryEntry[] = [],
): Promise<ResolvedComponent> {
  const files = new Map<string, string>();
  const npmDeps = new Map<string, string>();
  const seen = new Set<string>();

  const add = (item: RegistryEntry) => {
    for (const dep of item.dependencies ?? []) {
      const [pkg, version] = splitDependency(dep);
      if (!npmDeps.get(pkg)) npmDeps.set(pkg, version);
    }
    for (const file of item.files ?? []) {
      if (file.content === undefined) continue;
      files.set(normalizePath(file.path), file.content);
      if (file.target) files.set(normalizePath(file.target), file.content);
    }
  };

  const visit = async (ref: string): Promise<RegistryEntry> => {
    if (!isSafeRef(ref)) throw new Error(`Unsafe registry reference ${JSON.stringify(ref).slice(0, 80)}`);
    // "@reui/alert"-style refs name an item in the library's own (namespaced) registry.
    const local = ref.match(/^@[^/]+\/(.+)$/)?.[1];
    const url = ref.startsWith("http") ? ref : registry.itemUrl(local ?? ref);
    if (seen.has(url)) return { name: ref };
    seen.add(url);
    let item: RegistryEntry;
    try {
      item = await fetchJson<RegistryEntry>(url);
    } catch (error) {
      // Third-party registries reference shadcn's base items ("button", "utils") by bare name.
      if (ref.startsWith("http") || local) throw error;
      item = await fetchJson<RegistryEntry>(`${SHADCN_BASE}/${ref}.json`);
    }
    add(item);
    for (const child of item.registryDependencies ?? []) await visit(child);
    return item;
  };

  const entry = await visit(name);
  for (const style of globalStyles) add(style);
  const main = mainFile(entry);
  if (!main) throw new Error(`${name} has no source file`);
  const fetchMore = async (more: string) => {
    try {
      await visit(more);
      return true;
    } catch {
      return false;
    }
  };
  return {
    entry,
    files,
    npmDeps,
    mainPath: normalizePath(main.path),
    fetchMore,
    origin: new URL(registry.indexUrl).origin,
  };
}

const CN_SOURCE = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) { return twMerge(clsx(inputs)); }`;

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];

function virtualFiles(
  files: Map<string, string>,
  npmDeps: Map<string, string>,
  fetchMore?: (name: string) => Promise<boolean>,
  trimExports = true,
): Plugin {
  // Computed lazily: fetchMore can add files during the build.
  let importedCache: Map<string, string[]> | null = null;
  const imported = {
    get: (spec: string) => {
      importedCache ??= namedImports(
        [...files.entries()].filter(([file]) => SOURCE_EXT.test(file)).map(([, content]) => content),
      );
      return importedCache.get(spec);
    },
  };
  const find = (candidate: string) =>
    EXTENSIONS.map((ext) => path.posix.normalize(candidate + ext)).find((p) => files.has(p));
  // Registry paths rarely match the installed layout an import assumes ("@/components/ui/x"
  // vs "registry/new-york-v4/ui/x.tsx"). Match the longest tail of the import path that some
  // file ends with: "components/ui/x", then "ui/x", then "x".
  const byTail = (spec: string) => {
    const segments = spec.replace(/^@\//, "").replace(/^(\.\.?\/)+/, "").split("/");
    for (let start = 0; start < segments.length; start += 1) {
      const tail = segments.slice(start).join("/");
      const hit = [...files.keys()].find((key) => {
        const bare = key.replace(SOURCE_EXT, "");
        return (
          bare === tail ||
          bare.endsWith(`/${tail}`) ||
          bare.replace(/\/index$/, "").endsWith(`/${tail}`) ||
          key.endsWith(`/${tail}`)
        );
      });
      if (hit) return hit;
    }
    return undefined;
  };

  return {
    name: "registry-files",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^__entry\.tsx$/ }, (args) =>
        args.kind === "entry-point" ? { path: args.path, namespace: "reg" } : undefined,
      );
      // Only imports made by registry code; React's own internals resolve normally from disk.
      pluginBuild.onResolve({ filter: /.*/, namespace: "reg" }, async (args) => {
        // CSS `url(data:…)`, `url(https://…)`: assets the browser loads as written, not modules.
        if (/^(data:|https?:|\/\/)/i.test(args.path) || (args.kind === "url-token" && !args.path.startsWith("."))) {
          return { path: args.path, external: true };
        }
        if (args.path === "cn" || args.path === "@/lib/utils" || /(^|\/)lib\/utils$/.test(args.path)) {
          const hit = find("lib/utils") ?? byTail("lib/utils");
          return { path: hit ?? "__cn.ts", namespace: "reg" };
        }
        if (args.path.startsWith(".")) {
          const hit = find(path.posix.join(path.posix.dirname(args.importer), args.path)) ?? byTail(args.path);
          if (hit) return { path: hit, namespace: "reg" };
        }
        if (args.path.startsWith("@/")) {
          const local = () => find(args.path.slice(2)) ?? byTail(args.path);
          let hit = local();
          // shadcn demos import siblings they don't declare ("@/registry/.../ui/button").
          if (!hit && fetchMore && (await fetchMore(path.posix.basename(args.path)))) hit = local();
          if (hit) return { path: hit, namespace: "reg" };
        }
        if (!args.path.startsWith(".") && !args.path.startsWith("@/")) {
          return resolvePackage(args.path, npmDeps, trimExports ? imported.get(args.path) : undefined);
        }
        return { errors: [{ text: `Cannot resolve ${args.path} from ${args.importer}` }] };
      });
      pluginBuild.onLoad({ filter: /.*/, namespace: "reg" }, (args) => {
        if (args.path === "__cn.ts") return { loader: "ts", contents: CN_SOURCE };
        const contents = files.get(args.path);
        if (contents === undefined) return { errors: [{ text: `Missing ${args.path}` }] };
        const ext = path.extname(args.path);
        const loader = args.path.endsWith(".module.css")
          ? "local-css"
          : ext === ".css"
            ? "css"
            : (ext.slice(1) as "tsx" | "ts" | "jsx" | "js");
        return { loader, contents, resolveDir: "/" };
      });
    },
  };
}

/** Content children for types that render nothing without them (an empty button is a dot). */
export function defaultChildren(categorySlug: string): string | null {
  const labels: Record<string, string> = {
    buttons: "Button",
    badges: "Badge",
    toggles: "Toggle",
    "text-effects": "Every component, one place",
  };
  return labels[categorySlug] ?? null;
}

function entrySource(mainPath: string, children: string | null, componentName: string, layout: RenderLayout) {
  return `import * as React from "react";
import { createRoot } from "react-dom/client";
import * as M from "./${mainPath}";

// Pick by export name: minification renames the functions themselves. Prefer the export that
// matches the item ("FireworksBackground" for "backgrounds-fireworks"), then the default.
const isComponent = (v) => typeof v === "function" || (v && typeof v === "object" && "$$typeof" in v);
const words = ${JSON.stringify(pascal(componentName).match(/[A-Z][a-z0-9]*/g) ?? [])};
const named = Object.entries(M).filter(([key, v]) => /^[A-Z]/.test(key) && isComponent(v));
const score = (key) => words.filter((word) => key.includes(word)).length;
const best = named.sort((a, b) => score(b[0]) - score(a[0]))[0];
const Component =
  (best && score(best[0]) > 0 ? best[1] : null) ?? (isComponent(M.default) ? M.default : null) ?? best?.[1];

function report(status) {
  window.__renderStatus = status;
  try { parent.postMessage({ source: "component-render", ...status }, "*"); } catch {}
}

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { report({ ok: false, error: String(error && error.message || error) }); }
  render() { return this.state.error ? null : this.props.children; }
}

const root = document.getElementById("root");
if (!Component) report({ ok: false, error: "no exported component" });
else createRoot(root).render(
  React.createElement(Boundary, null, React.createElement(Component, null, ${JSON.stringify(children)}))
);

// The quick view opens renders with ?mode=full so long blocks can scroll; cards never scroll.
if (new URLSearchParams(location.search).get("mode") === "full") document.documentElement.classList.add("full");

// Scale oversized components down to fit the card; size-full components are left alone.
// Blocks are laid out like a page (top-aligned, natural size) instead.
function fit() {
  const el = root.firstElementChild;
  if (!el || ${JSON.stringify(layout)} === "block") return;
  el.style.transform = "";
  const rect = el.getBoundingClientRect();
  const w = Math.max(el.scrollWidth, rect.width), h = Math.max(el.scrollHeight, rect.height);
  const scale = Math.min(1, (innerWidth - 24) / w, (innerHeight - 24) / h);
  if (scale < 1 && scale > 0) { el.style.transformOrigin = "center"; el.style.transform = "scale(" + scale + ")"; }
}
// Blocks are laid out like a page, but one narrower or shorter than the canvas (a sign-in
// card, a newsletter box) would sit in the top-left corner: center it. Full-width sections
// keep stretching (auto-width children stretch in a flex column).
function place() {
  const el = root.firstElementChild;
  if (!el || ${JSON.stringify(layout)} !== "block") return;
  root.style.display = "flex";
  root.style.flexDirection = "column";
  el.style.marginInline = el.getBoundingClientRect().width < root.clientWidth - 1 ? "auto" : "";
  root.style.justifyContent = el.scrollHeight < innerHeight - 1 ? "center" : "flex-start";
}

// Refit whenever the component itself changes size (content loading in, accordions opening).
// The transform doesn't change its layout size, so this can't loop.
const sizeWatch = new ResizeObserver(() => { fit(); place(); });
sizeWatch.observe(root);
new MutationObserver(() => {
  if (root.firstElementChild) sizeWatch.observe(root.firstElementChild);
}).observe(root, { childList: true });
addEventListener("resize", () => { fit(); place(); });

function looksBlank() {
  const el = root.firstElementChild;
  if (!el) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return true;
  if (el.innerText && el.innerText.trim()) return false;
  const visual = "svg, canvas, img, video, input, textarea, select, button, iframe";
  if (el.matches(visual) || el.querySelector(visual)) return false;
  const style = getComputedStyle(el);
  return style.backgroundImage === "none" && /rgba\\(0, 0, 0, 0\\)|transparent/.test(style.backgroundColor) && style.borderStyle === "none";
}

setTimeout(() => {
  fit();
  place();
  if (!window.__renderStatus) report({ ok: !looksBlank(), blank: looksBlank() });
}, 1200);
`;
}

const THEME_CSS = `
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-border: var(--border);
  --color-input: var(--input); --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px); --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius); --radius-xl: calc(var(--radius) + 4px);
}
:root {
  --radius: 0.625rem; --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0); --card-foreground: oklch(0.145 0 0); --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0); --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0); --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0); --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0); --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0); --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0); --input: oklch(0.922 0 0); --ring: oklch(0.708 0 0);
}
@layer base { * { border-color: var(--border); } }
`;

/** shadcn `cssVars` ({ theme, light, dark }) → CSS custom properties. */
function cssVarsToCss(entries: RegistryEntry[]) {
  const lines: string[] = [];
  for (const entry of entries) {
    const vars = entry.cssVars;
    if (!vars) continue;
    const decl = (record?: Record<string, string>) =>
      Object.entries(record ?? {})
        .map(([key, value]) => `--${key}: ${value};`)
        .join(" ");
    if (vars.theme || vars.light) lines.push(`:root { ${decl(vars.theme)} ${decl(vars.light)} }`);
  }
  return lines.join("\n");
}

/**
 * Stylesheets that arrived as registry dependencies (BoardUI's `globals` → theme tokens via
 * `@theme`) rather than through a code import. They need Tailwind, not esbuild, so they're
 * returned for the Tailwind input with their relative `@import`s inlined from memory.
 */
export function registryStylesheets(files: Map<string, string>): string {
  const imported = new Set<string>();
  for (const [file, content] of files) {
    if (!SOURCE_EXT.test(file)) continue;
    for (const match of content.matchAll(/import\s+(?:[\w{}\s,*]+from\s+)?["']([^"']+\.css)["']/g)) {
      imported.add(path.posix.basename(match[1]));
    }
  }
  const byBase = new Map([...files.keys()].filter((f) => f.endsWith(".css")).map((f) => [path.posix.basename(f), f]));
  const inlined = new Set<string>();
  const inline = (file: string): string =>
    (files.get(file) ?? "").replace(/@import\s+["']([^"']+)["'];?/g, (_whole, target: string) => {
      if (target === "tailwindcss" || target === "tw-animate-css") return "";
      const local = byBase.get(path.posix.basename(target));
      // Anything not in memory is dropped, never left for Tailwind to read from local disk.
      if (!local || inlined.has(local)) return "";
      inlined.add(local);
      return inline(local);
    });
  const roots = [...byBase.values()].filter(
    (file) => !imported.has(path.posix.basename(file)) && !file.endsWith(".module.css"),
  );
  // Sequential on purpose: a file inlined by an earlier root must not be emitted again.
  const out: string[] = [];
  for (const file of roots) {
    if (inlined.has(file)) continue;
    inlined.add(file);
    out.push(inline(file));
  }
  return out.join("\n");
}

/**
 * Registry CSS is untrusted. Tailwind resolves `@import`, `@plugin`, `@config`, `@source`, and
 * `@reference` against the local filesystem of whoever runs the build, and the output is
 * published, so `@import "/Users/me/.aws/…json"` would leak that file. Strip them all; the
 * only imports that survive are the two this module adds itself.
 */
export function sanitizeRegistryCss(css: string): string {
  return css
    .replace(/@(import|plugin|config|source|reference)\b[^;{]*;/gi, "")
    .replace(/@(plugin|config)\b[^{;]*\{[^}]*\}/gi, "");
}

async function tailwindCss(sources: string[], extraCss: string) {
  const scanner = new Scanner({});
  const candidates = scanner.scanFiles(sources.map((content) => ({ content, extension: "tsx" })));
  const compiler = await compile(
    `@import "tailwindcss"; @import "tw-animate-css"; ${THEME_CSS}\n${sanitizeRegistryCss(extraCss)}`,
    { base: process.cwd(), onDependency: () => {} },
  );
  return compiler.build(candidates);
}

const latestVersions = new Map<string, Promise<string>>();

/** Pin a version at build time so a render never changes underneath us. */
async function pinVersion(pkg: string, rawSpec: string): Promise<string> {
  // "^3.25.76 || ^4.1.8" → "4.1.8": the newest alternative's floor is an exact, valid pick.
  const spec = (rawSpec.split("||").pop() ?? "").trim().replace(/^[\^~>=<\s]+/, "");
  if (/^\d+(\.\d+){2}$/.test(spec)) return spec;
  const key = `${pkg}@${spec}`;
  if (!latestVersions.has(key)) {
    latestVersions.set(
      key,
      fetchJson<{ version: string }>(`https://registry.npmjs.org/${pkg}/${spec || "latest"}`)
        .then((info) => info.version)
        .catch(() => spec || "latest"),
    );
  }
  return latestVersions.get(key)!;
}

function packageOf(spec: string) {
  return spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
}

const projectRequire = createRequire(path.join(process.cwd(), "package.json"));

/**
 * Registry code written for Next.js imports its helpers. Bundling the real ones pulls in part
 * of Next and points images at a `/_next/image` endpoint that doesn't exist in a render, so
 * they're replaced with plain-DOM stand-ins.
 */
const NEXT_SHIMS: Record<string, string> = {
  "next/image": `import * as React from "react";
const Image = React.forwardRef(function Image({ src, alt = "", fill, width, height, style, priority, quality, placeholder, blurDataURL, loader, unoptimized, sizes, ...rest }, ref) {
  const url = typeof src === "object" && src ? src.src : src;
  const fillStyle = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : null;
  return React.createElement("img", { ref, src: url, alt, width: fill ? undefined : width, height: fill ? undefined : height, sizes, loading: priority ? "eager" : "lazy", style: { ...fillStyle, ...style }, ...rest });
});
export default Image;`,
  "next/link": `import * as React from "react";
const Link = React.forwardRef(function Link({ href, prefetch, replace, scroll, shallow, locale, legacyBehavior, passHref, ...rest }, ref) {
  const url = typeof href === "object" && href ? href.pathname ?? "#" : href;
  return React.createElement("a", { ref, href: url, ...rest });
});
export default Link;`,
  "next/navigation": `export const useRouter = () => ({ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} });
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = () => {};
export const notFound = () => {};`,
};
const REACT_PACKAGES = new Set(["react", "react-dom", "scheduler"]);

/**
 * Where a bare import comes from. React (and react-dom's scheduler) is bundled from this
 * project's node_modules, so every render has exactly one copy; everything else comes from
 * esm.sh at a pinned version, with React left for the local copy.
 */
async function resolvePackage(spec: string, npmDeps: Map<string, string>, only?: string[]) {
  if (spec in NEXT_SHIMS) return { path: spec, namespace: "next-shim" };
  if (REACT_PACKAGES.has(packageOf(spec))) return { path: projectRequire.resolve(spec) };
  const pkg = packageOf(spec);
  const version = await pinVersion(pkg, npmDeps.get(pkg) ?? "");
  // esm.sh builds a module with just these exports. Its prebuilt modules can't be tree-shaken
  // here, so without this lucide-react alone adds every icon (~1 MB) to each render.
  const exports = only?.length ? `&exports=${[...only].sort().join(",")}` : "";
  return {
    path: `https://esm.sh/${pkg}@${version}${spec.slice(pkg.length)}?external=react,react-dom&target=es2022${exports}`,
    namespace: "esm",
  };
}

/**
 * Names imported per bare specifier across the registry code, when every import of it is a
 * plain named import (`import { A, B as C } from "x"`). Default, namespace, and side-effect
 * imports need the whole module, so those specifiers are left out.
 */
export function namedImports(sources: string[]): Map<string, string[]> {
  const named = new Map<string, Set<string>>();
  const whole = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/import\s+(type\s+)?([^'";]*?)\s+from\s+["']([^"']+)["']/g)) {
      const [, typeOnly, clause, spec] = match;
      if (typeOnly || spec.startsWith(".") || spec.startsWith("@/")) continue;
      const braces = clause.match(/^\{([^}]*)\}$/);
      if (!braces) {
        whole.add(spec);
        continue;
      }
      const names = braces[1]
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && !part.startsWith("type "))
        .map((part) => part.split(/\s+as\s+/)[0].trim());
      const set = named.get(spec) ?? new Set<string>();
      names.forEach((name) => set.add(name));
      named.set(spec, set);
    }
    for (const match of source.matchAll(/import\s+["']([^"']+)["']/g)) whole.add(match[1]);
  }
  return new Map([...named].filter(([spec]) => !whole.has(spec)).map(([spec, set]) => [spec, [...set]]));
}

const ESM_CACHE = path.join(process.cwd(), "node_modules", ".cache", "render-deps");

/**
 * esbuild loads every module of a bundle at once; unthrottled, one build opens hundreds of
 * connections to esm.sh and fails ("fetch failed"). Share in-flight fetches, cap concurrency,
 * and retry transient failures.
 */
const MAX_FETCHES = 8;
let activeFetches = 0;
const waiting: Array<() => void> = [];
const inFlight = new Map<string, Promise<string>>();

async function throttled<T>(task: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_FETCHES) await new Promise<void>((resume) => waiting.push(resume));
  activeFetches += 1;
  try {
    return await task();
  } finally {
    activeFetches -= 1;
    waiting.shift()?.();
  }
}

async function download(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) return await res.text();
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} for ${url}`);
      if (attempt >= 3) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      if (attempt >= 3 || (error instanceof Error && /^HTTP 4/.test(error.message))) throw error;
    }
    await new Promise((resume) => setTimeout(resume, 500 * 2 ** attempt));
  }
}

/** Root-relative asset paths written as literals in code or CSS: "/media/people/a.jpg". */
const ASSET_LITERAL =
  /(["'`(])\/((?:[\w.@-]+\/)*[\w.@-]+\.(?:png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|otf|json|lottie))(?=["'`)?#])/gi;

export function assetLiterals(sources: string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(ASSET_LITERAL)) found.add(`/${match[2]}`);
  }
  return [...found];
}

const ASSET_CACHE = path.join(process.cwd(), "node_modules", ".cache", "render-assets");
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

async function downloadAsset(url: string): Promise<{ body: Buffer; type: string } | null> {
  const key = path.join(ASSET_CACHE, createHash("sha1").update(url).digest("hex"));
  try {
    const [body, type] = await Promise.all([readFile(key), readFile(`${key}.type`, "utf8")]);
    return { body, type };
  } catch {
    // Not cached yet.
  }
  return throttled(async () => {
    const res = await fetch(url, {
      headers: { "user-agent": "ui-component-aggregator (demo asset mirror)" },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    const type = res?.headers.get("content-type")?.split(";")[0].trim() ?? "";
    // A 200 HTML page is a site's not-found page, not the asset.
    if (!res?.ok || !type || type === "text/html") return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.byteLength > MAX_ASSET_BYTES) return null;
    await mkdir(ASSET_CACHE, { recursive: true });
    await writeFile(key, body);
    await writeFile(`${key}.type`, type);
    return { body, type };
  });
}

/** Stores a mirrored asset and returns the URL the render should use instead. */
export type MirrorAsset = (sourcePath: string, body: Buffer, contentType: string) => Promise<string>;

/**
 * Demo code points at the library site's own files ("/media/photos/x.jpg"). Served from our
 * domain those 404, so copy each one once from the library and rewrite the reference. Paths
 * built at runtime (`/media/${id}.jpg`) can't be found this way and stay as they are.
 */
async function mirrorAssets(files: Map<string, string>, origin: string, mirror: MirrorAsset) {
  const paths = assetLiterals([...files.values()]);
  const replacements = new Map<string, string>();
  await Promise.all(
    paths.map(async (assetPath) => {
      const asset = await downloadAsset(`${origin}${assetPath}`);
      if (asset) replacements.set(assetPath, await mirror(assetPath, asset.body, asset.type));
    }),
  );
  if (!replacements.size) return;
  for (const [file, content] of files) {
    files.set(
      file,
      content.replace(ASSET_LITERAL, (whole, open: string, rest: string) => {
        const target = replacements.get(`/${rest}`);
        return target ? `${open}${target}` : whole;
      }),
    );
  }
}

function fetchModule(url: string): Promise<string> {
  const pending = inFlight.get(url);
  if (pending) return pending;
  const cached = path.join(ESM_CACHE, createHash("sha1").update(url).digest("hex"));
  const work = readFile(cached, "utf8").catch(async () => {
    const text = await throttled(() => download(url));
    await mkdir(ESM_CACHE, { recursive: true });
    await writeFile(cached, text);
    return text;
  });
  inFlight.set(url, work);
  work.catch(() => inFlight.delete(url));
  return work;
}

/**
 * Bundle esm.sh modules into the render at build time. Renders run in opaque-origin sandboxed
 * iframes, which share no HTTP cache, so loading modules at view time cost each card up to
 * hundreds of requests and megabytes; bundled, a card is one cacheable file. Modules fetched
 * here dedupe by URL exactly as they did in the browser.
 */
function remoteModules(npmDeps: Map<string, string>): Plugin {
  return {
    name: "esm-modules",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /.*/, namespace: "esm" }, async (args) => {
        if (/^https?:\/\//.test(args.path)) return { path: args.path, namespace: "esm" };
        if (args.path.startsWith("/") || args.path.startsWith(".")) {
          return { path: new URL(args.path, args.importer).toString(), namespace: "esm" };
        }
        return resolvePackage(args.path, npmDeps);
      });
      pluginBuild.onLoad({ filter: /.*/, namespace: "next-shim" }, (args) => ({
        contents: NEXT_SHIMS[args.path],
        loader: "js",
        resolveDir: process.cwd(),
      }));
      pluginBuild.onLoad({ filter: /.*/, namespace: "esm" }, async (args) => ({
        contents: await fetchModule(args.path),
        loader: args.path.split("?")[0].endsWith(".css") ? "css" : "js",
      }));
    },
  };
}

export type BuiltRender = { html: string; fileName: string; code: string };

/**
 * `component`: centered and scaled down to fit the card. `block` (page sections): laid out on
 * the page like a site, top-aligned; the card shows it on a scaled 1280px canvas, and the
 * quick view (`?mode=full`) lets it scroll.
 */
export type RenderLayout = "component" | "block";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function buildRender(
  component: ResolvedComponent,
  options: {
    categorySlug: string;
    globalStyles?: RegistryEntry[];
    layout?: RenderLayout;
    mirrorAsset?: MirrorAsset;
    /**
     * Render this module instead of the bare component: the author's usage example (see
     * lib/catalog/usage-examples.ts). It imports the component like an app would.
     */
    exampleModule?: string;
  },
): Promise<BuiltRender> {
  const layout = options.layout ?? "component";
  // Read before mirroring rewrites the files: the item page shows the library's own paths.
  const code = component.files.get(component.mainPath) ?? "";
  if (options.mirrorAsset) await mirrorAssets(component.files, component.origin, options.mirrorAsset);
  // Same map, not a copy: fetchMore adds undeclared imports to it during the build.
  const files = component.files;
  if (options.exampleModule) files.set("__example.tsx", options.exampleModule);
  files.set(
    "__entry.tsx",
    options.exampleModule
      ? entrySource("__example.tsx", null, "usage example", layout)
      : entrySource(component.mainPath, defaultChildren(options.categorySlug), component.entry.name, layout),
  );

  const bundle = (trimExports: boolean) =>
    build({
      entryPoints: ["__entry.tsx"],
      bundle: true,
      write: false,
      format: "esm",
      target: "es2022",
      outdir: "out",
      jsx: "automatic",
      minify: true,
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        virtualFiles(files, component.npmDeps, component.fetchMore, trimExports),
        remoteModules(component.npmDeps),
      ],
    });
  // esm.sh's `exports=` trimming can't see namespace re-exports (radix-ui's `Slot`) or some
  // aliases (lucide's `*Icon` names); when it drops a needed name, build with full modules.
  const result = await bundle(true).catch((error: { errors?: Array<{ text: string }> }) => {
    if (error.errors?.some((entry) => entry.text.startsWith("No matching export"))) return bundle(false);
    throw error;
  });
  const js = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  const componentCss = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
  const globalCss = [...(options.globalStyles ?? [])]
    .flatMap((style) => style.files ?? [])
    .filter((file) => file.path.endsWith(".css") && file.content)
    .map((file) => file.content!.replace(/@import\s+["'](tailwindcss|tw-animate-css)["'];?/g, ""))
    .join("\n");
  const sources = [...component.files.entries()]
    .filter(([file]) => SOURCE_EXT.test(file))
    .map(([, content]) => content);
  const css = await tailwindCss(
    sources,
    `${globalCss}\n${registryStylesheets(component.files)}\n${cssVarsToCss(options.globalStyles ?? [])}`,
  );

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(component.entry.title ?? component.entry.name)}</title>
<style>${css}</style>
<style>html,body{margin:0;height:100%;overflow:hidden;background:var(--background);color:var(--foreground);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
html.full,html.full body{overflow:auto}
${layout === "block" ? "#root{position:relative;width:100%;min-height:100%}" : "#root{position:relative;width:100%;height:100%;display:grid;place-items:center}"}${componentCss}</style>
</head><body><div id="root"></div><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

  const hash = createHash("sha256").update(html).digest("hex").slice(0, 10);
  return {
    html,
    fileName: `${component.entry.name}-${hash}.html`,
    code,
  };
}
