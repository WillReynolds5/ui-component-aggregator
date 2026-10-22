/**
 * Screenshot items' live sites and attach them as previews. Shared by the CLI
 * (`scripts/capture-previews.ts`) and the AWS job (`functions/capture-previews.ts`); each
 * brings its own browser, since Lambda needs the @sparticuz/chromium build.
 *
 * Storage: PREVIEWS_BUCKET set → s3://$PREVIEWS_BUCKET/previews/ (CloudFront serves /previews/*).
 * Otherwise PREVIEWS_DIR (default public/previews) for local dev. Either way the stored URL is
 * /previews/<file>.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { Browser } from "playwright-core";
import { getDb } from "@/db";
import { enumEq } from "@/db/enum";
import { items, media, mediaSourceEnum } from "@/drizzle/schema";
import {
  captureTarget,
  HIDE_OVERLAYS_CSS,
  PREVIEW_URL_PREFIX,
  previewFileName,
} from "@/lib/catalog/capture";

const VIEWPORT = { width: 1440, height: 900 };
/** Below this a JPEG of a 1440×900 page is almost certainly blank or an error screen. */
const MIN_BYTES = 12_000;

export type CaptureJob = { id: string; slug: string; name: string; url: string };

export type CaptureResult =
  | { slug: string; ok: true; url: string; file: string }
  | { slug: string; ok: false; url: string; reason: string };

export async function findCaptureJobs(options: {
  itemIds?: string[];
  slugs?: string[];
  limit?: number;
  force?: boolean;
}): Promise<{ jobs: CaptureJob[]; skipped: string[] }> {
  const db = getDb();
  let where: SQL | undefined;
  if (options.itemIds?.length) where = inArray(items.id, options.itemIds);
  else if (options.slugs?.length) where = inArray(items.slug, options.slugs);

  const rows = await db.query.items.findMany({
    where,
    columns: { id: true, slug: true, name: true, sourceUrl: true },
    with: { media: { columns: { kind: true, source: true, url: true } } },
    // Newest first, so a limited sweep favors what people are most likely looking at.
    orderBy: (table, { desc }) => [desc(table.discoveredAt)],
  });

  const jobs: CaptureJob[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const captured = row.media.some((entry) => entry.source === "capture");
    if (captured && !options.force) continue;
    const demo = row.media.find((entry) => entry.kind === "demo_url")?.url;
    const url = captureTarget(demo) ?? captureTarget(row.sourceUrl);
    if (!url) {
      skipped.push(row.slug);
      continue;
    }
    jobs.push({ id: row.id, slug: row.slug, name: row.name, url });
  }
  return { jobs: options.limit ? jobs.slice(0, options.limit) : jobs, skipped };
}

async function screenshot(browser: Browser, url: string): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.addStyleTag({ content: HIDE_OVERLAYS_CSS }).catch(() => {});
    // Let entrance animations and lazy hero media settle.
    await page.waitForTimeout(2_500);
    // Freezing animations lets heavy animated pages settle; in Lambda's software-only
    // rendering they otherwise blew the default 30s screenshot timeout.
    return await page.screenshot({
      type: "jpeg",
      quality: 82,
      animations: "disabled",
      timeout: 45_000,
    });
  } finally {
    await context.close();
  }
}

let s3: S3Client | undefined;

/**
 * Store a public asset at `/<key>`: in PREVIEWS_BUCKET when set (CloudFront serves
 * /previews/* and /renders/* from it), otherwise under public/ for local dev.
 */
export async function storeAsset(key: string, body: Buffer | string, contentType: string) {
  const bucket = process.env.PREVIEWS_BUCKET;
  if (bucket) {
    s3 ??= new S3Client({ region: process.env.AWS_REGION || "us-east-2" });
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Every stored file name is content-hashed, so it can be cached forever.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return;
  }
  const file = resolve(process.cwd(), "public", key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}

async function store(fileName: string, image: Buffer) {
  if (!process.env.PREVIEWS_BUCKET && process.env.PREVIEWS_DIR) {
    // Lambda container tests write somewhere writable instead of public/.
    const dir = resolve(process.cwd(), process.env.PREVIEWS_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, fileName), image);
    return;
  }
  await storeAsset(`previews/${fileName}`, image, "image/jpeg");
}

async function attach(job: CaptureJob, fileName: string) {
  const db = getDb();
  await db
    .delete(media)
    .where(and(eq(media.itemId, job.id), enumEq(media.source, "capture", mediaSourceEnum)));
  await db.insert(media).values({
    itemId: job.id,
    kind: "image",
    source: "capture",
    url: `${PREVIEW_URL_PREFIX}${fileName}`,
    alt: `${job.name} homepage`,
    sortOrder: -1,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
  });
}

export function previewDestination(): string {
  return process.env.PREVIEWS_BUCKET
    ? `s3://${process.env.PREVIEWS_BUCKET}/previews`
    : process.env.PREVIEWS_DIR || "public/previews";
}

/**
 * Runs jobs with a small worker pool. `shouldStop` is checked before each new job so a
 * time-boxed caller (Lambda) can leave the rest for the next run instead of timing out.
 */
export async function captureJobs(
  browser: Browser,
  jobs: CaptureJob[],
  options: {
    concurrency?: number;
    shouldStop?: () => boolean;
    onResult?: (result: CaptureResult) => void;
  } = {},
): Promise<CaptureResult[]> {
  const queue = [...jobs];
  const results: CaptureResult[] = [];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (options.shouldStop?.()) {
        queue.length = 0;
        return;
      }
      let result: CaptureResult;
      try {
        const image = await screenshot(browser, job.url);
        if (image.byteLength < MIN_BYTES) throw new Error("page looks blank");
        const file = previewFileName(job.slug, image);
        await store(file, image);
        await attach(job, file);
        result = { slug: job.slug, ok: true, url: job.url, file };
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        result = { slug: job.slug, ok: false, url: job.url, reason };
      }
      results.push(result);
      options.onResult?.(result);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 3) }, worker));
  return results;
}
