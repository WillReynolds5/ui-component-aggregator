import { inferCreator } from "@/lib/catalog/creators";
import { mapScrapeCategory, TAXONOMY } from "@/lib/catalog/taxonomy";
import { slugify } from "@/lib/catalog/slug";

export type ScrapeRecord = {
  post_url?: string | null;
  author_handle?: string | null;
  post_text?: string | null;
  date?: string | null;
  links?: string[] | null;
  image_paths?: string[] | null;
  component_name?: string | null;
  type?: string | null;
  category?: string | null;
  style_tags?: string[] | null;
  framework?: string | null;
  code_path?: string | null;
  figma_url?: string | null;
  demo_url?: string | null;
  extraction_status?: string | null;
  source_post_kind?: string | null;
};

export type MappedItem = {
  name: string;
  slugHint: string;
  kind: "component" | "block";
  description: string;
  framework: string;
  styling: string | null;
  dependencies: string[];
  pricing: "free" | "paid" | "freemium";
  license: string | null;
  access: "full_code" | "install_only" | "link_only";
  code: string | null;
  installCommand: string | null;
  sourceUrl: string;
  sourceName: string;
  sourceHomepage: string | null;
  sourceRepoUrl: string | null;
  sourceRegistryUrl: string | null;
  creatorName: string;
  creatorSlug: string;
  creatorHandle: string | null;
  creatorWebsite: string | null;
  discoveredViaPostUrl: string | null;
  discoveredAt: Date;
  categorySlug: string;
  tags: string[];
  media: Array<{ kind: "image" | "video" | "demo_url"; url: string; alt: string }>;
};

const BLOCK_TYPES = new Set(["block"]);
const BLOCK_CATEGORIES = new Set(
  TAXONOMY.find((node) => node.slug === "blocks")?.children?.map((node) => node.slug) ?? [],
);

export function normalizeFramework(raw: string | null | undefined): {
  framework: string;
  styling: string | null;
  dependencies: string[];
} {
  const value = (raw ?? "unknown").trim();
  if (!value || value === "n/a" || value.toLowerCase() === "unknown") {
    return { framework: "unknown", styling: null, dependencies: [] };
  }

  const lower = value.toLowerCase();
  const dependencies = value
    .split(/[/,+]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  let framework = "unknown";
  if (/\breact\b/.test(lower) || /\bnext\.?js\b/.test(lower)) framework = "react";
  else if (/\bvue\b/.test(lower)) framework = "vue";
  else if (/\bsvelte\b/.test(lower)) framework = "svelte";
  else if (/\bhtml\b/.test(lower) || /\bcss\b/.test(lower)) framework = "html";
  else if (/\bthree\.?js\b/.test(lower) || /\bwebgl\b/.test(lower)) framework = "html";
  else if (lower === "js" || lower === "ts" || lower === "js/ts" || lower.startsWith("ts/")) {
    framework = "html";
  } else if (lower.includes("web tool")) {
    framework = "html";
  }

  const styling = /\btailwind\b/.test(lower)
    ? "tailwind"
    : /\bcss\b/.test(lower)
      ? "css"
      : null;

  return { framework, styling, dependencies };
}

export function inferAccess(status: string | null | undefined): {
  access: MappedItem["access"];
  pricing: MappedItem["pricing"];
  installCommand: string | null;
} {
  const text = status ?? "";
  const lower = text.toLowerCase();
  const paid = /\bpaid\b|\bpremium\b|\$\d+/.test(lower);
  const freemium = /\bfreemium\b/.test(lower);
  const pricing: MappedItem["pricing"] = paid ? "paid" : freemium ? "freemium" : "free";

  const skillsMatch = text.match(/npx skills add [^\s)]+/i);
  if (skillsMatch) {
    return { access: "install_only", pricing, installCommand: skillsMatch[0] };
  }

  if (lower.includes("shadcn registry") || lower.includes("npx shadcn")) {
    return {
      access: "install_only",
      pricing,
      installCommand: "npx shadcn@latest add",
    };
  }

  if (lower.startsWith("full code")) {
    return { access: "full_code", pricing, installCommand: null };
  }

  return { access: "link_only", pricing, installCommand: null };
}

export function repoUrlFromCodePath(codePath: string | null | undefined): string | null {
  if (!codePath) return null;
  const match = codePath.match(/code\/repos\/([^/]+)/);
  if (!match) return null;
  const [owner, repo] = match[1].split("__");
  if (!owner || !repo) return null;
  return `https://github.com/${owner}/${repo}`;
}

function firstHttpUrl(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.hash = "";
        return url.toString().replace(/\/$/, "") === `${url.origin}${url.pathname}`.replace(/\/$/, "")
          ? url.toString()
          : url.toString();
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** The first URL that is a shadcn registry item ("https://site/r/button.json"), if any. */
export function registryItem(urls: Array<string | null | undefined>): string | null {
  return (
    urls.find((url): url is string => Boolean(url && /^https:\/\/[^\s]+\/r\/[a-z0-9._/-]+\.json$/i.test(url))) ?? null
  );
}

export function hostLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function mapScrapeRecord(record: ScrapeRecord): MappedItem {
  const name = (record.component_name ?? "Untitled").trim() || "Untitled";
  const demo = record.demo_url
    ? record.demo_url.startsWith("http")
      ? record.demo_url
      : `https://${record.demo_url}`
    : null;
  const links = record.links ?? [];
  const sourceUrl =
    firstHttpUrl([demo, ...links, record.post_url]) ??
    `https://x.com/i/status/unknown-${slugify(name)}`;
  const repoUrl = repoUrlFromCodePath(record.code_path);
  const { framework, styling, dependencies } = normalizeFramework(record.framework);
  const inferred = inferAccess(record.extraction_status);
  const type = (record.type ?? "").toLowerCase();
  const categorySlug = mapScrapeCategory(record.category, record.type);
  const kind: MappedItem["kind"] =
    BLOCK_TYPES.has(type) || BLOCK_CATEGORIES.has(categorySlug) ? "block" : "component";

  const sourceHomepage = firstHttpUrl([demo, links[0], repoUrl]);
  const sourceName = hostLabel(sourceHomepage) ?? name;
  const creator = inferCreator(record);

  const tags = [...new Set((record.style_tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  if (styling) tags.push(styling);
  if (framework !== "unknown") tags.push(framework);

  const media: MappedItem["media"] = [];
  if (demo) {
    media.push({ kind: "demo_url", url: demo, alt: `${name} demo` });
  }
  for (const path of record.image_paths ?? []) {
    if (!path) continue;
    media.push({
      kind: "image",
      url: path.startsWith("http") ? path : `seed-media://${path}`,
      alt: `${name} preview from X`,
    });
  }

  const description = [
    record.post_text?.trim(),
    record.extraction_status ? `Extraction: ${record.extraction_status}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // `shadcn add` needs a registry item (".../r/<name>.json"), not a docs or demo page.
  const registryItemUrl = registryItem([demo, ...links]);
  const installCommand =
    inferred.installCommand === "npx shadcn@latest add"
      ? registryItemUrl
        ? `npx shadcn@latest add ${registryItemUrl}`
        : null
      : inferred.installCommand;

  return {
    name,
    slugHint: slugify(name),
    kind,
    description,
    framework,
    styling,
    dependencies,
    pricing: inferred.pricing,
    license: inferred.access === "full_code" ? "see-source" : null,
    access: inferred.access,
    // The scrape has no inline source yet; never invent placeholder code.
    code: null,
    installCommand,
    sourceUrl,
    sourceName,
    sourceHomepage,
    sourceRepoUrl: repoUrl,
    sourceRegistryUrl: registryItemUrl,
    creatorName: creator.name,
    creatorSlug: creator.slug,
    creatorHandle: creator.xHandle,
    creatorWebsite: creator.website,
    discoveredViaPostUrl: record.post_url ?? null,
    discoveredAt: record.date ? new Date(record.date) : new Date(),
    categorySlug,
    tags,
    media,
  };
}
