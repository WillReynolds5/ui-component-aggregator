import { describe, expect, it } from "vitest";
import { demoUrl, pickPreview } from "@/lib/catalog/preview";

describe("pickPreview", () => {
  it("prefers our captured screenshot over a scraped image", () => {
    const picked = pickPreview([
      { kind: "image", source: "scrape", url: "https://pbs.twimg.com/a.jpg" },
      { kind: "image", source: "capture", url: "/previews/a.jpg" },
    ]);
    expect(picked?.url).toBe("/previews/a.jpg");
  });

  it("ignores scraper-local paths that the browser cannot load", () => {
    expect(pickPreview([{ kind: "image", url: "seed-media://images/a.jpg" }])).toBeNull();
    expect(pickPreview([{ kind: "image", url: "//evil.example/a.jpg" }])).toBeNull();
  });

  it("falls back to the source URL when there is no demo media", () => {
    expect(demoUrl([], "https://example.com")).toBe("https://example.com");
    expect(demoUrl([{ kind: "demo_url", url: "https://demo.dev" }], "https://x.com")).toBe(
      "https://demo.dev",
    );
  });
});
