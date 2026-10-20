import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { listCreatorFacets, searchCatalog } from "@/db/queries";
import { DatabaseNotConfiguredError } from "@/db";
import { parseSearchParams } from "@/lib/catalog/search";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const filters = parseSearchParams(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const [result, creatorFacets] = await Promise.all([
      searchCatalog(filters),
      listCreatorFacets(filters),
    ]);
    return NextResponse.json({
      ...result,
      filters,
      facets: { creators: creatorFacets },
      semantic: {
        stubbed: result.modeUsed === "keyword",
        provider: process.env.EMBEDDING_PROVIDER ?? "stub",
        note:
          result.modeUsed === "keyword"
            ? "Keyword search is active. Hybrid keyword+vector ranking runs when an embedding provider is configured and item embeddings exist."
            : "Hybrid ranking used cosine distance over pgvector plus the keyword filters.",
      },
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
