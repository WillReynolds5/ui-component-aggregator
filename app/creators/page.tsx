import type { Metadata } from "next";
import Link from "next/link";
import { CatalogShell } from "@/components/catalog-shell";
import { listCategories, listCreators } from "@/db/queries";

export const metadata: Metadata = {
  title: "Creators",
  description: "Designers and authors whose components and blocks are in the catalog.",
};

export default async function CreatorsPage() {
  const [categories, creators] = await Promise.all([listCategories(), listCreators()]);

  return (
    <CatalogShell categories={categories} filters={{}}>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-medium tracking-tight">Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Designers and authors whose components and blocks are in the catalog.
          </p>
        </div>
        {creators.length ? (
          <ul className="divide-y rounded-xl border">
            {creators.map((creator) => (
              <li key={creator.id}>
                <Link
                  href={`/creators/${creator.slug}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60"
                >
                  <span>
                    <span className="font-medium">{creator.name}</span>
                    {creator.xHandle ? (
                      <span className="ml-2 text-sm text-muted-foreground">
                        @{creator.xHandle}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {creator.count} {creator.count === 1 ? "item" : "items"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
            No creators yet. Seed the catalog first.
          </p>
        )}
      </div>
    </CatalogShell>
  );
}
