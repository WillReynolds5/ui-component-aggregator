import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreatorAvatar } from "@/components/creator-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listCreators } from "@/db/queries";

export const metadata: Metadata = {
  title: "Creators",
  description: "Designers and engineers whose components, blocks, and libraries are in the catalog.",
};

export default function CreatorsPage() {
  return (
    <div className="px-4 pt-8 pb-16 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Creators</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
        The designers and engineers behind everything in the catalog.
      </p>
      <Suspense fallback={<CreatorsSkeleton />}>
        <CreatorList />
      </Suspense>
    </div>
  );
}

async function CreatorList() {
  await connection();
  const creators = await listCreators();
  if (!creators.length) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
        No creators yet. They appear as the bot finds their work.
      </p>
    );
  }
  return (
    <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
      {creators.map((creator) => (
        <li key={creator.id}>
          <Link
            href={`/creators/${creator.slug}`}
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-muted/60"
          >
            <CreatorAvatar name={creator.name} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{creator.name}</span>
              <span className="block truncate text-[13px] text-muted-foreground">
                {creator.xHandle ? `@${creator.xHandle}` : (creator.website?.replace(/^https?:\/\//, "") ?? "—")}
              </span>
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
              {creator.count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CreatorsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton key={index} className="h-[74px] rounded-2xl" />
      ))}
    </div>
  );
}
