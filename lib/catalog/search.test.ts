import { describe, expect, it } from "vitest";
import { hybridScore, keywordPattern, parseSearchParams } from "@/lib/catalog/search";
import { filtersToParams } from "@/lib/catalog/url";
import { mapScrapeCategory, validCategorySlugs } from "@/lib/catalog/taxonomy";
import { slugifyUnique } from "@/lib/catalog/slug";

describe("parseSearchParams", () => {
  it("reads filters from query params", () => {
    expect(
      parseSearchParams({
        q: "button",
        kind: "component",
        pricing: "free",
        tag: "glassmorphism,animated",
        creator: "shadcn,animate-ui",
        category: "buttons",
        mode: "hybrid",
      }),
    ).toMatchObject({
      q: "button",
      kind: "component",
      pricing: "free",
      tags: ["glassmorphism", "animated"],
      creators: ["shadcn", "animate-ui"],
      categorySlug: "buttons",
      mode: "hybrid",
    });
  });

  it("escapes LIKE wildcards", () => {
    expect(keywordPattern("100%_off")).toBe("%100\\%\\_off%");
  });

  it("round-trips creator into the URL", () => {
    const params = filtersToParams({
      creators: ["shadcn", "animate-ui"],
      tags: ["glassmorphism"],
    });
    expect(params.get("creator")).toBe("shadcn,animate-ui");
    expect(parseSearchParams(Object.fromEntries(params.entries())).creators).toEqual([
      "shadcn",
      "animate-ui",
    ]);
  });
});

describe("taxonomy", () => {
  it("includes the seeded tree", () => {
    const slugs = validCategorySlugs();
    expect(slugs.has("libraries")).toBe(true);
    expect(slugs.has("dropdown-menus")).toBe(true);
    expect(slugs.has("buttons")).toBe(true);
    expect(slugs.has("traces")).toBe(true);
    expect(slugs.has("3d")).toBe(true);
  });

  it("maps scrape categories onto the tree", () => {
    expect(mapScrapeCategory("ai/agent activity")).toBe("traces");
    expect(mapScrapeCategory("3D/webgl")).toBe("3d");
    expect(mapScrapeCategory("mystery")).toBe("other");
    expect(mapScrapeCategory("Dropdown Menu")).toBe("dropdown-menus");
    expect(mapScrapeCategory("modal")).toBe("dialogs");
    expect(mapScrapeCategory("animated dropdown/menu")).toBe("dropdown-menus");
  });

  it("lets the scrape type win over a thematic category", () => {
    expect(mapScrapeCategory("animation", "component library")).toBe("libraries");
    expect(mapScrapeCategory("layout/spacing", "technique")).toBe("guides");
    expect(mapScrapeCategory("inspiration", "talk")).toBe("inspiration");
    expect(mapScrapeCategory("design tooling", "tool")).toBe("design-tools");
    expect(mapScrapeCategory("hero", "block")).toBe("hero");
  });
});

describe("hybridScore", () => {
  it("falls back to keyword when no vector score exists", () => {
    expect(hybridScore(0.8, null)).toBe(0.8);
    expect(hybridScore(1, 1)).toBe(1);
  });
});

describe("slugifyUnique", () => {
  it("suffixes collisions", () => {
    const used = new Set<string>(["arc-ui"]);
    expect(slugifyUnique("Arc UI", used)).toBe("arc-ui-2");
  });
});
