# clickbit-staged

Staged migration monorepo for the ClickBit backend and admin frontend.

This repo uses a [strangler-fig](https://martinfowler.com/bliki/StranglerFigPattern.html) approach: the new NestJS API and Next.js admin app are built alongside the legacy Express/CRA system, and routes are migrated module-by-module behind a reverse-proxy/router.

## Structure

```
clickbit-staged/
├── apps/
│   ├── api/          # NestJS REST API (replacement for clickbit/server)
│   └── web/          # Next.js 14 App Router admin frontend (replacement for clickbit/client admin)
├── packages/
│   └── shared/       # Shared TypeScript types and DTOs used by api and web
├── prisma/           # (inside apps/api) Prisma schema introspected from Supabase Postgres
├── .env.example      # Documented environment variables
├── MIGRATION.md      # Porting order and reverse-proxy plan
└── turbo.json        # Turborepo task graph
```

## Tech stack

| Layer | Stack |
|-------|-------|
| API | NestJS 10, Prisma, Supabase Auth, ioredis, class-validator/class-transformer |
| Admin Web | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Shared | TypeScript package with DTOs and response types |
| Package manager | pnpm 9 workspaces + Turborepo |

## Getting started

1. Install the repo-specified Node version (see `.nvmrc`) and pnpm 9.15.0+.
2. Copy `.env.example` to `.env` and fill in the live Supabase values (the same `DATABASE_URL`, `SUPABASE_*`, and `JWT_SECRET` used by the legacy clickbit app).
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Generate the Prisma client from the introspected schema:

   ```bash
   pnpm db:generate
   ```

   If the live schema has changed, re-run introspection (read-only — no migrations are applied):

   ```bash
   pnpm db:pull
   ```

5. Build the shared package and the API:

   ```bash
   pnpm --filter @clickbit/shared build
   pnpm --filter @clickbit/api build
   ```

6. Start the API and the web app:

   ```bash
   pnpm --filter @clickbit/api start
   pnpm --filter @clickbit/web dev
   ```

   The API runs on `http://localhost:5001` with the global prefix `/api`.  
   The web app runs on `http://localhost:3001`.

## Monorepo commands

```bash
pnpm build        # Build all apps and packages
pnpm dev          # Start all dev servers (Turborepo)
pnpm typecheck    # TypeScript check across the repo
pnpm lint         # Run lint across the repo
pnpm test         # Run tests across the repo
pnpm db:pull      # Introspect the live Supabase Postgres schema
pnpm db:generate  # Regenerate the Prisma client
pnpm db:studio    # Open Prisma Studio
```

## Proof of concept

This first slice ships:

- A contract-preserving `SupabaseAuthGuard` plus a `@Roles()`/`RolesGuard` equivalent to the legacy `authorize('admin','manager')` middleware.
- `GET /api/crm/companies` returning the same JSON envelope as the legacy Express route (including `companies`, `pagination`, and optional `aggregatedStats`).
- A Next.js admin Companies page at `/admin/crm/companies` using shadcn Table + TanStack Query to call the new endpoint with a Bearer token.

The migrated endpoint has been verified against the live Supabase Postgres data.

## Strangler-fig routing plan

See [MIGRATION.md](./MIGRATION.md) for the incremental cutover plan and per-module porting order.

## Notes

- No database migrations are included. Prisma is only used to introspect the existing live schema.
- `Three.js` is intentionally kept out of `apps/web`; it remains in the legacy marketing/public pages.
- All secrets live in `.env` / `.env.local`. `.env.example` documents the required keys without real values.
