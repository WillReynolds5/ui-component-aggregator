/**
 * Extract every component from the catalog's libraries that publish a shadcn registry,
 * build each into a live render, verify it in Chromium, and add it as its own item.
 *
 *   npm run components:extract                          # all libraries, new components only
 *   npm run components:extract -- --library pin-ui      # one library (item slug)
 *   npm run components:extract -- --library arc-ui --name signup-form --force
 *
 * Storage follows lib/catalog/capture-run.ts: PREVIEWS_BUCKET → S3, otherwise public/.
 * Anything that fails to build, throws, or renders blank is skipped (and removed if it was
 * extracted before), so the grid never shows a dead card.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "playwright-core";
import { usesDataApi } from "@/db";
import { storeAsset } from "@/lib/catalog/capture-run";
import {
  extractedUrls,
  findLibraries,
  loadLibraryRegistry,
  removeComponent,
  upsertComponent,
  type LibraryRecord,
  type LibraryRegistry,
} from "@/lib/catalog/extract";
import {
  categorizeEntry,
  fetchJson,
  isExtractable,
  RateLimitedError,
  type Registry,
  type RegistryEntry,
} from "@/lib/catalog/registry";
import { buildRender, mainFile, resolveComponent, type RenderLayout } from "@/lib/catalog/render-build";
import { looksEmpty, looksUnfed } from "@/lib/catalog/render-visual";

const { values: args } = parseArgs({
  options: {
    library: { type: "string" },
    name: { type: "string" },
    limit: { type: "string" },
    force: { type: "boolean", default: false },
    concurrency: { type: "string", default: "2" },
  },
});

/**
 * Verify (and take the poster) at the size the card actually shows: components at about card
 * width (2× for a crisp poster), blocks on the same 1280px canvas the card scales down.
 */
const VIEWPORTS: Record<RenderLayout, { width: number; height: number; scale: number }> = {
  component: { width: 480, height: 360, scale: 2 },
  block: { width: 1280, height: 960, scale: 1 },
};
/** The origin renders are verified under; routed in-process, never fetched. */
const VERIFY_URL = "https://render.verify/component.html";

type Outcome = "added" | "updated" | "blank" | "error" | "build-failed" | "paid" | "transient";
/**
 * `deterministic`: the component itself rendered nothing or threw; rebuilding won't change it,
 * so an existing item is removed. Otherwise (timeouts, CDN or browser trouble) existing items
 * are kept and the run reports it.
 */
type Verified = { ok: boolean; reason?: string; poster?: Buffer; deterministic?: boolean };

async function verify(browser: Browser, html: string, layout: RenderLayout): Promise<Verified> {
  const { width, height, scale } = VIEWPORTS[layout];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(VERIFY_URL, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }),
  );
  try {
    await page.goto(VERIFY_URL, { waitUntil: "load", timeout: 30_000 });
    await page
      .waitForFunction(() => (window as { __renderStatus?: unknown }).__renderStatus, null, { timeout: 15_000 })
      .catch(() => {});
    const status = await page.evaluate(
      () => (window as { __renderStatus?: { ok: boolean; blank?: boolean; error?: string } }).__renderStatus,
    );
    if (!status) return { ok: false, reason: errors[0] ?? "never reported a render" };
    if (!status.ok) {
      return { ok: false, reason: status.blank ? "blank" : (status.error ?? errors[0] ?? "error"), deterministic: true };
    }
    // Let entrance animations land before judging and taking the poster.
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body.innerText);
    if (looksUnfed(text)) return { ok: false, reason: "unfed (shows NaN/undefined)", deterministic: true };
    // The page's real background, resolved by the browser (themes use oklch, var(), etc.).
    const background = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b] as [number, number, number];
    });
    if (await looksEmpty(await page.screenshot({ type: "png" }), background)) {
      return { ok: false, reason: "blank", deterministic: true };
    }
    return { ok: true, poster: await page.screenshot({ type: "jpeg", quality: 80 }) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.split("\n")[0] : String(error) };
  } finally {
    await context.close();
  }
}

/**
 * A published usage example for the component, if any. shadcn/ui ships one per primitive
 * ("dropdown-menu-demo"); a bare Dialog or Tooltip renders nothing without it.
 */
async function findDemo(registry: Registry, name: string): Promise<string | null> {
  for (const candidate of [`${name}-demo`, `demo-${name}`]) {
    try {
      const demo = await fetchJson<RegistryEntry>(registry.itemUrl(candidate));
      if (demo.files?.some((file) => file.content)) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function message(error: unknown) {
  const esbuildErrors = (error as { errors?: Array<{ text: string }> }).errors;
  if (esbuildErrors?.length) return esbuildErrors.map((entry) => entry.text).join("; ").slice(0, 240);
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

async function extractOne(
  browser: Browser,
  library: LibraryRecord,
  source: LibraryRegistry,
  indexEntry: RegistryEntry,
): Promise<{ outcome: Outcome; detail?: string }> {
  const itemUrl = source.registry.itemUrl(indexEntry.name);
  let entry: RegistryEntry;
  try {
    entry = await fetchJson<RegistryEntry>(itemUrl);
  } catch (error) {
    if (error instanceof RateLimitedError) throw error;
    // Licensed registries (most of reui) answer 401 for paid items. Those stay out.
    if (/HTTP (401|403)/.test(message(error))) return { outcome: "paid" };
    return { outcome: "build-failed", detail: message(error) };
  }

  let built;
  let resolved;
  let demo: string | null;
  const categorySlug = categorizeEntry({ ...indexEntry, ...entry });
  const layout: RenderLayout = entry.type === "registry:block" ? "block" : "component";
  try {
    demo = await findDemo(source.registry, indexEntry.name);
    resolved = await resolveComponent(source.registry, demo ?? indexEntry.name, []);
    built = await buildRender(resolved, { categorySlug, globalStyles: source.globalStyles, layout });
  } catch (error) {
    if (error instanceof RateLimitedError) throw error;
    return { outcome: "build-failed", detail: message(error) };
  }
  const verified = await verify(browser, built.html, layout);
  if (!verified.ok || !verified.poster) {
    if (!verified.deterministic) return { outcome: "transient", detail: `kept existing: ${verified.reason}` };
    await removeComponent(itemUrl);
    return { outcome: verified.reason === "blank" ? "blank" : "error", detail: verified.reason };
  }

  const posterHash = createHash("sha256").update(verified.poster).digest("hex").slice(0, 10);
  const renderKey = `renders/${library.slug}/${built.fileName}`;
  const posterKey = `previews/components/${library.slug}/${indexEntry.name}-${posterHash}.jpg`;
  await storeAsset(renderKey, built.html, "text/html; charset=utf-8");
  await storeAsset(posterKey, verified.poster, "image/jpeg");
  const { created, slug } = await upsertComponent({
    library,
    entry,
    itemUrl,
    categorySlug,
    // The component's own source, even when the card renders its demo.
    code: mainFile(entry)?.content ?? built.code,
    dependencies: [...resolved.npmDeps.keys()],
    renderUrl: `/${renderKey}`,
    posterUrl: `/${posterKey}`,
  });
  return {
    outcome: created ? "added" : "updated",
    detail: `${slug} → ${categorySlug}${demo ? ` (demo: ${demo})` : ""}`,
  };
}

async function main() {
  if (!process.env.DATABASE_URL && !usesDataApi()) {
    throw new Error("DATABASE_URL or AURORA_* Data API env is required");
  }
  const split = (value?: string) => value?.split(",").map((part) => part.trim()).filter(Boolean);
  const libraries = await findLibraries(split(args.library));
  const names = split(args.name);
  const limit = args.limit ? Number(args.limit) : undefined;
  const browser = await chromium.launch();
  const totals: Record<Outcome, number> = {
  added: 0,
  updated: 0,
  blank: 0,
  error: 0,
  "build-failed": 0,
  paid: 0,
  transient: 0,
};

  try {
    for (const library of libraries) {
      const source = await loadLibraryRegistry(library);
      if (!source) {
        console.log(`· ${library.name}: no registry`);
        continue;
      }
      const done = args.force ? new Set<string>() : await extractedUrls([library.id]);
      const todo = source.registry.entries
        .filter(isExtractable)
        .filter((entry) => !names?.length || names.includes(entry.name))
        .filter((entry) => !done.has(source.registry.itemUrl(entry.name)))
        .slice(0, limit);
      console.log(
        `▸ ${library.name}: ${todo.length} to extract (${done.size} already done, ${source.globalStyles.length} global style file(s))`,
      );

      const queue = [...todo];
      const counts: Partial<Record<Outcome, number>> = {};
      // After this many paid answers in a row for one item type, assume the rest of that type
      // is paid too and stop requesting it (reui has ~1,900 licensed blocks).
      const PAID_STREAK = 5;
      const paidStreak = new Map<string, number>();
      let rateLimited = false;
      const worker = async () => {
        for (let entry = queue.shift(); entry && !rateLimited; entry = queue.shift()) {
          const type = entry.type ?? "";
          let result: { outcome: Outcome; detail?: string };
          if ((paidStreak.get(type) ?? 0) >= PAID_STREAK) {
            result = { outcome: "paid", detail: "skipped: rest of this type is licensed" };
          } else {
            try {
              result = await extractOne(browser, library, source, entry);
            } catch (error) {
              if (!(error instanceof RateLimitedError)) throw error;
              rateLimited = true;
              console.log(`  ! ${library.name} is rate-limiting us; stopping this library. Rerun later.`);
              break;
            }
            paidStreak.set(type, result.outcome === "paid" ? (paidStreak.get(type) ?? 0) + 1 : 0);
          }
          const { outcome, detail } = result;
          counts[outcome] = (counts[outcome] ?? 0) + 1;
          totals[outcome] += 1;
          if (outcome === "paid" && detail) continue;
          const mark = outcome === "added" || outcome === "updated" ? "✓" : "✗";
          console.log(`  ${mark} ${entry.name}  ${outcome}${detail ? `  ${detail}` : ""}`);
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, Number(args.concurrency)) }, worker));
      console.log(`  = ${JSON.stringify(counts)}`);
    }
  } finally {
    await browser.close();
  }
  console.log("Totals:", JSON.stringify(totals));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
