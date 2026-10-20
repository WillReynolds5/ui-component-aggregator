export type TaxonomyNode = {
  slug: string;
  name: string;
  description: string;
  children?: TaxonomyNode[];
};

export const TAXONOMY: TaxonomyNode[] = [
  {
    slug: "components",
    name: "Components",
    description: "Reusable UI primitives you drop into a screen.",
    children: [
      {
        slug: "buttons",
        name: "Buttons",
        description: "Buttons, icon buttons, and button groups.",
      },
      {
        slug: "inputs",
        name: "Inputs",
        description: "Text fields, selects, sliders, and forms.",
      },
      {
        slug: "cards",
        name: "Cards",
        description: "Content cards, tiles, and list rows.",
      },
      {
        slug: "navigation",
        name: "Navigation",
        description: "Nav bars, tabs, breadcrumbs, and menus.",
      },
      {
        slug: "overlays",
        name: "Overlays",
        description: "Dialogs, sheets, drawers, and popovers.",
      },
      {
        slug: "data-display",
        name: "Data Display",
        description: "Tables, lists, markdown, and media players.",
      },
      {
        slug: "feedback",
        name: "Feedback",
        description: "Toasts, skeletons, loaders, and empty states.",
      },
      {
        slug: "charts",
        name: "Charts",
        description: "Charts, gauges, and data viz widgets.",
      },
    ],
  },
  {
    slug: "blocks",
    name: "Blocks",
    description: "Larger page sections composed from components.",
    children: [
      { slug: "hero", name: "Hero", description: "Hero and landing intros." },
      {
        slug: "pricing",
        name: "Pricing",
        description: "Pricing tables and plan comparison.",
      },
      {
        slug: "features",
        name: "Features",
        description: "Feature grids and product highlights.",
      },
      { slug: "footer", name: "Footer", description: "Site footers and link columns." },
      { slug: "auth", name: "Auth", description: "Sign-in, sign-up, and onboarding." },
      {
        slug: "dashboard",
        name: "Dashboard",
        description: "App shells, sidebars, and admin layouts.",
      },
    ],
  },
  {
    slug: "ai-agent-ui",
    name: "AI & Agent UI",
    description: "Interfaces for chats, tools, traces, and generative UI.",
    children: [
      { slug: "chat", name: "Chat", description: "Chat threads and composer UIs." },
      { slug: "diffs", name: "Diffs", description: "Code and content diffs." },
      { slug: "traces", name: "Traces", description: "Agent traces and activity." },
      {
        slug: "tool-calls",
        name: "Tool Calls",
        description: "Tool-call cards and run inspectors.",
      },
    ],
  },
  {
    slug: "animation-effects",
    name: "Animation / Effects",
    description: "Motion, micro-interactions, sound, and transitions.",
  },
  {
    slug: "backgrounds-shaders",
    name: "Backgrounds / Shaders",
    description: "Gradients, shaders, and atmospheric backgrounds.",
  },
  {
    slug: "3d",
    name: "3D",
    description: "WebGL, Three.js, and spatial UI.",
  },
];

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

const CATEGORY_ALIASES: Record<string, string> = {
  library: "components",
  component: "components",
  "design system": "components",
  "design tooling": "components",
  "DESIGN.md library": "components",
  "DESIGN.md generator": "components",
  "DESIGN.md/type": "components",
  icons: "components",
  wireframe: "components",
  spec: "components",
  button: "buttons",
  buttons: "buttons",
  input: "inputs",
  inputs: "inputs",
  card: "cards",
  cards: "cards",
  navigation: "navigation",
  nav: "navigation",
  overlay: "overlays",
  overlays: "overlays",
  "gesture/drawer": "overlays",
  drawer: "overlays",
  "markdown/content": "data-display",
  table: "data-display",
  diagram: "data-display",
  "audio player": "data-display",
  "typography/label": "data-display",
  "skeleton/loading": "feedback",
  "gauge/chart": "charts",
  chart: "charts",
  "landing page": "hero",
  "hero/landing page": "hero",
  hero: "hero",
  "landing page templates": "hero",
  dashboard: "dashboard",
  layout: "dashboard",
  "layout/spacing": "dashboard",
  pricing: "pricing",
  features: "features",
  footer: "footer",
  auth: "auth",
  animation: "animation-effects",
  "animation/transition": "animation-effects",
  "animation/video": "animation-effects",
  "text animation": "animation-effects",
  "micro-interaction": "animation-effects",
  "sound/interaction": "animation-effects",
  visual: "animation-effects",
  "gradient/background": "backgrounds-shaders",
  background: "backgrounds-shaders",
  shader: "backgrounds-shaders",
  "3D/webgl": "3d",
  "3d": "3d",
  webgl: "3d",
  "ai/generative ui": "ai-agent-ui",
  "ai/agent activity": "traces",
  "AI site builder": "ai-agent-ui",
  "AI design tool": "ai-agent-ui",
  chat: "chat",
  diffs: "diffs",
  traces: "traces",
  "tool calls": "tool-calls",
  inspiration: "components",
};

export function mapScrapeCategory(raw: string | null | undefined): string {
  if (!raw) return "components";
  const key = raw.trim();
  return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.toLowerCase()] ?? "components";
}

export function validCategorySlugs(nodes: TaxonomyNode[] = TAXONOMY): Set<string> {
  return new Set(flattenTaxonomy(nodes).map((node) => node.slug));
}
