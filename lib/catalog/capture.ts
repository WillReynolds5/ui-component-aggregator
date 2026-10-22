import { createHash } from "node:crypto";

/** Hosts whose pages are login walls or posts, not the component itself. */
const UNCAPTURABLE_HOSTS = ["x.com", "twitter.com", "t.co", "youtube.com", "youtu.be", "linkedin.com"];

/** The URL worth screenshotting for an item, or null when there's nothing to capture. */
export function captureTarget(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.replace(/^www\./, "");
    if (UNCAPTURABLE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Content-addressed file name, so a recapture gets a new URL and CloudFront's
 * year-long cache never serves a stale image.
 */
export function previewFileName(slug: string, image: Uint8Array): string {
  const hash = createHash("sha256").update(image).digest("hex").slice(0, 10);
  return `${slug}-${hash}.jpg`;
}

export const PREVIEW_URL_PREFIX = "/previews/";

/**
 * Hides cookie and consent overlays with CSS instead of clicking "Accept":
 * the capture should never agree to anything on a visitor's behalf.
 */
export const HIDE_OVERLAYS_CSS = `
[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i],
[id*="gdpr" i], [class*="gdpr" i], [aria-label*="cookie" i], #onetrust-banner-sdk,
.cc-window, #CybotCookiebotDialog, [class*="intercom" i], [id*="intercom" i],
[class*="crisp-client" i], iframe[title*="chat" i] { display: none !important; }
html, body { scroll-behavior: auto !important; }
`;
