import { BrowseSkeleton } from "@/components/browse-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <BrowseSkeleton />
    </div>
  );
}
