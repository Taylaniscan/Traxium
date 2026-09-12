# Traxium SaaS readiness review and launch plan

Review initiated: 11 September 2026. Updated: 12 September 2026. Source: the current checkout at base commit `59e1f905`, with Work Packages 1 and 2 implemented on `fix/wp1-2-financial-truth` in code commit `6e69d3f`.

## Decision

Traxium is a substantial pre-commercial application with enough functional breadth for a focused procurement/finance pilot. The first financial-consistency engineering batch is complete on a local review branch, but Traxium is not yet demonstrated ready to hold paying customers' operational data and is not ready for an unattended self-service launch. Keep the architecture. Concentrate the remaining work on workspace permissions, truthful close controls, deployed tenant-boundary proof, and recoverable production operation.

The fastest responsible commercial milestone is one founder-supported paid pilot, followed by two more after the first onboarding and reporting cycle succeeds. Begin buyer discovery and controlled demos now; gate live customer onboarding on the release conditions below.

## Evidence and limits

The repository had no `AGENTS.md`, and the checkout began clean on `main` at `59e1f905`. Commit `359bc53` was not present in the object database, so none of its claimed changes were assumed. F01 and F02 were reproduced against the checked-out code before implementation.

Baseline results at `59e1f905`:

- `npm ci`: passed; 671 packages installed from the lockfile.
- `npm run lint`: passed with 0 errors and 37 existing warnings.
- `npm run typecheck`: the first invocation after `npm ci` failed because the Prisma client had not been generated; after `npx prisma generate`, it passed.
- `npm run db:validate`: the unconfigured invocation stopped at the repository's environment guard because `DATABASE_URL` was absent; with structurally valid synthetic local `DATABASE_URL` and `DIRECT_URL` values, the Prisma schema passed validation. No database connection or migration was performed.
- `npm test`: the unconfigured invocation ran 738 tests but failed 9 suites during import because `lib/prisma.ts` received an empty database URL; with the generated client and the same synthetic local URL, all 804 baseline tests passed across 166 files.
- `npm run build`: the sandboxed attempt failed while fetching Figtree from Google Fonts; with network access for that configured public font and synthetic development-only environment values, the optimized Next.js build passed. No provider or production credential was used.

Final code results at `6e69d3f`:

- F01/F02 focused regression suite: 76/76 tests passed across 12 files.
- Full Vitest suite: 815/815 tests passed across 166 files.
- TypeScript: passed.
- ESLint: passed with 0 errors and the same 37 warnings.
- Prisma schema validation: passed with synthetic local connection strings; no database connection or migration was performed.
- CI smoke contract: 4/4 tests passed.
- Optimized Next.js production build: passed with the same existing warnings.
- `git diff --check`: passed.

This is local source/build evidence only. No staging or production deployment, production migration, dependency vulnerability audit, live Playwright run, real email/storage/billing flow, direct Supabase tenant-boundary probe, or backup restoration was performed. Source and local build results cannot establish visual usability, uptime, load performance, or live security configuration.

## Implementation progress — 12 September 2026

Branch: `fix/wp1-2-financial-truth`

Code commit: `6e69d3f` (`fix financial reporting consistency`)

Publication status: local only; not merged or deployed.

Completed in this batch:

- Unified volume timelines, actuals, the saving-card form, reports, and workbook reconciliation on the canonical cost-avoidance basis: reference price minus new price.
- Added Reference Price to controller workbook export/import fields and saving-card import normalization.
- Converted dashboard totals, phase/category breakdowns, top projects, annualized run rate, recent achievements, saving-card register totals, and Kanban values to persisted USD values.
- Recalculated current fiscal-year value against the workspace fiscal year containing the reporting date, including carryover cards and excluding non-overlapping cards.
- Changed volume YTD from calendar-year scope to workspace fiscal-year scope and made the UI label explicit.
- Added distinct Current Fiscal Year Value (USD), Impact-Start Fiscal Year Value (Local), and local/USD annualized run-rate columns to the controller workbook.
- Added regression coverage for hard savings, cost avoidance, mixed currencies, carryover, future/expired windows, non-January fiscal years, partial leap months, malformed windows, reports, and export reconciliation.

## Findings ordered by launch impact

### F01 — Savings calculation disagreement: fixed locally; staging verification remains

Confirmed in the starting checkout: `lib/volume.ts` calculated baseline price minus new price and did not load impact type or reference price, while `lib/calculations.ts`, monthly close, and the workbook actuals path supported the avoided reference price for cost avoidance.

Reproduced case: baseline $10, avoided reference $12, negotiated price $11, quantity 100. The original volume path returned -$100 while canonical actualized savings returned +$100.

Implemented: volume now loads the required cost-avoidance fields and uses `resolveUnitSaving`. The saving-card form/static forecast, imported reference price, volume rows, monthly actuals, reports, and workbook now share the same benefit basis. Remaining gate: reconcile representative hard-saving and cost-avoidance cards across every deployed UI/export surface in staging.

### F02 — Dashboard currency and fiscal-period errors: fixed locally; staging verification remains

Confirmed in the starting checkout: dashboard and report components summed local `calculatedSavings`, `inYearValue`, and `annualizedRunRate` fields while formatting the results as USD. A $100 card plus a €100 card stored at $120 therefore displayed $200 instead of $220. The dashboard also described the sum of impact-start-year values as the current fiscal year, and volume YTD used the calendar year.

Implemented: USD-labelled portfolio values use persisted USD fields. Current fiscal-year value is calculated from the workspace fiscal start month, reporting date, annualized USD value, and each card's impact window. Volume summaries follow the same workspace fiscal calendar. The workbook preserves the historical impact-start-year value under an explicit label while exposing current reporting-year USD value separately. Remaining gate: staging reconciliation against seeded and manually calculated examples.

### F03 — Monthly close is a checklist, not a locked Finance close: confirmed, not changed

`lib/monthly-close.ts` treats actual presence plus no pending phase request as complete. Actual rows have no explicit period approval, lock, reopen, or version history. Do not promise immutable period close. Decide whether the pilot needs truthful "actuals entered/reviewed" wording or a real close-control implementation.

### F04 — Business permissions are global per user: source-confirmed design risk, not changed

The procurement business role remains on `User`, while workspace membership has only OWNER/ADMIN/MEMBER. A person's Finance Controller or procurement-lead role can therefore carry across workspaces. Move business roles to membership or enforce one workspace per identity for the pilot.

### F05 — Direct database/API exposure remains unverified: release gate

Application tenant filters do not prove deployed Supabase Data API, grants, RLS, or private-storage boundaries. Inspect deployed schemas and test anonymous and foreign-tenant access directly before customer data.

### F06 — Billing failure recovery needs hardening and live proof

Webhook deduplication exists, but a persistent processing claim has no recovery lease and distinct out-of-order events can apply stale snapshots. Add recoverable claims and Stripe-state reconciliation, then test interruption, duplicate, delayed, cancellation, failed-payment, and recovery flows.

### F07 — Operational proof is incomplete

Before customer data, prove invitation/reset delivery, evidence upload/download isolation, worker execution and alerts, billing if enabled, database plus evidence-object restore, and complete export/offboarding in a controlled environment.

## Secondary product limits to make explicit

- Actualized savings means entered quantity multiplied by the card's approved unit-saving basis; it is not invoice-price realization or ERP matching.
- ONE_TIME remains a classification while the engine uses annual-volume/run-rate mechanics.
- Decimal database values are converted to JavaScript numbers for arithmetic; rounding policy and tolerances remain a business decision.
- Missing EUR FX rates may fall back to 1.
- Actual quantities accept a free-text unit without conversion against the price basis.
- Export, evidence archive, deletion, and full audit-history offboarding remain partly manual.
- Scale readiness has not been measured.

## Recommended release scope

Use one manufacturing procurement team, one Finance reviewer, one workspace, USD reporting, an agreed fiscal year, and an agreed savings methodology. Demonstrate: create/import initiative → validate assumptions → approve → attach evidence → enter monthly actuals → reconcile dashboard, reports, and workbook.

## Working plan with acceptance gates

| Order | Work package | Status | Pass condition |
|---|---|---|---|
| 1 | Reproducible baseline | Local checks complete; local env/client generation prerequisites documented | Lockfile install, client generation, schema validation, lint/typecheck/tests/build; then staging migrations and controlled test tenants |
| 2 | Financial truth | Code/tests complete on review branch; staging reconciliation pending | F01/F02 fixed; agreed financial scenarios reconcile across card, volume, close, dashboard, reports, and XLSX |
| 3 | Permission and data boundaries | Not started | F04 resolved or pilot restriction enforced; direct API/storage access denied across tenants; revoked users lose access |
| 4 | Close semantics and change history | Not started | Actuals wording is truthful; changes are authorized and audited; true close estimated separately if required |
| 5 | Provider and recovery proof | Not started | Billing recovery if used; invitation/reset delivery; worker/alerts; database plus file restore; export/offboarding rehearsal |
| 6 | Buyer acceptance and pilot launch | Blocked by packages 3–5 | Procurement and Finance complete the core journey; no unresolved blocker; scope/support/price/terms agreed |

## Go/no-go checklist

- [x] Local Work Packages 1 and 2 checks pass for code commit `6e69d3f`.
- [ ] Branch is reviewed, merged, and deployed to staging.
- [ ] No unexplained financial disagreement across deployed product surfaces.
- [ ] Tenant boundaries and workspace business roles are proven.
- [ ] Direct database/API and private-storage access checks pass.
- [ ] Close/actuals claims match implemented controls.
- [ ] Login, invitations, reset, evidence, jobs, and billing-if-used pass in staging.
- [ ] Database and evidence restore succeeds; export/offboarding is executable.
- [ ] Buyer accepts methodology, scope, support, price, and exclusions.
- [ ] Controlled production smoke passes before customer onboarding.

Do not substitute a readiness percentage for these gates. The next milestone is review of this branch, followed by permission/data-boundary work and a finance-reconciled staging exercise.
