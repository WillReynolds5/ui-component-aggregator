import { TEXT_EMBEDDING_DIMS } from "@/drizzle/schema";

export type EmbeddingProvider = {
  name: string;
  dimensions: number;
  embedText(text: string): Promise<number[]>;
  embedImage?(url: string): Promise<number[]>;
};

export class StubEmbeddingProvider implements EmbeddingProvider {
  name = "stub";
  dimensions = TEXT_EMBEDDING_DIMS;

  async embedText(text: string): Promise<number[]> {
    void text;
    throw new EmbeddingNotConfiguredError();
  }
}

export class EmbeddingNotConfiguredError extends Error {
  constructor() {
    super(
      "Semantic search is stubbed. Set EMBEDDING_PROVIDER=openai and OPENAI_API_KEY to generate embeddings.",
    );
    this.name = "EmbeddingNotConfiguredError";
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "openai";
  dimensions = TEXT_EMBEDDING_DIMS;
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  ) {}

  async embedText(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embeddings failed: ${response.status}`);
    }
    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data[0].embedding;
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const kind = process.env.EMBEDDING_PROVIDER ?? "stub";
  if (kind === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY);
  }
  return new StubEmbeddingProvider();
}

export function itemEmbeddingText(input: {
  name: string;
  description: string;
  framework: string;
  tags: string[];
  category?: string | null;
}): string {
  return [
    input.name,
    input.category,
    input.framework,
    input.tags.join(", "),
    input.description,
  ]
    .filter(Boolean)
    .join("\n");
}
