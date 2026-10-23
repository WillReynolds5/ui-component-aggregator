"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FilterOption = {
  label: string;
  href: string;
  active: boolean;
  count?: number;
};

export function FilterMenu({
  label,
  options,
  activeLabel,
}: {
  label: string;
  options: FilterOption[];
  /** Shown on the trigger when something is selected, e.g. "Paid" or "2 creators". */
  activeLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!options.length) return null;
  const selected = Boolean(activeLabel);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
          pending && "opacity-60",
          selected
            ? "border-foreground bg-foreground text-background aria-expanded:bg-foreground/90"
            : "bg-background text-foreground hover:bg-muted",
        )}
      >
        {selected ? activeLabel : label}
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 max-h-80" align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.label}
            // Navigate from the item's own handler: a <Link> inside the popup loses the click
            // when the menu unmounts, and it lands on whatever card sits underneath.
            onClick={() => startTransition(() => router.push(option.href, { scroll: false }))}
            className="gap-2"
          >
            <span className="grid size-4 place-items-center">
              {option.active ? <CheckIcon className="size-3.5" /> : null}
            </span>
            <span className="truncate">{option.label}</span>
            {option.count !== undefined ? (
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{option.count}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
