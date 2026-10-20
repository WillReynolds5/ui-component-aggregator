# component-library

Follow `AGENTS.md`. This is a Next.js 16 App Router catalog (TypeScript, Tailwind, shadcn/ui, Drizzle, Postgres + pgvector). No auth.

Production host is **ui-component-aggregator.com** (`www.ui-component-aggregator.com` redirects to apex). Deploy from the Mac with profile `personal` in **us-east-2** — see `DEPLOY.md`. Local app port is **4321**. Local Postgres is **5433**.

After schema changes: `npm run db:generate` then `db:migrate`. Seed with `npm run db:seed`. Production: `npm run db:migrate:dataapi` and `npm run db:seed:dataapi`.
