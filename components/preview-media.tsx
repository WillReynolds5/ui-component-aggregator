import { cn } from "cn";

const PALETTES = [
  ["#ece7e1", "#1f1c19", "#c45c26"],
  ["#e8eee9", "#16332a", "#3d8b74"],
  ["#eceaf6", "#221b3a", "#6d5bd0"],
  ["#f3e7ea", "#3a151c", "#c43d55"],
  ["#e7eef6", "#142033", "#3d6bb3"],
];

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function PreviewMedia({
  name,
  url,
  kind,
  className,
}: {
  name: string;
  url?: string | null;
  kind?: "image" | "video" | "demo_url" | null;
  className?: string;
}) {
  const [bg, fg, accent] = paletteFor(name);
  const usable =
    url && (url.startsWith("http://") || url.startsWith("https://")) && kind === "image"
      ? url
      : null;

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden bg-muted",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${bg} 0%, ${accent}22 100%)` }}
    >
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={usable} alt={name} className="size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end p-4">
          <div
            className="h-16 w-24 rounded-lg shadow-sm"
            style={{ background: fg, opacity: 0.88 }}
          />
          <div
            className="ml-2 mb-1 h-8 w-20 rounded-md"
            style={{ background: accent, opacity: 0.7 }}
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
    </div>
  );
}
