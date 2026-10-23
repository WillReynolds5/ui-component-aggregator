import { describe, expect, it } from "vitest";
import { findComponentPage } from "@/lib/catalog/component-pages";

describe("findComponentPage", () => {
  it("matches the page named after the component", () => {
    expect(
      findComponentPage(
        ["https://uiarc.dev/components/button", "https://uiarc.dev/components/split-button"],
        "split-button",
      ),
    ).toBe("https://uiarc.dev/components/split-button");
  });

  it("matches a sectioned path for prefixed names", () => {
    expect(
      findComponentPage(["https://animate-ui.com/docs/backgrounds/bubble", "https://animate-ui.com/docs"], "backgrounds-bubble"),
    ).toBe("https://animate-ui.com/docs/backgrounds/bubble");
  });

  it("prefers shadcn's radix page and the default locale", () => {
    expect(
      findComponentPage(
        [
          "https://ui.shadcn.com/docs/components/aria/button",
          "https://ui.shadcn.com/docs/components/radix/button",
          "https://ui.shadcn.com/docs/components/base/button",
        ],
        "button",
      ),
    ).toBe("https://ui.shadcn.com/docs/components/radix/button");
    expect(
      findComponentPage(
        ["https://www.boardui.com/ja/components/auth-card", "https://www.boardui.com/components/auth-card"],
        "auth-card",
      ),
    ).toBe("https://www.boardui.com/components/auth-card");
  });

  it("doesn't confuse a longer name for a shorter one, and returns null when absent", () => {
    expect(findComponentPage(["https://reui.io/components/button-group"], "button")).toBeNull();
    expect(findComponentPage([], "button")).toBeNull();
  });
});
