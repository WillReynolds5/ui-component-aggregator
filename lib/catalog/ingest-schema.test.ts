import { describe, expect, it } from "vitest";
import { normalizeIngestBody } from "@/lib/catalog/ingest-schema";

describe("normalizeIngestBody", () => {
  it("accepts a single scrape record, an array, or { items }", () => {
    const record = { component_name: "Cue", demo_url: "https://cuedesign.space" };
    expect(normalizeIngestBody(record).records).toHaveLength(1);
    expect(normalizeIngestBody([record]).records).toHaveLength(1);
    expect(normalizeIngestBody({ items: [record], dryRun: true })).toEqual({
      records: [record],
      dryRun: true,
    });
  });
});
