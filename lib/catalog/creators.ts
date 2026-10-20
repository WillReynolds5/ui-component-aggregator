import { handleToName, slugify } from "@/lib/catalog/slug";

type CreatorInput = {
  post_text?: string | null;
  author_handle?: string | null;
  component_name?: string | null;
  demo_url?: string | null;
  code_path?: string | null;
  source_post_kind?: string | null;
};

export type InferredCreator = {
  name: string;
  slug: string;
  xHandle: string | null;
  website: string | null;
};

type CreatorRecord = InferredCreator;

const CREATORS: Record<string, CreatorRecord> = {
  shadcn: {
    name: "shadcn",
    slug: "shadcn",
    xHandle: "shadcn",
    website: "https://ui.shadcn.com",
  },
  "animate-ui": {
    name: "Animate UI",
    slug: "animate-ui",
    xHandle: "animate_ui",
    website: "https://animate-ui.com",
  },
  heroui: {
    name: "HeroUI",
    slug: "heroui",
    xHandle: "hero_ui",
    website: "https://www.heroui.com",
  },
  "three-js": {
    name: "three.js",
    slug: "three-js",
    xHandle: "threejs",
    website: "https://threejs.org",
  },
};

/** Keys (lowercase) that collapse onto a canonical creator slug. */
const ALIASES: Record<string, string> = {
  shadcn: "shadcn",
  "shadcn-ui": "shadcn",
  "shadcn-labs": "shadcn",
  animate_ui: "animate-ui",
  "animate-ui": "animate-ui",
  imskyleen: "animate-ui",
  "heroui-inc": "heroui",
  heroui: "heroui",
  threejs: "three-js",
  "three.js": "three-js",
  "three-js": "three-js",
};

const DEMO_HOST_ALIASES: Record<string, string> = {
  "ui.shadcn.com": "shadcn",
  "shadcn.com": "shadcn",
  "mdxcn.dev": "shadcn",
  "animate-ui.com": "animate-ui",
  "heroui.com": "heroui",
  "www.heroui.com": "heroui",
};

function canonical(key: string): CreatorRecord {
  const normalized = key.replace(/^@/, "").trim();
  const alias = ALIASES[normalized.toLowerCase()] ?? ALIASES[slugify(normalized)];
  if (alias && CREATORS[alias]) return CREATORS[alias];
  const slug = slugify(normalized);
  const looksLikeHandle = /^[A-Za-z0-9_]{1,15}$/.test(normalized);
  return {
    name: handleToName(normalized),
    slug,
    xHandle: looksLikeHandle ? normalized : null,
    website: looksLikeHandle ? `https://x.com/${normalized}` : null,
  };
}

export function quotedHandle(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b(?:by|quote of)\s+@([A-Za-z0-9_]+)/i);
  return match?.[1] ?? null;
}

export function githubOwner(codePath: string | null | undefined): string | null {
  const match = codePath?.match(/code\/repos\/([^/]+)/);
  if (!match) return null;
  const [owner] = match[1].split("__");
  return owner || null;
}

function hostLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const href = url.startsWith("http") ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function fromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("shadcn")) return "shadcn";
  if (lower.includes("animate ui")) return "animate-ui";
  if (lower.includes("heroui") || lower.includes("hero ui")) return "heroui";
  if (lower.includes("three.js") || lower.startsWith("three.js")) return "three-js";
  return null;
}

function fromDemo(demoUrl: string | null | undefined): string | null {
  const host = hostLabel(demoUrl);
  if (!host) return null;
  if (DEMO_HOST_ALIASES[host]) return DEMO_HOST_ALIASES[host];
  return null;
}

function fromRoundupBrand(record: CreatorInput): CreatorRecord | null {
  const host = hostLabel(record.demo_url);
  const name = (record.component_name ?? "").trim();
  if (!host && !name) return null;
  if (name) {
    return {
      name,
      slug: slugify(name),
      xHandle: null,
      website: record.demo_url
        ? record.demo_url.startsWith("http")
          ? record.demo_url
          : `https://${record.demo_url}`
        : null,
    };
  }
  return canonical(host ?? "unknown");
}

/**
 * Resolve the *item* creator, not the X curator who bookmarked a roundup.
 * Roundups use GitHub owner / known aliases / site brand. Single posts use
 * the author unless the title names someone else (or a known library).
 */
export function inferCreator(record: CreatorInput): InferredCreator {
  const nameKey = fromName(record.component_name ?? "");
  if (nameKey) return canonical(nameKey);

  const demoKey = fromDemo(record.demo_url);
  if (demoKey) return canonical(demoKey);

  const quoted = quotedHandle(record.component_name) ?? quotedHandle(record.post_text);
  if (quoted) return canonical(quoted);

  const owner = githubOwner(record.code_path);
  if (owner) {
    const mapped = canonical(owner);
    if (!mapped.website) {
      return { ...mapped, website: `https://github.com/${owner}` };
    }
    return mapped;
  }

  const kind = (record.source_post_kind ?? "").toLowerCase();
  if (kind.includes("roundup")) {
    const brand = fromRoundupBrand(record);
    if (brand) return brand;
  }

  const handle = record.author_handle?.replace(/^@/, "") ?? null;
  if (handle) return canonical(handle);

  return {
    name: handleToName(record.author_handle) || "Unknown",
    slug: "unknown",
    xHandle: null,
    website: null,
  };
}
