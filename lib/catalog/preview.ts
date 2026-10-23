export type PreviewMedia = {
  kind: "image" | "video" | "demo_url" | "render";
  source?: "scrape" | "capture";
  url: string;
};

/** Absolute http(s) URLs, or root-relative paths we serve ourselves (`/previews/...`). */
export function isDisplayableUrl(url: string): boolean {
  return /^https?:\/\//.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

/** The image a card should show: our own screenshot first, then a scraped image. */
export function pickPreview<T extends PreviewMedia>(media: T[]): T | null {
  const images = media.filter((entry) => entry.kind === "image" && isDisplayableUrl(entry.url));
  return images.find((entry) => entry.source === "capture") ?? images[0] ?? null;
}

/** The live site to open or screenshot. */
export function demoUrl<T extends PreviewMedia>(media: T[], fallback?: string | null): string | null {
  return media.find((entry) => entry.kind === "demo_url")?.url ?? fallback ?? null;
}

/** The built, interactive page for an extracted component, if it has one. */
export function pickRender<T extends PreviewMedia>(media: T[]): T | null {
  return media.find((entry) => entry.kind === "render" && isDisplayableUrl(entry.url)) ?? null;
}
