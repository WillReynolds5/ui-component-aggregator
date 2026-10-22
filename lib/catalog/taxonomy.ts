export type TaxonomyNode = {
  slug: string;
  name: string;
  description: string;
  /** Extra raw scrape labels that should land on this node. */
  aliases?: string[];
  children?: TaxonomyNode[];
};

function leaf(
  slug: string,
  name: string,
  description: string,
  aliases: string[] = [],
): TaxonomyNode {
  return { slug, name, description, aliases };
}

/**
 * Top-level nodes are sidebar sections; children are the element types people browse.
 * Slugs are stable ids (items reference them), so rename `name`, never `slug`.
 */
export const TAXONOMY: TaxonomyNode[] = [
  {
    slug: "libraries",
    name: "Libraries",
    description: "Complete component libraries, kits, and design systems.",
    aliases: ["library", "component library", "design system", "ui kit", "kit"],
  },
  {
    slug: "actions",
    name: "Actions",
    description: "Things people click, press, and toggle.",
    children: [
      leaf("buttons", "Buttons", "Buttons, icon buttons, and button groups.", ["button", "cta button"]),
      leaf("dropdown-menus", "Dropdown menus", "Menus that open from a trigger.", ["dropdown", "dropdown menu", "menu"]),
      leaf("context-menus", "Context menus", "Right-click and long-press menus.", ["context menu", "right click menu"]),
      leaf("command-menus", "Command menus", "Command palettes and ⌘K launchers.", ["command palette", "command menu", "cmdk", "spotlight", "command"]),
      leaf("toggles", "Toggles", "Toggle buttons and segmented controls.", ["toggle", "segmented control", "toggle group"]),
    ],
  },
  {
    slug: "inputs",
    name: "Forms & inputs",
    description: "Fields and controls for entering data.",
    children: [
      leaf("text-inputs", "Text inputs", "Text fields, textareas, and search boxes.", ["input", "text input", "textarea", "search input", "text field"]),
      leaf("selects", "Selects", "Selects, comboboxes, and multi-selects.", ["select", "combobox", "multiselect", "multi select", "autocomplete", "cascader"]),
      leaf("checkboxes", "Checkboxes & radios", "Checkboxes, radio groups, and choice cards.", ["checkbox", "radio", "radio group"]),
      leaf("switches", "Switches", "On/off switches.", ["switch"]),
      leaf("sliders", "Sliders", "Range sliders and knobs.", ["slider", "range", "knob", "dial"]),
      leaf("date-pickers", "Date pickers", "Date, time, and range pickers.", ["date picker", "datepicker", "time picker", "calendar picker"]),
      leaf("file-uploads", "File uploads", "Dropzones and upload progress.", ["file upload", "upload", "dropzone", "drop zone"]),
      leaf("otp-inputs", "OTP inputs", "One-time code and PIN fields.", ["otp", "otp input", "pin input"]),
      leaf("forms", "Forms", "Complete forms and multi-step flows.", ["form", "multi-step form", "wizard", "filter", "filters", "signup form"]),
    ],
  },
  {
    slug: "navigation",
    name: "Navigation",
    description: "Ways to move around an app or site.",
    children: [
      leaf("navbars", "Navbars", "Top bars and headers.", ["navbar", "nav", "header", "nav bar", "top bar", "menubar", "navigation menu"]),
      leaf("sidebars", "Sidebars", "Side navigation and app rails.", ["sidebar", "side nav", "rail"]),
      leaf("tabs", "Tabs", "Tab bars and underline tabs.", ["tab", "tab bar"]),
      leaf("breadcrumbs", "Breadcrumbs", "Location trails.", ["breadcrumb"]),
      leaf("pagination", "Pagination", "Page controls and load-more.", ["pager"]),
      leaf("docks", "Docks", "macOS-style docks and floating bars.", ["dock", "floating bar"]),
    ],
  },
  {
    slug: "overlays",
    name: "Overlays",
    description: "Layers that sit above the page.",
    children: [
      leaf("dialogs", "Dialogs", "Modals, alerts dialogs, and lightboxes.", ["dialog", "modal", "lightbox", "alert dialog"]),
      leaf("drawers", "Drawers & sheets", "Bottom sheets, side sheets, and drawers.", ["drawer", "sheet", "bottom sheet", "gesture/drawer"]),
      leaf("popovers", "Popovers", "Anchored panels and hover cards.", ["popover", "hover card"]),
      leaf("tooltips", "Tooltips", "Hint bubbles.", ["tooltip"]),
    ],
  },
  {
    slug: "data-display",
    name: "Data display",
    description: "Ways to show content and records.",
    children: [
      leaf("cards", "Cards", "Content cards, tiles, and bento grids.", ["card", "bento", "tile", "widget"]),
      leaf("tables", "Tables", "Data tables and grids.", ["table", "data table", "data grid"]),
      leaf("lists", "Lists", "Lists, feeds, and kanban columns.", ["list", "feed", "kanban", "tree", "tree view"]),
      leaf("avatars", "Avatars", "Avatars and avatar stacks.", ["avatar"]),
      leaf("badges", "Badges", "Badges, tags, and chips.", ["badge", "chip", "tag", "pill", "status dot"]),
      leaf("accordions", "Accordions", "Collapsible sections and FAQs.", ["accordion", "collapsible", "disclosure"]),
      leaf("carousels", "Carousels", "Sliders, marquees, and galleries.", ["carousel", "marquee", "gallery"]),
      leaf("calendars", "Calendars", "Calendars and schedulers.", ["calendar", "scheduler"]),
      leaf("timelines", "Timelines", "Timelines and activity logs.", ["timeline", "activity log", "gantt"]),
      leaf("media-players", "Media players", "Audio and video players.", ["audio player", "video player", "player", "recorder", "waveform", "visualizer", "spectrum", "level meter", "fader", "volume control", "pan control", "clip indicator", "db readout", "db scale"]),
      leaf("code-blocks", "Code blocks", "Code blocks and syntax highlighting.", ["code block", "code", "syntax highlighting", "terminal"]),
      leaf("markdown", "Markdown & content", "Markdown, MDX, and rich text.", ["markdown/content", "markdown", "mdx", "rich text", "typography/label", "changelog", "quote", "annotate", "endpoint", "decision", "kbd", "keys"]),
      leaf("diagrams", "Diagrams", "Flowcharts and node graphs.", ["diagram", "flowchart", "node graph"]),
    ],
  },
  {
    slug: "feedback",
    name: "Feedback",
    description: "Status, progress, and messages.",
    children: [
      leaf("toasts", "Toasts", "Toasts and snackbars.", ["toast", "snackbar", "notification", "sonner"]),
      leaf("alerts", "Alerts & banners", "Inline alerts and banners.", ["alert", "banner", "callout", "announcement"]),
      leaf("progress", "Progress", "Progress bars, rings, and steppers.", ["progress bar", "stepper", "steps"]),
      leaf("loaders", "Loaders & skeletons", "Spinners, skeletons, and shimmer.", ["skeleton/loading", "skeleton", "loader", "spinner", "loading", "shimmer"]),
      leaf("empty-states", "Empty states", "Zero-data and error screens.", ["empty state", "404", "error page", "empty"]),
    ],
  },
  {
    slug: "charts",
    name: "Charts",
    description: "Charts, gauges, and data viz widgets.",
    aliases: ["chart", "gauge/chart", "gauge", "data viz", "graph"],
  },
  {
    slug: "blocks",
    name: "Page sections",
    description: "Larger sections composed from components.",
    children: [
      leaf("hero", "Hero", "Hero and landing intros.", ["hero/landing page"]),
      leaf("landing-pages", "Landing pages", "Full landing pages and templates.", ["landing page", "landing page templates", "website", "template"]),
      leaf("features", "Features", "Feature grids and product highlights.", ["feature", "feature section"]),
      leaf("pricing", "Pricing", "Pricing tables and plan comparison.", ["pricing table"]),
      leaf("testimonials", "Testimonials", "Quotes, logos, and social proof.", ["testimonial", "social proof", "logo cloud"]),
      leaf("cta", "Call to action", "CTA and newsletter sections.", ["call to action", "newsletter"]),
      leaf("faq", "FAQ", "Question-and-answer sections.", []),
      leaf("footer", "Footer", "Site footers and link columns.", ["footers"]),
      leaf("auth", "Auth", "Sign-in, sign-up, and password screens.", ["login", "sign in", "signup", "sign up"]),
      leaf("onboarding", "Onboarding", "Welcome flows and checklists.", ["welcome"]),
      leaf("dashboard", "Dashboards", "App shells and admin layouts.", ["layout", "layout/spacing", "admin", "app shell"]),
      leaf("settings", "Settings", "Settings and account pages.", ["preferences", "account"]),
    ],
  },
  {
    slug: "ai-agent-ui",
    name: "AI & agent UI",
    description: "Interfaces for chats, tools, traces, and generative UI.",
    children: [
      leaf("chat", "Chat", "Chat threads and message bubbles.", ["chat ui", "messages"]),
      leaf("prompt-inputs", "Prompt inputs", "Composers and prompt boxes.", ["prompt input", "composer", "prompt box", "voice", "voice input"]),
      leaf("generative-ui", "Generative UI", "UI rendered by models.", ["ai/generative ui", "generative ui"]),
      leaf("diffs", "Diffs", "Code and content diffs.", ["diff", "merge conflict"]),
      leaf("traces", "Traces", "Agent traces and activity.", ["ai/agent activity", "trace", "agent activity"]),
      leaf("tool-calls", "Tool calls", "Tool-call cards and run inspectors.", ["tool call"]),
    ],
  },
  {
    slug: "effects",
    name: "Motion & effects",
    description: "Motion, interaction, and atmosphere.",
    children: [
      leaf("animation-effects", "Animations", "Transitions and motion primitives.", ["animation", "animation/transition", "animation/video", "transition", "motion"]),
      leaf("text-effects", "Text effects", "Animated and styled type.", ["text animation", "text effect", "animated counter", "counter"]),
      leaf("micro-interactions", "Micro-interactions", "Small, delightful interaction details.", ["micro-interaction", "micro interaction", "gesture"]),
      leaf("sound", "Sound", "UI sounds and haptics.", ["sound/interaction", "ui sound", "audio"]),
      leaf("backgrounds-shaders", "Backgrounds & shaders", "Gradients, shaders, and atmospheric backgrounds.", ["gradient/background", "background", "shader", "gradient"]),
      leaf("3d", "3D", "WebGL, Three.js, and spatial UI.", ["3d/webgl", "webgl", "three.js"]),
      leaf("cursors", "Cursors", "Custom cursors and pointer effects.", ["cursor"]),
    ],
  },
  {
    slug: "resources",
    name: "Resources",
    description: "Tools, references, and ideas for building UI.",
    children: [
      leaf("design-tools", "Design tools", "Generators, builders, and AI design tools.", ["design tooling", "ai site builder", "ai design tool", "wireframe", "tool"]),
      leaf("design-md", "DESIGN.md & specs", "DESIGN.md files, style specs, and tokens.", ["design.md library", "design.md generator", "design.md/type", "spec", "design tokens"]),
      leaf("icons", "Icons", "Icon sets and icon references.", ["icon", "icon set"]),
      leaf("inspiration", "Inspiration", "Shots, showcases, and visual references.", ["visual", "showcase", "talk"]),
      leaf("guides", "Guides & tips", "Tutorials, techniques, and design tips.", ["tutorial", "technique", "tip", "guide"]),
      leaf("other", "Other", "Everything that does not fit elsewhere yet.", []),
    ],
  },
];

export const FALLBACK_CATEGORY = "other";

export function flattenTaxonomy(
  nodes: TaxonomyNode[] = TAXONOMY,
  parentSlug: string | null = null,
  startOrder = 0,
): Array<TaxonomyNode & { parentSlug: string | null; sortOrder: number }> {
  const rows: Array<TaxonomyNode & { parentSlug: string | null; sortOrder: number }> =
    [];
  nodes.forEach((node, index) => {
    rows.push({ ...node, parentSlug, sortOrder: startOrder + index });
    if (node.children?.length) {
      rows.push(...flattenTaxonomy(node.children, node.slug, 0));
    }
  });
  return rows;
}

function normalize(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Every label (slug, name, singular name, aliases) → slug. Built once from TAXONOMY. */
const CATEGORY_ALIASES: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const node of flattenTaxonomy()) {
    const labels = [node.slug, node.name, node.name.replace(/s$/i, ""), ...(node.aliases ?? [])];
    for (const label of labels) {
      const key = normalize(label);
      if (!map.has(key)) map.set(key, node.slug);
    }
  }
  return map;
})();

/**
 * Scrape `type` values that say what the thing IS. They beat `category`, which often only
 * describes a theme ("animation" for an animation-focused library, "layout" for a spacing tip).
 */
const TYPE_ALIASES: Record<string, string> = {
  "component library": "libraries",
  library: "libraries",
  "design system": "libraries",
  tool: "design-tools",
  resource: "design-md",
  spec: "design-md",
  tutorial: "guides",
  technique: "guides",
  talk: "inspiration",
};

export function mapScrapeCategory(
  raw: string | null | undefined,
  type?: string | null,
): string {
  const category = raw ? normalize(raw) : "";
  const kind = type ? normalize(type) : "";
  if (kind && TYPE_ALIASES[kind]) return TYPE_ALIASES[kind];

  const byCategory = category ? CATEGORY_ALIASES.get(category) : undefined;
  if (byCategory) return byCategory;

  // A known label inside a compound like "animated dropdown/menu".
  for (const part of category.split(/[/,&+]| and /)) {
    const hit = CATEGORY_ALIASES.get(part.trim());
    if (hit) return hit;
  }
  if (kind === "inspiration") return "inspiration";
  return FALLBACK_CATEGORY;
}

/** A known taxonomy slug for this exact label (name, slug, or alias), or undefined. */
export function lookupCategory(label: string): string | undefined {
  return CATEGORY_ALIASES.get(normalize(label));
}

export function validCategorySlugs(nodes: TaxonomyNode[] = TAXONOMY): Set<string> {
  return new Set(flattenTaxonomy(nodes).map((node) => node.slug));
}
