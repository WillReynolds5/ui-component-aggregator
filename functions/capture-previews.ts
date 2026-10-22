/**
 * AWS Lambda: capture preview screenshots.
 *
 * Invoked two ways (see infra/lib/stack.ts):
 *   - by POST /api/ingest, asynchronously, with the ids of the items it just wrote, while the
 *     database is already awake;
 *   - once a day by EventBridge with `{ limit }`, to retry failures and anything missed.
 * It checks for work before starting Chromium, so a run with nothing to do takes a second.
 */
import chromium from "@sparticuz/chromium";
import { chromium as playwright, type Browser } from "playwright-core";
import {
  captureJobs,
  findCaptureJobs,
  previewDestination,
  type CaptureResult,
} from "@/lib/catalog/capture-run";

export type CaptureEvent = {
  itemIds?: string[];
  slugs?: string[];
  limit?: number;
  force?: boolean;
};

type LambdaContext = { getRemainingTimeInMillis(): number };

/** Stop starting new screenshots when less than this is left; one capture can take ~45s. */
const SAFETY_MS = 60_000;
const DEFAULT_LIMIT = 12;

async function launch(): Promise<Browser> {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
    });
  }
  // Local run (tests, `tsx`): the Chromium from `npx playwright install chromium`.
  return playwright.launch();
}

export async function handler(event: CaptureEvent = {}, context?: LambdaContext) {
  const { jobs, skipped } = await findCaptureJobs({
    itemIds: event.itemIds,
    slugs: event.slugs,
    force: event.force,
    limit: event.limit ?? DEFAULT_LIMIT,
  });
  if (!jobs.length) {
    const summary = { captured: 0, failed: 0, skipped: skipped.length, pending: 0 };
    console.log(JSON.stringify({ msg: "nothing to capture", ...summary }));
    return summary;
  }

  console.log(JSON.stringify({ msg: "capturing", count: jobs.length, to: previewDestination() }));
  const results: CaptureResult[] = [];
  // A fresh browser per item: @sparticuz/chromium runs with --single-process, where closing
  // a context shuts the whole browser down, so one browser can't serve a second page.
  for (const job of jobs) {
    if (context && context.getRemainingTimeInMillis() < SAFETY_MS) break;
    const browser = await launch();
    try {
      const [result] = await captureJobs(browser, [job], {
        onResult: (entry) => console.log(JSON.stringify({ msg: "capture", ...entry })),
      });
      results.push(result);
    } finally {
      await browser.close().catch(() => {});
    }
  }
  const failed = results.filter((result) => !result.ok).length;
  const summary = {
    captured: results.length - failed,
    failed,
    skipped: skipped.length,
    pending: jobs.length - results.length,
  };
  console.log(JSON.stringify({ msg: "done", ...summary }));
  return summary;
}
