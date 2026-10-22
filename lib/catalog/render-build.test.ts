import { describe, expect, it } from "vitest";
import { defaultChildren, mainFile, registryStylesheets } from "@/lib/catalog/render-build";

const file = (path: string) => ({ path, content: "export {}" });

describe("mainFile", () => {
  it("picks the file named after the component, not a helper listed first", () => {
    expect(
      mainFile({
        name: "tree-view",
        files: [file("components/base/dropdown/menu-styles.ts"), file("components/base/tree-view/tree-view.tsx")],
      })?.path,
    ).toBe("components/base/tree-view/tree-view.tsx");
  });

  it("matches an index file by its folder, and prefixed names by their tail", () => {
    expect(mainFile({ name: "bubble", files: [file("registry/backgrounds/bubble/index.tsx")] })?.path).toBe(
      "registry/backgrounds/bubble/index.tsx",
    );
    expect(
      mainFile({
        name: "backgrounds-bubble",
        files: [file("registry/lib/get-strict-context.tsx"), file("registry/backgrounds/bubble/index.tsx")],
      })?.path,
    ).toBe("registry/backgrounds/bubble/index.tsx");
  });

  it("falls back to the first .tsx, and skips files without content", () => {
    expect(
      mainFile({ name: "x", files: [{ path: "a.ts" }, file("b.ts"), file("c.tsx")] })?.path,
    ).toBe("c.tsx");
  });
});

describe("defaultChildren", () => {
  it("gives content to types that render empty without it", () => {
    expect(defaultChildren("buttons")).toBe("Button");
    expect(defaultChildren("cards")).toBeNull();
  });
});

describe("registryStylesheets", () => {
  it("returns dependency stylesheets with local imports inlined, skipping code-imported CSS", () => {
    const files = new Map([
      ["components/button.tsx", 'import "./button.css";\nexport function Button() {}'],
      ["components/button.css", ".own { color: red }"],
      ["styles/globals.css", '@import "tailwindcss";\n@import "./theme.css";\nbody { margin: 0 }'],
      ["styles/theme.css", "@theme { --color-brand: blue; }"],
    ]);
    const css = registryStylesheets(files);
    expect(css).toContain("--color-brand: blue");
    expect(css).toContain("body { margin: 0 }");
    expect(css).not.toContain('@import "tailwindcss"');
    expect(css).not.toContain(".own");
    // theme.css is inlined into globals.css, not emitted a second time.
    expect(css.match(/--color-brand/g)).toHaveLength(1);
  });
});
