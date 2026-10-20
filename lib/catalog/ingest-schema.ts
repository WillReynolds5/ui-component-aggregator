import { z } from "zod";

export const scrapeRecordSchema = z.object({
  post_url: z.string().nullable().optional(),
  author_handle: z.string().nullable().optional(),
  post_text: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  links: z.array(z.string()).nullable().optional(),
  image_paths: z.array(z.string()).nullable().optional(),
  component_name: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  style_tags: z.array(z.string()).nullable().optional(),
  framework: z.string().nullable().optional(),
  code_path: z.string().nullable().optional(),
  figma_url: z.string().nullable().optional(),
  demo_url: z.string().nullable().optional(),
  extraction_status: z.string().nullable().optional(),
  source_post_kind: z.string().nullable().optional(),
});

export const ingestBodySchema = z.union([
  z.array(scrapeRecordSchema),
  z.object({
    items: z.array(scrapeRecordSchema),
    dryRun: z.boolean().optional(),
  }),
  scrapeRecordSchema,
]);

export function normalizeIngestBody(body: unknown) {
  const parsed = ingestBodySchema.parse(body);
  if (Array.isArray(parsed)) return { records: parsed, dryRun: false };
  if ("items" in parsed) return { records: parsed.items, dryRun: parsed.dryRun ?? false };
  return { records: [parsed], dryRun: false };
}
