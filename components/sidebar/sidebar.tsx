import { Suspense } from "react";
import { CategoryNav } from "@/components/sidebar/category-nav";
import { MobileSidebarSheet } from "@/components/sidebar/mobile-sidebar-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { loadNav } from "@/db/browse";

async function SidebarNav() {
  const { tree, total, newThisWeek } = await loadNav();
  return <CategoryNav tree={tree} total={total} newThisWeek={newThisWeek} />;
}

export function Sidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r px-3 pt-4 scrollbar-thin lg:block">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}

async function MobileSidebarData() {
  const { tree, total, newThisWeek } = await loadNav();
  return <MobileSidebarSheet tree={tree} total={total} newThisWeek={newThisWeek} />;
}

export function MobileSidebar() {
  return (
    <Suspense fallback={<span className="size-8 lg:hidden" />}>
      <MobileSidebarData />
    </Suspense>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-1">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="mt-3 h-8 w-full" />
      {Array.from({ length: 9 }).map((_, index) => (
        <Skeleton key={index} className="h-6" style={{ width: `${55 + ((index * 17) % 40)}%` }} />
      ))}
    </div>
  );
}
