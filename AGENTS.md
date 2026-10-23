<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# component-library

Working name. Next.js App Router catalog of UI components/blocks. No auth. Postgres + pgvector. Drizzle.

## Setup

```bash
cp .env.example .env
docker compose up -d --wait
npm install
npm run db:migrate
npm run db:seed
npm run dev          # http://127.0.0.1:4321
```

## Layout

| Path | Why |
| --- | --- |
| `app/` | App Router UI + `api/search`, `api/ingest`, `api/health` |
| `db/` | Drizzle client (`getDb`) |
| `drizzle/` | Schema + SQL migrations |
| `drizzle.config.ts` | drizzle-kit |
| `lib/catalog/` | Mapping, taxonomy, search, embeddings, ingest (unit-tested) |
| `proxy.ts` | Next.js 16 request proxy (replaces `middleware.ts`) |
| `aws/Dockerfile` | Unused fallback. Production is the arm64 zip |
| `infra/` | CDK stack, us-east-2, zip Lambda + CloudFront + Data API |
| `DEPLOY.md` | Ordered Mac deploy commands (profile `personal`) |
| `scripts/build-lambda.sh` | Apple Silicon–friendly standalone zip + static tree |
| `scripts/capture-previews.ts` | CLI: Playwright screenshots → `public/previews/` locally, or S3 with `PREVIEWS_BUCKET` |
| `functions/capture-previews.ts` | Lambda (x86_64) running the same capture in prod; core in `lib/catalog/capture-run.ts` |
| `app/@modal/` | Quick-view modal: intercepts `/items/[slug]` on soft navigation |
| `scripts/extract-components.ts` | Library registry → one item per component with a live render (`npm run components:extract`) |
| `data/seed/components.json` | 62-record X scrape |

Owner apps (`family-graph`, stellar/gong) were private and not readable from this environment. This repo follows the paths they named: `aws/`, `infra/`, `buildspec.yml`, Drizzle like gong, `proxy.ts` + `next.config.ts` like family-graph.

## Data model

Core table is `items`. Required: `source_url`, `source_id`, `primary_category_id`. Optional: `creator_id`, `discovered_via_post_url`, `code`, `install_command`.

```mermaid
erDiagram
  sources ||--o{ items : publishes
  creators ||--o{ items : creates
  categories ||--o{ categories : parent
  categories ||--o{ items : primary
  items ||--o{ item_tags : has
  tags ||--o{ item_tags : applied
  items ||--o{ media : previews
  items ||--o{ variants : has
  items ||--o{ item_parts : composed
  items ||--o{ embeddings : vector
```

`item_parts(parent_item_id, child_item_id)` is block → component composition (`built from` / `used in`).

## Taxonomy and UI

`lib/catalog/taxonomy.ts` is the sidebar. Top-level nodes are sections, children are element types. Slugs are ids that items reference, so rename `name`, never `slug`; re-seed after edits (the seed deletes categories that left the tree and have no items). `mapScrapeCategory(category, type)` maps raw scrape labels through every node's name, slug, and `aliases`; a strong scrape `type` (tool, tutorial, component library…) wins over the category. Unknown labels land in `other`.

Every page reads the DB inside `<Suspense>`, after `connection()` (see `db/browse.ts`). `cacheComponents` is on: a top-level DB read crashes the route in production, and the RDS Data API client's random ids are refused during prerender.

## Previews

`media.source` is `scrape` (replaced on every re-ingest) or `capture` (our screenshots, kept). `pickPreview` prefers a capture. X, YouTube, and LinkedIn URLs are skipped (login walls). Cookie banners are hidden with CSS, never accepted. Files are content-hashed and served from `/previews/*`.

In production it's automatic. `POST /api/ingest` async-invokes the `CapturePreviews` Lambda with the ids it just wrote (batches of 10, `CAPTURE_FUNCTION_NAME`), and an EventBridge rule sweeps up to 25 uncaptured items daily. There's deliberately no frequent schedule: each run queries Aurora, and waking it from 0 ACU every half hour would cost more than the job. Locally `CAPTURE_FUNCTION_NAME` is unset, so ingest skips it; run `npm run previews:capture` (`--slug`, `--force`, `--limit`).

Enums under the RDS Data API: every string param arrives as `text`. Comparisons need `enumEq` from `db/enum.ts` (never `eq` on an enum column; it passes locally on postgres-js and fails in production). Inserts and updates rely on implicit `text → enum` casts from migration 0002; a new `pgEnum` needs its name added there.

Lambda gotchas, all found by running the bundle in `public.ecr.aws/lambda/nodejs:22`: `@sparticuz/chromium`'s npm build is x64-only (hence x86_64), it's ESM-only (hence the ESM bundle + `require` banner in `infra/lib/stack.ts`), and it runs `--single-process`, where closing a context kills the browser (hence one browser per item). Keep `playwright`, `playwright-core`, and `@sparticuz/chromium` on matching Chromium majors (1.63.0 ↔ 153.0.0) when upgrading.

## Live components

Libraries that publish a shadcn registry (`/r/registry.json`) are expanded into one item per component: `lib/catalog/registry.ts` reads and categorizes entries, `lib/catalog/render-build.ts` builds each into a standalone HTML page, and `scripts/extract-components.ts` verifies every page in Chromium before storing it. Items link to their library (`library_item_id`), are keyed by `registry_url`, and carry the real source in `code` and `npx shadcn@latest add <url>` as the install command.

- **Self-contained renders.** npm packages are bundled in at build time (React from this repo's node_modules; everything else fetched from esm.sh at a pinned version, throttled and cached in `node_modules/.cache/render-deps`). Never load modules at view time: renders run in opaque-origin sandboxed iframes that share no HTTP cache, and one card once made 230 requests (`@phosphor-icons/react` exhausted Chromium). esm.sh `?exports=` trims icon packages; builds retry without it when it drops a needed name.
- **What gets rendered.** A bare component has no props or content (an empty Alert, a stateless toggle), so extraction tries, in order: the registry's own demo item (`<name>-demo`, `demo-<name>`), the author's usage example from the component's docs markdown (`<page>/markdown` or `<page>.md`; `lib/catalog/usage-examples.ts`, bare JSX snippets get wrapped), then the bare component. Each is built and verified; the first that renders wins.
- **Layouts.** Components render at card size and scale down to fit. Blocks (`registry:block`) render on a 1280px canvas that the card scales down (`LivePreview canvas`), laid out like a page; a block narrower or shorter than the canvas is centered (it would otherwise sit in the top-left corner). The quick view adds `?mode=full` so long blocks scroll.
- **Demo assets.** Root-relative asset literals in registry code/CSS (`/media/x.jpg`) are copied once from the library site into `renders/<library>/assets/` and rewritten; runtime-built paths can't be found and stay missing.
- **Verification** runs at those sizes (components 480×360 @2x, blocks 1280×960) and rejects renders that throw, show `NaN`/`undefined`, or are visually empty (`lib/catalog/render-visual.ts`: strong ink below 0.08% *and* faint ink below 2% of the page background). Only those deterministic failures remove an existing item; timeouts and CDN errors keep it.
- **Untrusted input.** Registry names/refs must be plain slugs (`isSafeName`/`isSafeRef`). Registry CSS loses every `@import`/`@plugin`/`@config`/`@source`/`@reference` not resolved from memory (`sanitizeRegistryCss`); Tailwind would otherwise read local files into a published render. Renders are served with `Content-Security-Policy: sandbox …` (next.config locally, a CloudFront response-headers policy in production) and cards never add `allow-same-origin`.
- **Capture vs. extract.** `previews:capture` skips items with a `registry_url` and only replaces its own `image` rows.
- The in-app browser pane blocks iframes; check renders with headless Playwright. Paid registry items are skipped after 5 consecutive 401/403s per item type; icon sets (`icons-*`) are skipped on purpose. List queries never select `code` (Data API 1 MB limit).

## Modal slot

`app/@modal` has only `default.tsx` and the intercepting `(.)items/[slug]`. Don't add null catch-all pages to close the modal: under partial prefetching Next re-prefetches an empty slot segment in a tight loop (we measured ~500 requests/second per open tab). `ItemModal` closes itself when the URL leaves `/items/`.

## Search

`lib/catalog/search.ts` + `db/queries.ts`:

1. Keyword: `ILIKE` + pg_trgm GIN on name/description, plus creator name/handle/slug
2. Creator facet: `creator=shadcn,animate-ui` (multi-select). Counts come from `listCreatorFacets`. Pages: `/creators`, `/creators/[slug]`
3. Hybrid (when `EMBEDDING_PROVIDER` works and `embeddings.text_embedding` is populated): cosine distance over pgvector, same filters applied
4. Stub provider throws `EmbeddingNotConfiguredError` and the query falls back to keyword

Creator inference (`lib/catalog/creators.ts`) prefers GitHub owner / known aliases (shadcn) over the X curator on roundup posts.

## Ingest

`POST /api/ingest` accepts one scrape record, an array, or `{ items, dryRun }`. Send public image URLs (e.g. the post's `pbs.twimg.com` media) in `image_paths`; local paths are ignored by the UI. Never generate placeholder `code`. Production requires `Authorization: Bearer $INGEST_SECRET`. Mapping lives in `lib/catalog/mapping.ts` so the scraper and seed share one path.

## AWS / cost

See `DEPLOY.md`. Zip Lambda (arm64) + CloudFront + S3 static + Aurora Serverless v2 Data API (min 0), no NAT. Host **ui-component-aggregator.com** (`www` → apex). Region **us-east-2**. Estimated **$4–14/mo** at light traffic.

## Commands

- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run db:generate` after schema edits, then `db:migrate`
- Never commit `.env`
