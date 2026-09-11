# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Traxium is

Traxium is finance-trusted procurement savings governance for 50–500 employee US manufacturing SMEs. It replaces spreadsheet-based savings tracking with auditable saving cards, an approval workflow, evidence handling, and portfolio reporting. It is a multi-tenant B2B SaaS (Next.js App Router + Prisma/PostgreSQL via Supabase + Stripe billing), currently hardening from internal MVP toward production.

## Commands

```bash
npm run dev              # env:check + prisma generate + next dev
npm run dev:clean        # same, after clearing .next artifacts
npm run build            # clean + env:check + prisma generate + next build
npm run lint             # eslint . --ext .js,.jsx,.ts,.tsx
npm run typecheck        # tsc --noEmit

npm test                 # vitest run (all unit/integration tests)
npx vitest run tests/path/to/file.test.ts        # single test file
npx vitest run -t "test name substring"          # single test by name
npm run test:ci:smoke    # CI smoke contract (release-critical surfaces)
npm run test:e2e         # builds into .next-e2e, then Playwright (port 3100)

npm run db:check         # validate Prisma env wiring (run before any db:* command)
npm run db:migrate       # prisma migrate dev
npm run db:push          # prisma db push
npm run db:status        # prisma migrate status
npm run db:seed          # seed via prisma/seed.ts
npm run db:seed:utopiatrax    # seed the UtopiaTrax demo workspace

npm run jobs:worker          # run the background job worker (long-running)
npm run jobs:worker:once     # drain the queue once and exit
npm run jobs:worker:healthcheck

npm run providers:validate   # env + predeploy + Stripe + Supabase + worker health
npm run release:verify       # predeploy + prisma validate
```

Vitest runs in a Node environment (`tests/**/*.test.ts`), globals are off — import `describe/it/expect/vi` explicitly. `tests/setup.ts` restores/resets mocks after each test.

## Path alias

`@/*` maps to the repo root (configured in `tsconfig.json` and mirrored in `vitest.config.ts`). Import as `@/lib/...`, `@/components/...`.

## Architecture: module ownership (read before editing business logic)

The data layer is intentionally split by domain to reduce regression risk. **Attach new behavior to the owning module — do not expand `lib/data.ts` back into a mixed layer.**

- `lib/workflow.ts` — **canonical** workflow rules: allowed transitions, required approver roles, cancellation requirement, finance-lock eligibility. This is the single source of truth for workflow policy.
- `lib/workflow/service.ts` — phase-change request and approval orchestration (the only path that may advance a card's phase).
- `lib/saving-cards/queries.ts` — saving-card and reference-data reads.
- `lib/saving-cards/mutations.ts` — saving-card and related writes.
- `lib/dashboard/data.ts` — dashboard aggregation.
- `lib/command-center/data.ts` — command-center aggregation.
- `lib/workspace/readiness.ts` — workspace-readiness reads.
- `lib/workspace/portfolio-surface-cache.ts` — cache invalidation for dashboard/readiness surfaces.
- `lib/data.ts` — compatibility facade that re-exports the current surface. Not the primary ownership layer.

## Architecture: the workflow contract (hard invariants)

These are product rules, not UI conventions. Tests enforce them; do not regress them.

- Saving cards use internal `Phase` enum values mapped to display names: `IDEA` (Proposed) → `VALIDATED` (Finance Validated) → `REALISED` (Implemented) → `ACHIEVED` (Captured), plus `CANCELLED` (Canceled).
- New cards start as `IDEA`. The only non-cancel progression is the sequential chain above — **no phase skipping**.
- Any non-canceled phase may move to `CANCELLED`, but **only with a cancellation reason**.
- **Create/edit flows must never write `phase` directly.** All phase changes go through the phase-change request + approval flow in `lib/workflow/service.ts`.
- Do **not** reintroduce the legacy approval model as a parallel path. The phase-change request approval model is the only source of truth.
- Approver requirements by target phase: `VALIDATED` needs Procurement Lead + Finance Reviewer; `REALISED` and `ACHIEVED` need Finance Reviewer.
- Finance lock is allowed only for `VALIDATED` cards; it locks baseline price, new price, annual volume, currency, and impact dates.
- Kanban groups cards by **persisted** `savingCard.phase`. Pending phase-change requests are rendered as metadata only — they must not relocate the card to the destination column. Invalid transitions must not be offered as moves; rejected/blocked moves must show visible feedback.

Savings formula: `Savings = (Baseline Price − New Price) × Annual Volume`. Baseline = last purchasing-order price. Supports EUR and USD with FX conversion (`lib/volume.ts`, `lib/calculations.ts`, `FxRate` model).

## Architecture: multi-tenancy & auth

- **Tenant isolation** runs through `lib/tenant-scope.ts` — `buildTenantScopeWhere` / `buildTenantOwnedRelationWhere` inject `organizationId` into Prisma `where` clauses. Tenant queries must be scoped through these helpers, not hand-rolled.
- **Auth** is Supabase Auth. `middleware.ts` → `lib/supabase/middleware.ts` refreshes the session on every non-asset request. Server-side guards and the authenticated user shape live in `lib/auth.ts`; permission checks in `lib/permissions.ts` map `Role` → `AppPermission[]`.
- A user belongs to an `Organization` via `OrganizationMembership`; `activeOrganizationId` selects the current workspace.

## Architecture: surrounding systems

- **Billing** (`lib/billing/*`): Stripe products/prices, checkout, customer portal, webhooks, and access gating. `Subscription`/`BillingCustomer`/`WebhookEvent` models; usage metering via `UsageEvent`/`UsageCounter`/`QuotaSnapshot`. Routes under `app/billing*` and `app/api/billing`. Unauthorized/unsubscribed users are routed to `/billing-required`.
- **Background jobs** (`lib/jobs.ts`, `lib/job-runner.ts`, `scripts/run-job-worker.ts`): a DB-backed `Job` queue (email delivery, analytics, etc.) drained by the worker. Payloads are sanitized for logs.
- **Evidence storage**: files upload through app routes into a **private** Supabase Storage bucket (`evidence-private`); the DB stores storage metadata, not public URLs; downloads use short-lived signed links.
- **Pilot lead capture**: public `/pilot` route stores rate-limited, honeypot-protected `PilotLead` rows. It does **not** create a user, workspace, trial, or subscription. Public `/trust` summarizes security posture.
- Observability via Sentry (`sentry.*.config.ts`, `instrumentation*.ts`). Rate limiting in `lib/rate-limit.ts` (`RateLimitBucket`).

## Routing layout

- `app/(app)/` — authenticated product surfaces: dashboard, saving-cards, kanban, timeline, command-center, open-actions, reports, admin, profile.
- `app/api/` — route handlers per domain (saving-cards, approve-phase-change, phase-change-request, billing, evidence, import/export, invitations, onboarding, organizations, pilot-leads, etc.).
- Public/auth routes: `login`, `forgot-password`, `reset-password`, `invite`, `onboarding`, `pilot`, `request-demo`, `trust`, `billing`, `billing-required`.

## Database / Prisma (Supabase)

- Use the Supabase **session pooler on port 5432** for local Prisma dev. Set `DATABASE_URL` (runtime) and `DIRECT_URL` (migrations) — keep them equal locally. Always append `sslmode=require&connect_timeout=30`. If using the transaction pooler on 6543, add `pgbouncer=true&connection_limit=1`. Do **not** set `NODE_ENV` in `.env` (Next.js manages it).
- Always run `npm run db:check` before any `db:*` command.
- Committed baseline migration is `20260323200000_init` (matches the live pre-invitation schema); first incremental after it is `20260324204000_add_invitations`. For an existing populated DB, mark the baseline applied with `npm run db:baseline` rather than re-running baseline SQL, then `prisma migrate dev` normally. Do not replace the committed init with a full-schema snapshot unless intentionally squashing.

## Release-critical surfaces

**Dashboard and Kanban are deploy-critical.** Any change touching workflow, saving cards, caching, dashboard metrics, or Kanban rendering must keep these aligned: `npm run test:ci:smoke`, and the docs `docs/release-checklist.md`, `docs/post-release-smoke-tests.md`, `docs/runtime-baseline.md`. Dashboard charts must render whenever valid data exists; partial/malformed data should be normalized or ignored, never collapse the whole surface.

## Conventions

- US procurement terminology is a product contract — see `docs/us-terminology-contract.md` and `docs/procurement-savings-classification.md` before changing user-facing labels or classification fields.
- When behavior changes intentionally, update the relevant `docs/*` contract and its tests in the same change.
- UI uses shadcn/ui (`components.json`, `components/ui`), Tailwind v4, Radix primitives, Recharts (dashboards), dnd-kit (Kanban), and `xlsx` (Excel import/export). Validate inputs with Zod.
