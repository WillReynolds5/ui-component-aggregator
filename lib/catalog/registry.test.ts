import { describe, expect, it } from "vitest";
import {
  categorizeEntry,
  displayName,
  isExtractable,
  splitDependency,
} from "@/lib/catalog/registry";

describe("categorizeEntry", () => {
  it.each([
    ["split-button", "buttons"],
    ["buttons-ripple", "buttons"],
    ["dropdown-menu", "dropdown-menus"],
    ["event-calendar-3", "calendars"],
    ["data-grid-table-2", "tables"],
    ["backgrounds-bubble", "backgrounds-shaders"],
    ["graph-frame", "charts"],
    ["ai-chat-1", "chat"],
    ["tree-view", "lists"],
    ["navigation-menu", "navbars"],
  ])("%s → %s", (name, slug) => {
    expect(categorizeEntry({ name, type: "registry:ui" })).toBe(slug);
  });

  it("falls back to registry categories, then to the item type", () => {
    expect(categorizeEntry({ name: "liquid-glass", type: "registry:ui", categories: ["inputs"] })).toBe(
      "inputs",
    );
    expect(categorizeEntry({ name: "hero-zeta", type: "registry:block" })).toBe("hero");
    expect(categorizeEntry({ name: "zeta", type: "registry:block" })).toBe("blocks");
    expect(categorizeEntry({ name: "zeta", type: "registry:ui" })).toBe("other");
  });
});

describe("isExtractable", () => {
  it("keeps components and blocks, skips hooks, libs, tokens, and icon sets", () => {
    expect(isExtractable({ name: "button", type: "registry:ui" })).toBe(true);
    expect(isExtractable({ name: "signup-form", type: "registry:block" })).toBe(true);
    expect(isExtractable({ name: "use-level", type: "registry:hook" })).toBe(false);
    expect(isExtractable({ name: "arc-foundation", type: "registry:item" })).toBe(false);
    expect(isExtractable({ name: "icons-lucide-wifi", type: "registry:ui" })).toBe(false);
  });
});

describe("displayName / splitDependency", () => {
  it("humanizes names and splits versions", () => {
    expect(displayName({ name: "split-button" })).toBe("Split button");
    expect(displayName({ name: "x", title: "Liquid Voice" })).toBe("Liquid Voice");
    expect(splitDependency("motion@12")).toEqual(["motion", "12"]);
    expect(splitDependency("@radix-ui/react-slot")).toEqual(["@radix-ui/react-slot", ""]);
    expect(splitDependency("@base-ui/react@1.0.0")).toEqual(["@base-ui/react", "1.0.0"]);
  });
});
