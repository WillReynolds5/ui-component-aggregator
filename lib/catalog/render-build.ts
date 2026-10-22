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
import path from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { build, type Plugin } from "esbuild";
import reactPackage from "react/package.json";
import {
  fetchJson,
  splitDependency,
  type Registry,
  type RegistryEntry,
} from "@/lib/catalog/registry";

const REACT_VERSION = reactPackage.version;
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
  return { entry, files, npmDeps, mainPath: normalizePath(main.path), fetchMore };
}

const CN_SOURCE = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) { return twMerge(clsx(inputs)); }`;

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];

function virtualFiles(files: Map<string, string>, fetchMore?: (name: string) => Promise<boolean>): Plugin {
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
      pluginBuild.onResolve({ filter: /.*/ }, async (args) => {
        if (args.kind === "entry-point") return { path: args.path, namespace: "reg" };
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
          return { path: args.path, external: true };
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

function entrySource(mainPath: string, children: string | null, componentName: string) {
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

// Scale oversized components down to fit the card; size-full components are left alone.
function fit() {
  const el = root.firstElementChild;
  if (!el) return;
  el.style.transform = "";
  const rect = el.getBoundingClientRect();
  const w = Math.max(el.scrollWidth, rect.width), h = Math.max(el.scrollHeight, rect.height);
  const scale = Math.min(1, (innerWidth - 24) / w, (innerHeight - 24) / h);
  if (scale < 1 && scale > 0) { el.style.transformOrigin = "center"; el.style.transform = "scale(" + scale + ")"; }
}
// Refit whenever the component itself changes size (content loading in, accordions opening).
// The transform doesn't change its layout size, so this can't loop.
const sizeWatch = new ResizeObserver(fit);
sizeWatch.observe(root);
new MutationObserver(() => {
  if (root.firstElementChild) sizeWatch.observe(root.firstElementChild);
}).observe(root, { childList: true });
addEventListener("resize", fit);

function looksBlank() {
  const el = root.firstElementChild;
  if (!el) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return true;
  if (el.innerText && el.innerText.trim()) return false;
  if (el.querySelector("svg, canvas, img, video, input, textarea, select, button, iframe")) return false;
  const style = getComputedStyle(el);
  return style.backgroundImage === "none" && /rgba\\(0, 0, 0, 0\\)|transparent/.test(style.backgroundColor) && style.borderStyle === "none";
}

setTimeout(() => {
  fit();
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
    (files.get(file) ?? "").replace(/@import\s+["']([^"']+)["'];?/g, (whole, target: string) => {
      if (target === "tailwindcss" || target === "tw-animate-css") return "";
      const local = byBase.get(path.posix.basename(target));
      if (!local || inlined.has(local)) return local ? "" : whole;
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

async function tailwindCss(sources: string[], extraCss: string) {
  const scanner = new Scanner({});
  const candidates = scanner.scanFiles(sources.map((content) => ({ content, extension: "tsx" })));
  const compiler = await compile(
    `@import "tailwindcss"; @import "tw-animate-css"; ${THEME_CSS}\n${extraCss}`,
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

async function importMap(specifiers: Set<string>, npmDeps: Map<string, string>) {
  const imports: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
    "react-dom": `https://esm.sh/react-dom@${REACT_VERSION}?external=react`,
    "react-dom/client": `https://esm.sh/react-dom@${REACT_VERSION}/client?external=react`,
  };
  for (const spec of specifiers) {
    if (imports[spec]) continue;
    const pkg = packageOf(spec);
    const version = await pinVersion(pkg, npmDeps.get(pkg) ?? "");
    imports[spec] = `https://esm.sh/${pkg}@${version}${spec.slice(pkg.length)}?external=react,react-dom`;
  }
  return imports;
}

export type BuiltRender = { html: string; fileName: string; code: string };

export async function buildRender(
  component: ResolvedComponent,
  options: { categorySlug: string; globalStyles?: RegistryEntry[] },
): Promise<BuiltRender> {
  // Same map, not a copy: fetchMore adds undeclared imports to it during the build.
  const files = component.files;
  files.set(
    "__entry.tsx",
    entrySource(component.mainPath, defaultChildren(options.categorySlug), component.entry.name),
  );

  const result = await build({
    entryPoints: ["__entry.tsx"],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    outdir: "out",
    jsx: "automatic",
    minify: true,
    logLevel: "silent",
    metafile: true,
    plugins: [virtualFiles(files, component.fetchMore)],
  });
  const js = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  const componentCss = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
  const specifiers = new Set(
    Object.values(result.metafile.outputs).flatMap((output) =>
      output.imports.filter((entry) => entry.external).map((entry) => entry.path),
    ),
  );

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
  const imports = await importMap(specifiers, component.npmDeps);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${component.entry.title ?? component.entry.name}</title>
<script type="importmap">${JSON.stringify({ imports }).replace(/</g, "\\u003c")}</script>
<style>${css}</style>
<style>html,body{margin:0;height:100%;overflow:hidden;background:var(--background);color:var(--foreground);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
#root{position:relative;width:100%;height:100%;display:grid;place-items:center}${componentCss}</style>
</head><body><div id="root"></div><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

  const hash = createHash("sha256").update(html).digest("hex").slice(0, 10);
  return {
    html,
    fileName: `${component.entry.name}-${hash}.html`,
    code: component.files.get(component.mainPath) ?? "",
  };
}
