/**
 * Import every shadcn/ui component from the public registry into the catalog.
 * Idempotent: items are matched by sourceUrl (the docs page), so re-running updates in place.
 *
 *   AWS_PROFILE=personal AURORA_CLUSTER_ARN=... AURORA_SECRET_ARN=... AURORA_DATABASE=component_library \
 *   CAPTURE_FUNCTION_NAME=... npx tsx scripts/import-shadcn.ts [--dry-run]
 */
import "dotenv/config";
import { ingestMappedItems } from "@/lib/catalog/ingest";
import { requestPreviewCapture } from "@/lib/catalog/capture-trigger";
import type { MappedItem } from "@/lib/catalog/mapping";
import { validCategorySlugs } from "@/lib/catalog/taxonomy";

const REGISTRY = "https://ui.shadcn.com/r";
const STYLE = "new-york-v4";

/** shadcn registry name -> catalog category slug. Anything unlisted lands in "other". */
const CATEGORY: Record<string, string> = {
  accordion: "accordions", alert: "alerts", "alert-dialog": "dialogs", "aspect-ratio": "cards",
  attachment: "file-uploads", avatar: "avatars", badge: "badges", breadcrumb: "breadcrumbs",
  bubble: "chat", button: "buttons", "button-group": "buttons", calendar: "calendars",
  card: "cards", carousel: "carousels", chart: "charts", checkbox: "checkboxes",
  "code-block": "code-blocks", collapsible: "accordions", combobox: "selects",
  command: "command-menus", "context-menu": "context-menus", dialog: "dialogs",
  drawer: "drawers", "dropdown-menu": "dropdown-menus", empty: "empty-states", field: "forms",
  form: "forms", "hover-card": "popovers", input: "text-inputs", "input-group": "text-inputs",
  "input-otp": "otp-inputs", item: "lists", kbd: "badges", label: "forms", marker: "badges",
  menubar: "dropdown-menus", message: "chat", "message-scroller": "chat",
  "native-select": "selects", "navigation-menu": "navbars", pagination: "pagination",
  popover: "popovers", progress: "progress", questionnaire: "forms", "radio-group": "checkboxes",
  resizable: "dashboard", "scroll-area": "lists", select: "selects", separator: "other",
  sheet: "drawers", sidebar: "sidebars", skeleton: "loaders", slider: "sliders", sonner: "toasts",
  spinner: "loaders", switch: "switches", table: "tables", tabs: "tabs", textarea: "text-inputs",
  toast: "toasts", toggle: "toggles", "toggle-group": "toggles", tooltip: "tooltips",
  trace: "traces", direction: "other",
};

type RegistryFile = { path: string; content?: string };
type RegistryItem = {
  name: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  files?: RegistryFile[];
};

function titleCase(name: string) {
  return name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const valid = validCategorySlugs();
  const index = await getJson<RegistryItem[]>(`${REGISTRY}/index.json`);
  const mapped: MappedItem[] = [];
  const skipped: string[] = [];

  for (const entry of index) {
    let item: RegistryItem;
    try {
      item = await getJson<RegistryItem>(`${REGISTRY}/styles/${STYLE}/${entry.name}.json`);
    } catch (error) {
      skipped.push(`${entry.name}: ${(error as Error).message}`);
      continue;
    }
    const category = CATEGORY[entry.name] ?? "other";
    if (!valid.has(category)) throw new Error(`Bad category ${category} for ${entry.name}`);
    const docsUrl = `https://ui.shadcn.com/docs/components/${entry.name}`;
    const name = item.title ?? entry.title ?? titleCase(entry.name);
    const code = (item.files ?? [])
      .filter((f) => f.content)
      .map((f, _i, all) => (all.length > 1 ? `// ${f.path}\n${f.content}` : f.content!))
      .join("\n\n");
    mapped.push({
      name: `${name} (shadcn/ui)`,
      slugHint: `shadcn-${entry.name}`,
      kind: "component",
      description:
        item.description ?? entry.description ?? `The shadcn/ui ${name} component.`,
      framework: "react",
      styling: "tailwind",
      dependencies: item.dependencies ?? entry.dependencies ?? [],
      pricing: "free",
      license: "MIT",
      access: "full_code",
      code: code || null,
      installCommand: `npx shadcn@latest add ${entry.name}`,
      sourceUrl: docsUrl,
      sourceName: "shadcn/ui",
      sourceHomepage: "https://ui.shadcn.com",
      sourceRepoUrl: "https://github.com/shadcn-ui/ui",
      sourceRegistryUrl: `${REGISTRY}/styles/${STYLE}/${entry.name}.json`,
      creatorName: "shadcn",
      creatorSlug: "shadcn",
      creatorHandle: "shadcn",
      creatorWebsite: "https://ui.shadcn.com",
      discoveredViaPostUrl: null,
      discoveredAt: new Date(),
      categorySlug: category,
      tags: ["shadcn", "radix", "tailwind", "react"],
      media: [{ kind: "demo_url", url: docsUrl, alt: `${name} demo` }],
    });
  }

  console.log(`Mapped ${mapped.length}, skipped ${skipped.length}`, skipped);
  if (dryRun) {
    console.table(mapped.map((m) => ({ name: m.name, category: m.categorySlug, code: m.code?.length ?? 0 })));
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
