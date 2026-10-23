import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { inkCoverage, looksEmpty, looksUnfed, MIN_INK } from "@/lib/catalog/render-visual";

const canvas = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#ffffff" } });

describe("inkCoverage", () => {
  it("is ~0 for a blank page and high for a filled one", async () => {
    expect(await inkCoverage(await canvas(100, 100).png().toBuffer())).toBe(0);
    const filled = await canvas(100, 100)
      .composite([{ input: { create: { width: 50, height: 50, channels: 3, background: "#000" } }, left: 25, top: 25 }])
      .png()
      .toBuffer();
    expect(await inkCoverage(filled)).toBeCloseTo(0.25, 2);
  });

  it("treats a hairline as empty", async () => {
    const hairline = await canvas(400, 300)
      .composite([{ input: { create: { width: 1, height: 24, channels: 3, background: "#999" } }, left: 200, top: 140 }])
      .png()
      .toBuffer();
    expect(await inkCoverage(hairline)).toBeLessThan(MIN_INK);
  });
});

describe("looksUnfed", () => {
  it("flags placeholder values leaking into the UI", () => {
    expect(looksUnfed("NaN")).toBe(true);
    expect(looksUnfed("Total: undefined items")).toBe(true);
    expect(looksUnfed("Nancy's dashboard")).toBe(false);
  });
});

describe("inkCoverage against the page background", () => {
  it("counts a full-bleed background as content", async () => {
    const fullBleed = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#1e3a8a" } })
      .png()
      .toBuffer();
    // Against its own corner it would look empty; against the white page it's all content.
    expect(await inkCoverage(fullBleed)).toBe(0);
    expect(await inkCoverage(fullBleed, [255, 255, 255])).toBe(1);
  });
});

describe("looksEmpty", () => {
  const white: [number, number, number] = [255, 255, 255];
  it("keeps faint but widespread patterns and drops a hairline", async () => {
    const stripes = Array.from({ length: 20 }, (_, index) => ({
      input: { create: { width: 2, height: 300, channels: 3 as const, background: "#f2f2f2" } },
      left: index * 20,
      top: 0,
    }));
    const faint = await canvas(400, 300).composite(stripes).png().toBuffer();
    expect(await looksEmpty(faint, white)).toBe(false);
    const hairline = await canvas(400, 300)
      .composite([{ input: { create: { width: 1, height: 24, channels: 3, background: "#999" } }, left: 200, top: 140 }])
      .png()
      .toBuffer();
    expect(await looksEmpty(hairline, white)).toBe(true);
  });
});
