import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemDetail, ItemDetailSkeleton } from "@/components/item-detail";
import { ItemModal } from "@/components/item-modal";
import { loadItem } from "@/db/item";

type ItemModalPageProps = { params: Promise<{ slug: string }> };

/** Quick view: a soft navigation to /items/[slug] from a grid opens this over the grid. */
export default function ItemModalPage({ params }: ItemModalPageProps) {
  return (
    <ItemModal>
      <Suspense fallback={<ItemDetailSkeleton inModal />}>
        <ModalContent params={params} />
      </Suspense>
    </ItemModal>
  );
}

async function ModalContent({ params }: ItemModalPageProps) {
  const { slug } = await params;
  const data = await loadItem(slug);
  if (!data) notFound();
  return <ItemDetail data={data} inModal />;
}
