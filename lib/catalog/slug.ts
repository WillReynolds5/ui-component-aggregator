const STOP = new Set(["a", "an", "the", "and", "or", "of", "for", "to"]);

export function slugify(value: string, fallback = "item"): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return normalized || fallback;
}

export function slugifyUnique(value: string, used: Set<string>, extra = ""): string {
  const base = slugify(`${value}${extra ? `-${extra}` : ""}`);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  const next = `${base}-${i}`;
  used.add(next);
  return next;
}

export function handleToName(handle: string | null | undefined): string {
  if (!handle) return "Unknown";
  return handle.replace(/^@/, "");
}

export function compactQuery(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part && !STOP.has(part))
    .join(" ");
}
