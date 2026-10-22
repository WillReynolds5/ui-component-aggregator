/**
 * Index Kobra (https://kobra.systems) components into the catalog. Idempotent: matched by sourceUrl.
 *
 * Kobra's terms forbid publishing its source anywhere it can be obtained without a license
 * (the 10 free components are "personal use only"), so this stores link + metadata only — no code.
 *
 *   AWS_PROFILE=personal AURORA_CLUSTER_ARN=... AURORA_SECRET_ARN=... AURORA_DATABASE=component_library \
 *   CAPTURE_FUNCTION_NAME=... npx tsx scripts/import-kobra.ts [--dry-run]
 */
import "dotenv/config";
import { ingestMappedItems } from "@/lib/catalog/ingest";
import { requestPreviewCapture } from "@/lib/catalog/capture-trigger";
import type { MappedItem } from "@/lib/catalog/mapping";
import { validCategorySlugs } from "@/lib/catalog/taxonomy";

const SITE = "https://kobra.systems";

const CATEGORY: Record<string, string> = {
  accordion: "accordions", advertisement: "cards", "ai-editor": "generative-ui", alert: "alerts",
  "aspect-ratio": "cards", avatar: "avatars", badge: "badges", breadcrumb: "breadcrumbs",
  button: "buttons", calendar: "calendars", card: "cards", "halftone-dots": "backgrounds-shaders",
  "logo-carousel": "testimonials", carousel: "carousels", chart: "charts", checkbox: "checkboxes",
  collapsible: "accordions", "color-palette": "selects", "color-picker": "selects",
  "icon-picker": "selects", combobox: "selects", "multi-select": "selects",
  "command-menu": "command-menus", "context-menu": "context-menus", dialog: "dialogs",
  drawer: "drawers", "dropdown-menu": "dropdown-menus", empty: "empty-states", form: "forms",
  "hover-card": "popovers", lightbox: "dialogs", input: "text-inputs", "input-otp": "otp-inputs",
  "input-dissolve": "text-inputs", item: "lists", menubar: "dropdown-menus",
  "navigation-menu": "navbars", pagination: "pagination", popover: "popovers", progress: "progress",
  "qr-code": "other", "radio-group": "checkboxes", resizable: "dashboard", "scroll-area": "lists",
  select: "selects", separator: "other", sheet: "drawers", sidebar: "sidebars", skeleton: "loaders",
  slider: "sliders", sound: "sound", toast: "toasts", spinner: "loaders", switch: "switches",
  table: "tables", "crm-table": "tables", "grouped-table": "tables", tabs: "tabs",
  textarea: "text-inputs", "toggle-group": "toggles", "filter-chips": "toggles", tooltip: "tooltips",
  kbd: "badges", direction: "other", attachment: "file-uploads", "magnetic-dropzone": "file-uploads",
  conversation: "chat", marker: "badges", message: "chat", "message-scroller": "chat",
  video: "media-players", "reasoning-steps": "traces", "chat-history": "chat",
  "document-agent": "generative-ui", "trace-waterfall": "traces", "file-diff": "diffs",
  "image-generation": "generative-ui", "streaming-text": "chat", "inline-citations": "chat",
  "code-block": "code-blocks", "task-list": "tool-calls", "chat-input": "prompt-inputs",
  "plan-card": "tool-calls", "question-card": "tool-calls",
};

type Entry = { name: string; type: string; title?: string; description?: string; dependencies?: string[] };

async function isFree(name: string) {
  const res = await fetch(`${SITE}/r/${name}.json`);
  return res.status === 200; // paid items answer 401 without a token
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const valid = validCategorySlugs();
  const registry = (await (await fetch(`${SITE}/r/registry.json`)).json()) as { items: Entry[] };
  const ui = registry.items.filter((i) => i.type === "registry:ui");
  const skipped = registry.items.filter((i) => i.type !== "registry:ui").map((i) => `${i.name} (${i.type})`);
  const mapped: MappedItem[] = [];

  for (const entry of ui) {
    const category = CATEGORY[entry.name] ?? "other";
    if (!valid.has(category)) throw new Error(`Bad category ${category} for ${entry.name}`);
    const free = await isFree(entry.name);
    const url = `${SITE}/components/${entry.name}`;
    const name = entry.title ?? entry.name;
    mapped.push({
      name: `${name} (Kobra)`,
      slugHint: `kobra-${entry.name}`,
      kind: "component",
      description: [
        entry.description,
        free
          ? "Free Kobra component (personal use only)."
          : "Part of Kobra's paid library (one-time license; registry token required).",
      ].filter(Boolean).join("\n\n"),
      framework: "react",
      styling: "tailwind",
      dependencies: entry.dependencies ?? [],
      pricing: free ? "free" : "paid",
      license: free ? "Kobra Free (personal use only)" : "Kobra commercial license",
      access: "install_only",
      code: null,
      installCommand: `npx shadcn@latest add @kobra/${entry.name}`,
      sourceUrl: url,
      sourceName: "Kobra",
      sourceHomepage: SITE,
      sourceRepoUrl: null,
      sourceRegistryUrl: `${SITE}/r/${entry.name}.json`,
      creatorName: "Kobra",
      creatorSlug: "kobra",
      creatorHandle: null,
      creatorWebsite: SITE,
      discoveredViaPostUrl: null,
      discoveredAt: new Date(),
      categorySlug: category,
      tags: ["kobra", "shadcn", "base-ui", "tailwind", "react", free ? "free" : "paid"],
      media: [{ kind: "demo_url", url, alt: `${name} demo` }],
    });
  }

  console.log(`Mapped ${mapped.length} (${mapped.filter((m) => m.pricing === "free").length} free), skipped`, skipped);
  if (dryRun) {
    console.table(mapped.map((m) => ({ name: m.name, category: m.categorySlug, pricing: m.pricing })));
    return;
  }
  const result = await ingestMappedItems(mapped);
  console.log(`created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`);
  console.log("previews:", await requestPreviewCapture(result.itemIds));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
