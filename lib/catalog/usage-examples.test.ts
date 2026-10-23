import { describe, expect, it } from "vitest";
import { codeBlocks, exportedComponents, toExampleModule } from "@/lib/catalog/usage-examples";

const arcMarkdown = `# Alert

## Installation

\`\`\`bash
npx shadcn@latest add https://uiarc.dev/r/alert.json
\`\`\`

## Usage

\`\`\`tsx
import { Alert } from "@/components/arc/alert/alert";

export function BillingNotice() {
  return <Alert tone="warning" title="Card expires soon">Update your card.</Alert>;
}
\`\`\`
`;

describe("codeBlocks", () => {
  it("returns tsx blocks with their heading and skips other languages", () => {
    const blocks = codeBlocks(arcMarkdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].heading).toBe("Usage");
    expect(blocks[0].code).toContain("export function BillingNotice");
  });
});

describe("toExampleModule", () => {
  it("keeps a block that already exports a component", () => {
    const code = codeBlocks(arcMarkdown)[0].code;
    expect(toExampleModule(code)).toBe(code);
  });

  it("wraps an imports-plus-JSX snippet into a component", () => {
    const example = toExampleModule(
      'import { Fader } from "@/components/audio/fader";\nimport {\n  Knob,\n} from "@/components/audio/knob";\n\n<Fader label="Volume" defaultValue={60} />',
    );
    expect(example).toContain("export default function UsageExample()");
    expect(example).toContain('<Fader label="Volume" defaultValue={60} />');
    expect(example).toContain('import {\n  Knob,\n} from "@/components/audio/knob";');
  });

  it("skips fragments that aren't a single JSX expression", () => {
    expect(toExampleModule('import { x } from "y";\nconst a = 1;\nconsole.log(a);')).toBeNull();
    expect(toExampleModule("<Alert />")).toBeNull();
  });
});

describe("exportedComponents", () => {
  it("finds exported component names in every export style", () => {
    expect(
      exportedComponents(
        "export function Alert() {}\nexport const BillingPrice = () => null;\nconst A = 1; const B = 2;\nexport { A as Toggle, B, type Props }\nexport default Alert;",
      ).sort(),
    ).toEqual(["Alert", "B", "BillingPrice", "Toggle"]);
  });
});
