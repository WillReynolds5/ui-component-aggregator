import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

/** Items per capture run. Ten screenshots fit well inside the function's timeout. */
export const CAPTURE_BATCH = 10;

export function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

let client: LambdaClient | undefined;

/**
 * Ask the capture function (CAPTURE_FUNCTION_NAME) to screenshot these items. Fire-and-forget:
 * an async `Event` invoke returns as soon as Lambda queues it. Items that already have a
 * screenshot are skipped by the function, so passing every ingested id is safe.
 */
export async function requestPreviewCapture(
  itemIds: string[],
): Promise<"queued" | "disabled" | "failed"> {
  const functionName = process.env.CAPTURE_FUNCTION_NAME;
  if (!functionName || !itemIds.length) return "disabled";
  client ??= new LambdaClient({ region: process.env.AWS_REGION || "us-east-2" });
  try {
    await Promise.all(
      chunk(itemIds, CAPTURE_BATCH).map((batch) =>
        client!.send(
          new InvokeCommand({
            FunctionName: functionName,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({ itemIds: batch, limit: batch.length })),
          }),
        ),
      ),
    );
    return "queued";
  } catch (error) {
    // The daily sweep will pick these items up; never fail an ingest over a screenshot.
    console.error("preview capture invoke failed", error);
    return "failed";
  }
}
