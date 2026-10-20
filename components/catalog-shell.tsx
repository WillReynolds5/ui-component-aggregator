import type { ReactNode } from "react";
import Link from "next/link";
import { CategorySidebar } from "@/components/category-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import type { Category } from "@/drizzle/schema";
import type { SearchFilters } from "@/lib/catalog/search";

export function CatalogShell({
  categories,
  filters,
  children,
}: {
  categories: Category[];
  filters: SearchFilters;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <MobileNav categories={categories} filters={filters} />
          <Link href="/" className="font-medium tracking-tight">
            component-library
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/creators" className="hover:text-foreground">
              Creators
            </Link>
          </nav>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Catalog of UI components and blocks
          </p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <CategorySidebar categories={categories} filters={filters} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
