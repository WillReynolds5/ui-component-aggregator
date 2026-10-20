import { NextRequest, NextResponse } from "next/server";
import { ingestScrapeRecords } from "@/lib/catalog/ingest";
import { mapScrapeRecord } from "@/lib/catalog/mapping";
import { normalizeIngestBody } from "@/lib/catalog/ingest-schema";
import { DatabaseNotConfiguredError } from "@/db";

function authorize(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { records, dryRun } = normalizeIngestBody(body);
    const mapped = records.map(mapScrapeRecord);
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: mapped.length,
        preview: mapped.slice(0, 5),
      });
    }
    const result = await ingestScrapeRecords(records);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
