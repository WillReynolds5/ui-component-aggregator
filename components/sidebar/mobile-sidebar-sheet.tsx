"use client";

import { useState } from "react";
import { PanelLeftIcon } from "lucide-react";
import { CategoryNav } from "@/components/sidebar/category-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CategoryNode } from "@/lib/catalog/category-tree";

export function MobileSidebarSheet({
  tree,
  total,
  newThisWeek,
}: {
  tree: CategoryNode[];
  total: number;
  newThisWeek: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open categories" />}
      >
        <PanelLeftIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Browse</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-3 pt-4">
          <CategoryNav
            tree={tree}
            total={total}
            newThisWeek={newThisWeek}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
