import Link from "next/link";
import { cn } from "cn";
import type { Category } from "@/drizzle/schema";
import { hrefWithFilters } from "@/lib/catalog/url";
import type { SearchFilters } from "@/lib/catalog/search";

type TreeNode = Category & { children: TreeNode[] };

export function buildCategoryTree(rows: Category[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

function CategoryLink({
  node,
  filters,
  depth,
  path,
}: {
  node: TreeNode;
  filters: SearchFilters;
  depth: number;
  path: string[];
}) {
  const active = filters.categorySlug === node.slug;
  const href = hrefWithFilters(`/categories/${path.join("/")}`, {
    ...filters,
    categorySlug: node.slug,
    offset: 0,
  });

  return (
    <div>
      <Link
        href={href}
        className={cn(
          "block rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted",
          depth === 0 ? "font-medium" : "text-muted-foreground hover:text-foreground",
          active && "bg-muted text-foreground",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {node.name}
      </Link>
      {node.children.map((child) => (
        <CategoryLink
          key={child.id}
          node={child}
          filters={filters}
          depth={depth + 1}
          path={[...path, child.slug]}
        />
      ))}
    </div>
  );
}

export function CategorySidebar({
  categories,
  filters,
}: {
  categories: Category[];
  filters: SearchFilters;
}) {
  const tree = buildCategoryTree(categories);
  return (
    <nav aria-label="Categories" className="space-y-1">
      <Link
        href={hrefWithFilters("/", { ...filters, categorySlug: undefined, offset: 0 })}
        className={cn(
          "block rounded-md px-2 py-1 text-sm font-medium hover:bg-muted",
          !filters.categorySlug && "bg-muted",
        )}
      >
        All items
      </Link>
      {tree.map((node) => (
        <CategoryLink
          key={node.id}
          node={node}
          filters={filters}
          depth={0}
          path={[node.slug]}
        />
      ))}
    </nav>
  );
}
