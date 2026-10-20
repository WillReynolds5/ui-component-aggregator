"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hrefWithFilters } from "@/lib/catalog/url";
import type { SearchFilters } from "@/lib/catalog/search";

export function SearchBar({
  filters,
  pathname = "/",
  autoFocus = false,
}: {
  filters: SearchFilters;
  pathname?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={pathname}
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const q = String(form.get("q") ?? "");
        startTransition(() => {
          router.push(hrefWithFilters(pathname, { ...filters, q, offset: 0 }));
        });
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        defaultValue={filters.q ?? ""}
        placeholder="Search components, blocks, creators, sources…"
        autoFocus={autoFocus}
        className="h-12 rounded-xl border-foreground/10 bg-card pl-10 pr-24 text-base shadow-none md:text-base"
        aria-label="Search the catalog"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
        {pending ? "…" : "Enter"}
      </kbd>
    </form>
  );
}
