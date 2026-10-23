"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Maximize2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ItemModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The intercepted URL is the item's real URL, so it doubles as the full-page link.
  const pathname = usePathname();

  // On a soft navigation away (sidebar, creator link), the @modal slot keeps its last state,
  // so close here. A null catch-all page in the slot would do it too, but under partial
  // prefetching Next re-prefetches that empty segment in a tight loop (hundreds/second).
  if (!pathname.startsWith("/items/")) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : router.back())}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100dvh-2rem)] max-w-[min(72rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[calc(100dvh-4rem)] sm:max-w-[min(72rem,calc(100%-4rem))]"
      >
        <DialogTitle className="sr-only">Item details</DialogTitle>
        <div className="flex shrink-0 justify-end gap-1 px-3 pt-3">
          {/* A plain anchor: a client <Link> would be intercepted straight back into this modal. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open full page"
            nativeButton={false}
            render={<a href={pathname} />}
          >
            <Maximize2Icon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => router.back()}>
            <XIcon />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
