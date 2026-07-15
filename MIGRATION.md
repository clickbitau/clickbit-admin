# ClickBit Staged Migration Plan

This document describes how we will migrate the legacy ClickBit platform to the new `clickbit-staged` monorepo using a strangler-fig approach.

## Core rule: contract preservation

The NestJS API in `apps/api` must expose the **same routes under the same base path (`/api/*`)** and return the **same JSON response envelopes and status codes** as the legacy Express routes in `clickbit/server/routes/`. The React Native mobile app (`mobile/lib/api.ts`) and the legacy CRA web client (`client/src/services/api.ts`) consume these contracts, so breaking them would break the existing apps during the transition.

- Do **not** rename fields, change pagination shapes, or alter HTTP status codes for migrated endpoints.
- If a legacy response is ambiguous, treat the existing clickbit test suite and the actual production responses as the source of truth.
- New code in `apps/web` may add computed fields (e.g., `effective_email`) as long as the legacy fields it depends on remain unchanged.

## Reverse-proxy / router cutover plan

Both the legacy clickbit Express server and the new Nest API will be deployed behind the existing `click-deploy` / dockbit router. The router will use path-based rules:

```
/api/crm/companies    -> new Nest API (already migrated)
/api/crm/*            -> new Nest API as each CRM route is ported
/api/auth/me          -> new Nest API when auth routes are ported
/api/invoices/*       -> legacy until ported, then new Nest API
...
/api/*                -> default to legacy until explicitly migrated
/*                    -> legacy clickbit Express (serves existing web client and public pages)
```

Deployment order:

1. Deploy the Nest API alongside the legacy server (different internal host/port).
2. Add a router rule that sends a single migrated path (e.g., `/api/crm/companies`) to the Nest API.
3. Verify the legacy web and mobile clients continue to work through the router.
4. Repeat for each module until the legacy API can be decommissioned.

## Per-module porting recipe (proven by CRM)

Use this exact sequence for each module. CRM has proved the flow and the contract-test guardrail.

1. **Endpoint parity checklist**
   - Extract every route from the legacy Express file (`server/routes/<domain>.js`).
   - Record method, path, auth roles, response envelope keys, success/error status codes, and whether each route is `Implemented` / `Missing` / `Partial` (see `PARITY.md` for CRM).
   - Resolve ambiguous envelopes by running the legacy route or inspecting its response handlers.

2. **NestJS module**
   - Create `apps/api/src/<domain>/<domain>.module.ts`.
   - Add controllers under `@Controller('<domain>')` with the legacy route paths and `@Get/@Post/@Put/@Delete` methods.
   - Apply `SupabaseAuthGuard`, `RolesGuard`, and `@Roles(...)` to match legacy `protect` + `authorize()`.
   - Implement services against the same Supabase Postgres via `PrismaService`; keep column/JSON field names identical.
   - Preserve pagination shapes exactly (`currentPage/totalPages/totalItems/itemsPerPage` or the contacts `total/limit/offset`).

3. **shadcn pages**
   - In `apps/web`, mirror the existing `/crm/companies` page structure (data table, filter chips, sort controls, create/edit dialogs).
   - Use `@clickbit/shared` DTO/response types for type-safe TanStack Query hooks.
   - Re-use the shadcn/ui components installed in `apps/web/components/ui` to keep visual parity with the legacy admin UI.

4. **Contract test**
   - Add `apps/api/test/<domain>.contract.spec.ts` or `apps/api/src/<domain>/<domain>.contract.spec.ts`.
   - Mock `PrismaService` if a live database is unavailable.
   - Assert that each ported endpoint returns the legacy response envelope and the correct HTTP status.
   - Run `pnpm --filter @clickbit/api typecheck` and `pnpm --filter @clickbit/api test` before the router rule is flipped.

## Module porting order

The new porting order is:

1. **auth / users**
   - `SupabaseAuthGuard` and `@Roles()` decorator (done).
   - Port `/api/auth/me`, `/api/auth/login`, logout/session routes.
   - Service tokens (`cb_*`) can be migrated later.
   - `users` (profiles, roles, settings) is co-ported with auth.

2. **crm** *(in progress)*
   - `GET /api/crm/companies` is done.
   - `/api/crm/companies/:id`, `/api/crm/contacts`, `/api/crm/deals`, `/api/crm/pipelines`, `/api/crm/leads`, `/api/crm/projects`, `/api/crm/subprojects`, `/api/crm/activities`, `/api/crm/notes`, `/api/crm/meetings`, `/api/crm/automations` remain.
   - Preserve computed fields (`total_revenue`, `total_deals`, `total_projects`, `total_tasks`) and `aggregatedStats`.

3. **finance** (invoices / payments / expenses)
   - `/api/invoices/*`, `/api/payments/*`, `/api/expenses/*`.
   - These feed the CRM totals, so ensure the value aggregation logic stays consistent with `crm/companies`.

4. **hr**
   - `/api/hr/*` (employees, time-clock, time-off, payslips, contracts, shifts, courses, announcements).

5. **support / tickets**
   - `/api/tickets/*`, `/api/ticket-automation/*`, `/api/bug-reports/*`.

6. **communication** (mail / messages / chat)
   - `/api/mail/*`, `/api/messages/*`, `/api/chat/*`.

7. **content / marketing**
   - `/api/blog/*`, `/api/marketing-posts/*`, `/api/portfolio/*`, `/api/reviews/*`, `/api/public-content/*`.

8. **settings / admin**
   - `/api/settings/*`, `/api/admin/*`, `/api/admin/audit-logs/*`.

## Background-worker services

The legacy clickbit server runs several background services and cron-like schedulers that must move into the `apps/api` worker process so the Nest API can fully replace the Express server. Port them in this order, re-implementing each as a Nest `@nestjs/schedule` cron interval, a dedicated worker service, or an `apps/api` background script:

- `mailSyncWorker` — email inbox polling and thread creation.
- `payrollScheduler` / `payrollReminderScheduler` — payslip generation and payday reminders.
- `reminderScheduler` — activity/task due reminders.
- `recurringTaskScheduler` — recurring task instance creation.
- `shiftScheduler` / `attendanceScheduler` — roster generation and attendance reconciliation.
- `blogScheduler` — scheduled content publishing.
- `analyticsAlerts` — threshold-based analytics notifications.
- `announcementAutomationService` — scheduled/targeted announcement distribution.

## Frontend migration order

Inside `apps/web`:

1. Auth gate / token entry.
2. Admin CRM pages starting with the Companies list (done).
3. Admin CRM detail/edit pages.
4. Dashboard and remaining admin modules in the same order as the API.

The public/marketing site and any Three.js pages stay in the legacy `clickbit/client` during the transition.

## Database and schema

- The new API reads and writes the **same** hosted Supabase Postgres via the same `DATABASE_URL`.
- Use `prisma db pull` to refresh the introspected schema. Do not create Prisma migrations that alter the live schema as part of this migration.
- The legacy Sequelize migrations in `clickbit/migrations/` remain the source of truth for schema changes until we are ready to switch to a Prisma migration strategy.

## Environment variables

All required variables are documented in `.env.example`. Key values are the same as `clickbit/env.example`:

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres
- `REDIS_URL` — shared cache/rate-limit/cron-lock state
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` — legacy custom JWT secret
- `DB_POOL_*` — connection pool tuning

## Shared packages

`packages/shared` contains the TypeScript contracts (types and DTOs) that both `apps/api` and `apps/web` import. When a module is migrated:

1. Add the response types and query DTOs to `packages/shared`.
2. Use them in the Nest controller/service.
3. Use them in the Next.js page/components for type-safe TanStack Query calls.

## Per-module porting recipe (proven by CRM)

1. **Endpoint parity checklist** — inventory every route in the legacy Express file (`server/routes/<module>.js`) and compare it to `apps/api/src/<module>/`. Mark each route as implemented/missing/partial and confirm response envelopes (data shape, pagination `{totalItems,totalPages}`, and any `aggregatedStats`).
2. **NestJS module** — for each missing endpoint add a controller/service pair that:
   - reuses `SupabaseAuthGuard` + `RolesGuard` + `@Roles('admin','manager')`;
   - validates query/body with `class-validator` DTOs;
   - returns the same JSON envelope and status codes as the legacy route;
   - uses Prisma raw queries or ORM calls matching the legacy business logic.
3. **Shared contracts** — add response types and DTOs to `packages/shared` so both `apps/api` and `apps/web` consume the same contract.
4. **shadcn pages** — in `apps/web/src/app/admin/<module>/` build list, detail, create/edit modal, and stat-card pages using TanStack Query and the existing token-based `api.ts` client. Add generic reusable shadcn primitives under `apps/web/src/components/ui/` and a design-system layer under `apps/web/src/components/design-system/` (DataTable, FormDialog, StatCards) for later modules.
5. **Contract test** — add a Jest contract test for the module's list and detail endpoints asserting the legacy response envelope (e.g. `apps/api/test/<module>.contract.spec.ts`). Mock Prisma where a live DB is unavailable, otherwise verify against live Supabase.
6. **Router cutover** — once `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass, update the `click-deploy` router to send the migrated `/api/<module>/*` prefix to the Nest API and smoke-test the legacy clients.

## Remaining module order

The recommended migration order after auth/CRM is:

1. **auth/users** — port `/api/auth/me`, login/logout/session routes, user management.
2. **finance (invoices / payments / expenses)** — `/api/invoices/*`, `/api/payments/*`, `/api/expenses/*`, `/api/staff-advances/*`.
3. **hr** — `/api/hr/*` (employees, time-clock, time-off, payslips, contracts, shifts, courses, announcements).
4. **support / tickets** — `/api/tickets/*`, `/api/ticket-automation/*`.
5. **communication (mail / messages / chat)** — `/api/mail/*`, `/api/messages/*`, `/api/chat/*`.
6. **content / marketing** — `/api/blog/*`, `/api/marketing-posts/*`, `/api/portfolio/*`, `/api/reviews/*`, `/api/team/*`, `/api/public/*`.
7. **settings / admin** — `/api/settings/*`, `/api/admin/*`, `/api/admin/audit-logs/*`, `/api/credentials/*`.

## Background-worker services to migrate

The following recurring/background jobs currently live in the legacy Express process and must move into the `apps/api` worker process (or a dedicated NestJS worker) so the admin API remains stateless:

- `mailSyncWorker` (IMAP sync and inbound email processing)
- Payroll/scheduling workers: `payrollScheduler`, `reminderScheduler`, `recurringTaskScheduler`, `shiftScheduler`, `attendanceScheduler`
- `blogScheduler` (scheduled publishing)
- `analyticsAlerts`
- `announcementAutomationService`

Run these as NestJS `@Cron` / `@Interval` jobs or as a separate `apps/worker` process that shares `packages/shared` and the Prisma client.

## Validation checklist per module

Before flipping the router rule for a migrated endpoint:

- [ ] Route path matches the legacy Express route exactly.
- [ ] Auth guard and `@Roles()` produce the same 401/403 behavior.
- [ ] Request query/body validation accepts the same inputs.
- [ ] Response JSON shape matches the legacy envelope.
- [ ] Status codes match (200, 201, 400, 401, 403, 404, 500).
- [ ] End-to-end verified against live Supabase data.
- [ ] Legacy web and mobile clients still work through the router.
