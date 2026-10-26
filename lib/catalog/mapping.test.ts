import { describe, expect, it } from "vitest";
import {
  inferAccess,
  mapScrapeRecord,
  normalizeFramework,
  repoUrlFromCodePath,
} from "@/lib/catalog/mapping";

describe("normalizeFramework", () => {
  it("splits React/Tailwind into framework + styling", () => {
    expect(normalizeFramework("React/shadcn/Tailwind")).toEqual({
      framework: "react",
      styling: "tailwind",
      dependencies: ["React", "shadcn", "Tailwind"],
    });
  });

  it("maps n/a to unknown", () => {
    expect(normalizeFramework("n/a").framework).toBe("unknown");
  });
});

describe("inferAccess", () => {
  it("marks paid link-only libraries as paid", () => {
    expect(inferAccess("link only: paid ($99 lifetime), no public source")).toEqual({
      access: "link_only",
      pricing: "paid",
      installCommand: null,
    });
  });

  it("detects shadcn registry install commands", () => {
    const result = inferAccess("full code (shadcn registry; code-block in code/shadcn-code-block/)");
    expect(result.access).toBe("install_only");
    expect(result.installCommand).toContain("shadcn");
  });

  it("extracts npx skills add", () => {
    const result = inferAccess("full code (repo from install cmd npx skills add diffusionstudio/lottie)");
    expect(result.access).toBe("install_only");
    expect(result.installCommand).toBe("npx skills add diffusionstudio/lottie");
  });
});

describe("mapScrapeRecord", () => {
  it("requires a source URL and maps creator/source fields", () => {
    const mapped = mapScrapeRecord({
      component_name: "Pin UI",
      type: "component library",
      category: "library",
      framework: "React",
      demo_url: "http://pinui.xyz",
      author_handle: "@simoomdesign",
      post_url: "https://x.com/simoomdesign/status/1",
      post_text: "Bookmark these libraries",
      extraction_status: "full code",
      code_path: "code/repos/Rachit315__Pin-UI",
      style_tags: ["unique"],
      date: "2026-10-19T04:37:02.000Z",
    });

    expect(mapped.sourceUrl).toContain("pinui.xyz");
    expect(mapped.kind).toBe("component");
    expect(mapped.access).toBe("full_code");
    expect(mapped.creatorHandle).toBe("Rachit315");
    expect(mapped.creatorSlug).toBe("rachit315");
    expect(mapped.sourceRepoUrl).toBe("https://github.com/Rachit315/Pin-UI");
    expect(mapped.categorySlug).toBe("libraries");
    expect(mapped.code).toBeNull();
  });

  it("maps landing pages to blocks / hero", () => {
    const mapped = mapScrapeRecord({
      component_name: "Launch",
      type: "block",
      category: "hero/landing page",
      demo_url: "https://example.com",
    });
    expect(mapped.kind).toBe("block");
    expect(mapped.categorySlug).toBe("hero");
  });
});

describe("repoUrlFromCodePath", () => {
  it("turns scraper clone paths into GitHub URLs", () => {
    expect(repoUrlFromCodePath("code/repos/keenthemes__reui")).toBe(
      "https://github.com/keenthemes/reui",
    );
  });
});

describe("shadcn install command", () => {
  const base = {
    component_name: "Split Button",
    type: "component",
    category: "Buttons",
    extraction_status: "full code (shadcn registry)",
    demo_url: "https://uiarc.dev/components/split-button",
  };

  it("uses a registry item URL from links, never the docs page", () => {
    const mapped = mapScrapeRecord({ ...base, links: ["https://uiarc.dev/r/split-button.json"] });
    expect(mapped.installCommand).toBe("npx shadcn@latest add https://uiarc.dev/r/split-button.json");
    expect(mapped.sourceUrl).toBe("https://uiarc.dev/components/split-button");
  });

  it("leaves the command out when no registry item URL is known", () => {
    expect(mapScrapeRecord(base).installCommand).toBeNull();
  });
});
