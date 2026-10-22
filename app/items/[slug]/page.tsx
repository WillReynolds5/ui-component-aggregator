import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemDetail, ItemDetailSkeleton } from "@/components/item-detail";
import { loadItem } from "@/db/item";
import { getItemBySlug } from "@/db/queries";

type ItemPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) return { title: "Not found" };
  return {
    title: item.name,
    description: `${item.name} — ${item.primaryCategory.name.toLowerCase()} from ${item.source.name}.`,
  };
}

// Database reads must sit inside <Suspense> under cacheComponents. Reading them at the top
// level of the page is what crashed /items/* in production.
export default function ItemPage({ params }: ItemPageProps) {
  return (
    <Suspense fallback={<ItemDetailSkeleton />}>
      <ItemContent params={params} />
    </Suspense>
  );
}

async function ItemContent({ params }: ItemPageProps) {
  const { slug } = await params;
  const data = await loadItem(slug);
  if (!data) notFound();
  return <ItemDetail data={data} />;
}
