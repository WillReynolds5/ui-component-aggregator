/**
 * Screenshot each item's live site and attach it as the item's preview image.
 *
 *   npm run previews:capture                     # items with no screenshot yet
 *   npm run previews:capture -- --slug arc-ui    # specific items (comma-separated)
 *   npm run previews:capture -- --force --limit 20
 *
 * Production runs the same code automatically (functions/capture-previews.ts). See
 * lib/catalog/capture-run.ts for where files go.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { usesDataApi } from "@/db";
import { captureJobs, findCaptureJobs, previewDestination } from "@/lib/catalog/capture-run";

const { values: args } = parseArgs({
  options: {
    slug: { type: "string" },
    limit: { type: "string" },
    force: { type: "boolean", default: false },
    concurrency: { type: "string", default: "3" },
  },
});

async function main() {
  if (!process.env.DATABASE_URL && !usesDataApi()) {
    throw new Error("DATABASE_URL or AURORA_* Data API env is required");
  }
  const { jobs, skipped } = await findCaptureJobs({
    slugs: args.slug?.split(",").map((value) => value.trim()).filter(Boolean),
    limit: args.limit ? Number(args.limit) : undefined,
    force: args.force,
  });
  console.log(
    "Capturing %d item(s) to %s%s",
    jobs.length,
    previewDestination(),
    skipped.length ? ` (no capturable URL: ${skipped.length})` : "",
  );
  if (!jobs.length) return;

  // Uses the Chromium that `npx playwright install chromium` downloaded.
  const browser = await chromium.launch();
  try {
    const results = await captureJobs(browser, jobs, {
      concurrency: Number(args.concurrency),
      onResult: (result) =>
        console.log(
          result.ok ? "  ✓ %s  %s" : "  ✗ %s  %s",
          result.slug,
          result.ok ? result.url : result.reason,
        ),
    });
    const failed = results.filter((result) => !result.ok).length;
    console.log("Captured %d, failed %d.", results.length - failed, failed);
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
