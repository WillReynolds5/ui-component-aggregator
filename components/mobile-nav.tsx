import { MenuIcon } from "lucide-react";
import { CategorySidebar } from "@/components/category-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Category } from "@/drizzle/schema";
import type { SearchFilters } from "@/lib/catalog/search";

export function MobileNav({
  categories,
  filters,
}: {
  categories: Category[];
  filters: SearchFilters;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open categories" />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Categories</SheetTitle>
        </SheetHeader>
        <div className="px-2 pb-6">
          <CategorySidebar categories={categories} filters={filters} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
