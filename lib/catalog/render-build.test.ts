import { describe, expect, it } from "vitest";
import {
  assetLiterals,
  defaultChildren,
  mainFile,
  namedImports,
  registryStylesheets,
  sanitizeRegistryCss,
} from "@/lib/catalog/render-build";

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

describe("sanitizeRegistryCss", () => {
  it("removes every directive that would make Tailwind read the local disk", () => {
    const css = sanitizeRegistryCss(
      [
        '@import "/Users/me/.aws/sso/cache/token.json";',
        "@import url(../../secrets.json);",
        '@plugin "/tmp/evil.js";',
        '@config "../tailwind.config.js";',
        '@source "/";',
        '@reference "./x.css";',
        ".ok { color: red; }",
      ].join("\n"),
    );
    expect(css).not.toMatch(/@(import|plugin|config|source|reference)/);
    expect(css).toContain(".ok { color: red; }");
  });

  it("drops unresolved imports from dependency stylesheets", () => {
    const css = registryStylesheets(new Map([["styles/globals.css", '@import "/etc/hosts.json";\nbody { margin: 0 }']]));
    expect(css).not.toContain("@import");
  });
});

describe("namedImports", () => {
  it("collects named imports per package and skips packages also imported whole", () => {
    const map = namedImports([
      'import { ArrowUpIcon, CheckIcon as Check } from "lucide-react";\nimport { motion } from "motion/react";',
      'import { XIcon } from "lucide-react";\nimport * as React from "react";\nimport clsx from "clsx";',
      'import { type ClassValue } from "clsx";\nimport type { Foo } from "foo";\nimport { a } from "./local";',
    ]);
    expect(map.get("lucide-react")?.sort()).toEqual(["ArrowUpIcon", "CheckIcon", "XIcon"]);
    expect(map.get("motion/react")).toEqual(["motion"]);
    expect(map.has("react")).toBe(false);
    expect(map.has("clsx")).toBe(false);
    expect(map.has("foo")).toBe(false);
    expect(map.has("./local")).toBe(false);
  });
});

describe("assetLiterals", () => {
  it("finds root-relative asset paths in code and CSS, not routes or runtime-built paths", () => {
    const found = assetLiterals([
      '<img src="/media/people/sofia-ramirez.jpg" /><img src={"/block-logos/vercel.svg"} />',
      ".hero { background: url(/media/photos/room.jpg?v=2); }",
      'const href = "/components/button"; const audio = `/sounds/taxi/${name}.wav`;',
    ]);
    expect(found.sort()).toEqual(["/block-logos/vercel.svg", "/media/people/sofia-ramirez.jpg", "/media/photos/room.jpg"]);
  });
});
