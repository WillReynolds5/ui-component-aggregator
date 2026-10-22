import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryTrail } from "@/lib/catalog/category-tree";
import type { Category } from "@/drizzle/schema";

function row(id: string, slug: string, parentId: string | null, sortOrder: number): Category {
  const now = new Date();
  return { id, slug, name: slug, description: null, parentId, sortOrder, createdAt: now, updatedAt: now };
}

describe("buildCategoryTree", () => {
  const rows = [
    row("b", "blocks", null, 1),
    row("a", "actions", null, 0),
    row("menu", "dropdown-menus", "a", 1),
    row("btn", "buttons", "a", 0),
  ];

  it("orders sections and rolls child counts up to the section", () => {
    const tree = buildCategoryTree(rows, { btn: 3, menu: 2, b: 1 });
    expect(tree.map((node) => node.slug)).toEqual(["actions", "blocks"]);
    expect(tree[0].children.map((node) => node.slug)).toEqual(["buttons", "dropdown-menus"]);
    expect(tree[0].count).toBe(5);
    expect(tree[1].count).toBe(1);
  });

  it("finds the trail to a leaf", () => {
    const tree = buildCategoryTree(rows);
    expect(categoryTrail(tree, "dropdown-menus").map((node) => node.slug)).toEqual([
      "actions",
      "dropdown-menus",
    ]);
    expect(categoryTrail(tree, "missing")).toEqual([]);
  });
});
