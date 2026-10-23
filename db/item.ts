import { cache } from "react";
import { connection } from "next/server";
import { loadNav } from "@/db/browse";
import { getItemBySlug, libraryComponents, relatedItems } from "@/db/queries";
import { categoryTrail } from "@/lib/catalog/category-tree";

/** One query per request: generateMetadata and the page both ask for the item. */
export const getItem = cache(getItemBySlug);

export async function loadItem(slug: string) {
  await connection();
  const [item, nav] = await Promise.all([getItem(slug), loadNav()]);
  if (!item) return null;
  const [related, components] = await Promise.all([
    relatedItems(item.id, item.primaryCategoryId),
    libraryComponents(item.id),
  ]);
  return { item, related, components, trail: categoryTrail(nav.tree, item.primaryCategory.slug) };
}

export type LoadedItem = NonNullable<Awaited<ReturnType<typeof loadItem>>>;
