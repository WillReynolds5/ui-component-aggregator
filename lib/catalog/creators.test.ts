import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inferCreator, quotedHandle } from "@/lib/catalog/creators";
import type { ScrapeRecord } from "@/lib/catalog/mapping";

describe("inferCreator", () => {
  it("maps shadcn/ui from a roundup to shadcn, not the curator", () => {
    expect(
      inferCreator({
        component_name: "shadcn/ui",
        author_handle: "@destraynor",
        source_post_kind: "roundup list",
        demo_url: "https://ui.shadcn.com/",
      }),
    ).toMatchObject({ slug: "shadcn", xHandle: "shadcn" });
  });

  it("maps shadcn-labs GitHub owner to shadcn", () => {
    expect(
      inferCreator({
        component_name: "mdxcn",
        author_handle: "@noahelhadedy",
        source_post_kind: "roundup list",
        code_path: "code/repos/shadcn-labs__mdxcn",
        demo_url: "https://mdxcn.dev",
      }).slug,
    ).toBe("shadcn");
  });

  it("uses the GitHub owner for roundup libraries", () => {
    expect(
      inferCreator({
        component_name: "Pin UI",
        author_handle: "@simoomdesign",
        source_post_kind: "roundup list",
        code_path: "code/repos/Rachit315__Pin-UI",
        demo_url: "http://pinui.xyz",
      }),
    ).toMatchObject({ slug: "rachit315", name: "Rachit315" });
  });

  it("keeps a single-post author as creator", () => {
    expect(
      inferCreator({
        component_name: "shadcn Trace (+ Code Block)",
        author_handle: "@shadcn",
        source_post_kind: "single post",
      }).slug,
    ).toBe("shadcn");
  });

  it("uses a quoted handle in the title", () => {
    expect(
      inferCreator({
        component_name: "Split/stretch/snap tables (by @haaarshsingh)",
        author_handle: "@componest",
        source_post_kind: "single post",
      }).xHandle,
    ).toBe("haaarshsingh");
  });

  it("maps seed records to real creators, not roundup curators", () => {
    const records = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/seed/components.json"), "utf8"),
    ) as ScrapeRecord[];
    const byName = new Map(
      records.map((record) => [record.component_name, inferCreator(record)]),
    );

    expect(byName.get("shadcn/ui")).toMatchObject({ slug: "shadcn", xHandle: "shadcn" });
    expect(byName.get("mdxcn")?.slug).toBe("shadcn");
    expect(byName.get("shadcn Trace (+ Code Block)")?.slug).toBe("shadcn");
    expect(byName.get("Pin UI")).toMatchObject({ slug: "rachit315" });
    expect(byName.get("Cue")?.slug).toBe("cue");
    expect(byName.get("Cue")?.xHandle).not.toBe("simoomdesign");
    expect(byName.get("ReUI")?.slug).not.toBe("shadcn");
    expect(byName.get("HeroUI v3")?.slug).toBe("heroui");
    expect(byName.get("Animate UI 2.0")?.slug).toBe("animate-ui");
  });
});

describe("quotedHandle", () => {
  it("reads by @user and quote of @user", () => {
    expect(quotedHandle("tables (by @haaarshsingh)")).toBe("haaarshsingh");
    expect(quotedHandle("video (quote of @tomkrcha)")).toBe("tomkrcha");
  });
});
