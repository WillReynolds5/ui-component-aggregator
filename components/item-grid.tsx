import { ItemCard } from "@/components/item-card";
import type { ItemCardRecord } from "@/db/queries";

export function ItemGrid({
  items,
  dense = false,
  emptyTitle = "Nothing here yet",
  emptyBody = "The bot adds new finds around the clock. Try a broader search, or clear a filter.",
}: {
  items: ItemCardRecord[];
  dense?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-20 text-center">
        <p className="font-medium">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div
      className={
        dense
          ? "grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3"
          : "grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4"
      }
    >
      {items.map((item, index) => (
        <ItemCard key={item.id} item={item} priority={index < 6} />
      ))}
    </div>
  );
}
