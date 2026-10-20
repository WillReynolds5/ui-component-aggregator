import { ItemCard } from "@/components/item-card";
import type { ItemCardRecord } from "@/db/queries";

export function ItemGrid({ items }: { items: ItemCardRecord[] }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <p className="text-sm font-medium">No items match these filters.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Clear a filter or try a broader search.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
