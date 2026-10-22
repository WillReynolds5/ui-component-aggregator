import type { Category } from "@/drizzle/schema";

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Items whose primary category is this node or any descendant. */
  count: number;
  children: CategoryNode[];
};

export function buildCategoryTree(
  rows: Category[],
  counts: Record<string, number> = {},
): CategoryNode[] {
  const byId = new Map<string, CategoryNode & { parentId: string | null; sortOrder: number }>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      count: counts[row.id] ?? 0,
      children: [],
      parentId: row.parentId,
      sortOrder: row.sortOrder,
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const order = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => {
      const left = byId.get(a.id)!;
      const right = byId.get(b.id)!;
      return left.sortOrder - right.sortOrder || a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      order(node.children);
      node.count += node.children.reduce((sum, child) => sum + child.count, 0);
    }
  };
  order(roots);
  return roots;
}

/** Root-to-node path, e.g. [Actions, Dropdown menus]. Empty when the slug is unknown. */
export function categoryTrail(tree: CategoryNode[], slug: string): CategoryNode[] {
  for (const node of tree) {
    if (node.slug === slug) return [node];
    const below = categoryTrail(node.children, slug);
    if (below.length) return [node, ...below];
  }
  return [];
}
