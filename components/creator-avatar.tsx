import { cn } from "cn";

const COLORS = [
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-200",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 17 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function CreatorAvatar({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-16 text-2xl",
        colorFor(name),
        className,
      )}
    >
      {initial}
    </span>
  );
}
