"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";

/** Pages whose grid the query should filter in place; anywhere else, search from Discover. */
function searchTarget(pathname: string): string {
  return pathname === "/" ||
    pathname.startsWith("/categories/") ||
    /^\/creators\/[^/]+$/.test(pathname)
    ? pathname
    : "/";
}

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const q = searchParams.get("q") ?? "";

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = q;
    }
  }, [q]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const value = inputRef.current?.value.trim() ?? "";
        const target = searchTarget(pathname);
        const params = new URLSearchParams(target === pathname ? searchParams.toString() : "");
        if (value) params.set("q", value);
        else params.delete("q");
        params.delete("offset");
        params.delete("limit");
        const query = params.toString();
        startTransition(() => router.push(query ? `${target}?${query}` : target));
        inputRef.current?.blur();
      }}
    >
      {pending ? (
        <LoaderCircleIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <input
        ref={inputRef}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search components, libraries, creators…"
        aria-label="Search the catalog"
        autoComplete="off"
        className="peer h-9 w-full rounded-full bg-muted/80 pr-14 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:bg-background focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md border bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground peer-focus:hidden sm:block">
        ⌘K
      </kbd>
    </form>
  );
}

export function SearchBoxFallback({ className }: { className?: string }) {
  return <div className={cn("h-9 rounded-full bg-muted/80", className)} />;
}
