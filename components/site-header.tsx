import { Suspense } from "react";
import Link from "next/link";
import { SearchBox, SearchBoxFallback } from "@/components/search-box";
import { MobileSidebar } from "@/components/sidebar/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "component-library";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <MobileSidebar />
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-2 font-semibold tracking-tight lg:w-56">
          <LogoMark />
          <span className="hidden sm:inline">{appName}</span>
        </Link>
        <Suspense fallback={<SearchBoxFallback className="max-w-xl flex-1" />}>
          <SearchBox className="max-w-xl flex-1" />
        </Suspense>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/creators"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
          >
            Creators
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span aria-hidden className="grid size-7 grid-cols-2 gap-0.5 rounded-lg bg-foreground p-1.5">
      <span className="rounded-[2px] bg-background" />
      <span className="rounded-[2px] bg-background/50" />
      <span className="rounded-[2px] bg-background/50" />
      <span className="rounded-full bg-background" />
    </span>
  );
}
