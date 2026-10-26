import { describe, expect, it } from "vitest";
import { captureTarget, previewFileName } from "@/lib/catalog/capture";

describe("captureTarget", () => {
  it("keeps real sites", () => {
    expect(captureTarget("https://ui.shadcn.com")).toBe("https://ui.shadcn.com/");
  });

  it("skips X posts and other login walls", () => {
    expect(captureTarget("https://x.com/shadcn/status/1")).toBeNull();
    expect(captureTarget("https://mobile.twitter.com/a")).toBeNull();
    expect(captureTarget("https://www.youtube.com/watch?v=1")).toBeNull();
  });

  it("rejects junk", () => {
    expect(captureTarget(null)).toBeNull();
    expect(captureTarget("seed-media://a.jpg")).toBeNull();
    expect(captureTarget("not a url")).toBeNull();
  });
});

describe("previewFileName", () => {
  it("changes when the image changes", () => {
    const a = previewFileName("arc-ui", new Uint8Array([1, 2, 3]));
    const b = previewFileName("arc-ui", new Uint8Array([1, 2, 4]));
    expect(a).toMatch(/^arc-ui-[0-9a-f]{10}\.jpg$/);
    expect(a).not.toBe(b);
  });
});
