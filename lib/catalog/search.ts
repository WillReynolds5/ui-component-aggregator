export type SearchMode = "keyword" | "semantic" | "hybrid";

export type SearchFilters = {
  q?: string;
  kind?: "component" | "block";
  framework?: string;
  pricing?: "free" | "paid" | "freemium";
  access?: "full_code" | "install_only" | "link_only";
  categorySlug?: string;
  tags?: string[];
  creators?: string[];
  mode?: SearchMode;
  limit?: number;
  offset?: number;
};

export const KEYWORD_WEIGHT = 0.45;
export const VECTOR_WEIGHT = 0.55;

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const splitList = (raw: string | undefined) =>
    raw
      ? raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined;

  const tags = splitList(first("tag") ?? first("tags"));
  const creators = splitList(first("creator") ?? first("creators"));

  const limit = Number(first("limit") ?? 48);
  const offset = Number(first("offset") ?? 0);
  const mode = first("mode");

  return {
    q: first("q")?.trim() || undefined,
    kind: asEnum(first("kind"), ["component", "block"]),
    framework: first("framework")?.trim() || undefined,
    pricing: asEnum(first("pricing"), ["free", "paid", "freemium"]),
    access: asEnum(first("access"), ["full_code", "install_only", "link_only"]),
    categorySlug: first("category")?.trim() || undefined,
    tags: tags?.length ? tags : undefined,
    creators: creators?.length ? creators : undefined,
    mode: asEnum(mode, ["keyword", "semantic", "hybrid"]) ?? "keyword",
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 48,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

function asEnum<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function keywordPattern(q: string): string {
  return `%${q.replace(/[%_]/g, "\\$&")}%`;
}

export function hybridReady(hasQueryEmbedding: boolean, mode: SearchMode): boolean {
  if (mode === "keyword") return false;
  return hasQueryEmbedding;
}

export function hybridScore(keywordScore: number, vectorScore: number | null): number {
  if (vectorScore == null) return keywordScore;
  return KEYWORD_WEIGHT * keywordScore + VECTOR_WEIGHT * vectorScore;
}
