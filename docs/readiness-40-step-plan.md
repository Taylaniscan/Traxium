# Traxium 40-Step Paid-Pilot Readiness Plan

Status: plan only. No implementation step has started.

Prepared after repository inspection on 2026-06-01 for Traxium, a finance-trusted procurement savings governance platform for US manufacturing and industrial SMEs.

## Execution Rule

Codex must not continue automatically. For each approved step, inspect the relevant code first, explain the objective, identify files/routes/tests, implement only that step, run targeted proof, update `docs/readiness-proof-log.md`, report pass/fail, and stop.

Continue only when the user says: `Continue to step X`.

## Short Audit Summary

### 1. What Looks Strong

- The repo is already a serious internal MVP: Next.js App Router, Prisma, Supabase Auth/Storage, Stripe billing, onboarding, admin members/settings/jobs/insights, command center, dashboard, Kanban, timeline, reports, import/export, evidence, workflow, jobs, telemetry, and broad Vitest coverage are present.
- The Prisma model is procurement-specific rather than generic CRM: saving cards include saving type, baseline/new price, annual volume, currency, frequency, impact dates, finance lock, alternatives, evidence, approval requests, phase history, forecasts, and actuals.
- Billing has been moved out of the main sidebar. `components/layout/app-shell-client.tsx` only shows Dashboard, Saving Cards, Kanban, Timeline, Command Center, Reports, Settings, and Open Actions.
- Workspace Settings includes billing through `WorkspaceBillingSettingsCard`, and `BillingRecoveryForm` posts to `/billing/recover`.
- UtopiaTrax is a strong demo asset: 25 saving cards, 6 direct categories, realistic phase distribution, users/roles, evidence, alternatives, finance locks, forecasts/actuals, and billing trial records are represented and tested.

### 2. What Looks Risky Or Incomplete

- The product has many SaaS primitives, but paid-pilot readiness depends on proving they work together in real provider environments, not just that the code exists.
- Saving-card workbook import stops on the first invalid row; master-data import has row-level results, but saving-card import does not yet.
- Reports master-data import exposes buyers, suppliers, and materials, while the API and onboarding support categories too.
- Customer-facing terminology still shows `Realised` and `Cancelled`; US buyer-facing labels should become `Realized` or `Implemented`, and `Canceled`, without risky enum changes.
- Current root marketing is simple and not yet a paid-pilot buying experience for US manufacturing SMEs. Security/trust, pricing hypothesis, support expectations, and demo script need definition.

### 3. What Must Be Proven Before Paid Pilots

- Tenant isolation and RBAC across saving cards, evidence, imports, exports, members, settings, billing, reports, and workflow.
- Stripe checkout, portal, webhook, and recovery behavior across `active`, `trialing`, `past_due`, `unpaid`, `canceled`, `no_subscription`, `incomplete`, and `incomplete_expired`.
- Auth lifecycle: login, logout, active organization bootstrap, invitations, invite acceptance, password reset, and change password.
- Evidence lifecycle: upload to private storage, tenant-scoped metadata, signed download, cross-tenant rejection, and provider-level private bucket behavior.
- UtopiaTrax can reliably seed and populate dashboards, reports, command center, open actions, evidence, and demo workflows in a staging-like environment.

### 4. What Should Not Be Overbuilt Yet

- Do not build enterprise procurement suite features such as ERP connectors, SSO/SAML, complex approval builders, contract lifecycle management, vendor risk scoring, spend analytics, or multi-currency treasury-grade controls before first paid pilots.
- Do not rename database enums just to fix US labels; prefer presentation-layer labels until a migration is proven necessary.
- Do not invent custom payment forms; keep Stripe Checkout and Portal as the trusted payment surface.
- Do not make master data a blocking prerequisite for first value. It should help, not stop, the first saving card.
- Do not over-polish marketing pages before trust-critical flows, activation, billing, and evidence are proven.

### 5. Biggest Trust Gaps By Reviewer

- CFO: needs proof that savings are finance-validated, evidence-backed, exportable, and not inflated by weak phase or forecast logic.
- Procurement manager: needs proof that buyers can create cards quickly, assign ownership, move work through approvals, and see open actions without Excel.
- Finance controller: needs proof that baseline/new price, annual volume, currency, impact dates, finance lock, evidence, and approval history are auditable.
- IT reviewer: needs proof of tenant isolation, private evidence storage, RBAC, auth recovery, provider configuration, environment separation, rate limits, logs, and data export.

## Phase 1: Baseline Audit And Release Safety, Steps 1-5

### Step 1

- Step number: 1
- Step title: Establish release baseline and proof discipline
- Why it matters: Paid pilots need a known starting point before product changes begin.
- Main files/routes to inspect: `package.json`, `README.md`, `Project_Rules.md`, `Codex_Tasks.md`, `docs/runtime-baseline.md`, `docs/release-checklist.md`, `.github/workflows/ci.yml`, `tests/ci/*`, current git status.
- Implementation scope: Run baseline checks, capture branch/commit/dirty files, identify command blockers, and update `docs/readiness-proof-log.md`.
- Testing/proof required: `npm run env:check`, `npm run typecheck`, `npm run test:ci:smoke`; run broader tests only if env allows.
- Pass/fail criteria: Pass if the baseline is recorded with explicit pass/fail command results and no ambiguous status.
- Risk level: Low.
- Expected Codex output after completion: Baseline proof-log entry, command summary, blocker list, and safe next-step recommendation.

### Step 2

- Step number: 2
- Step title: Verify environment, CI, and provider contract
- Why it matters: Stripe, Supabase, database, auth redirects, storage, jobs, and deployment checks must fail clearly before buyers touch the product.
- Main files/routes to inspect: `.env.example`, `docs/environment-setup.md`, `scripts/check-env.ts`, `scripts/predeploy-check.ts`, `lib/env.ts`, `lib/billing/config.ts`, `.github/workflows/ci.yml`.
- Implementation scope: Align docs and validators only where drift is found; do not hardcode secrets or provider IDs.
- Testing/proof required: `npm run env:check`; targeted env tests such as `vitest run tests/lib/env-config.test.ts tests/lib/stripe-config.test.ts tests/ci/deploy-guard.test.ts`.
- Pass/fail criteria: Pass if required variables, client-exposed variables, Stripe mode safety, and preview/production separation are all explicit and tested.
- Risk level: Medium.
- Expected Codex output after completion: Provider contract checklist, any doc/validator changes, and exact deploy variables required.

### Step 3

- Step number: 3
- Step title: Confirm tenant isolation and RBAC baseline
- Why it matters: Multi-tenant trust is non-negotiable for CFO and IT review.
- Main files/routes to inspect: `lib/tenant-scope.ts`, `lib/auth.ts`, `lib/organizations.ts`, `lib/permissions.ts`, `app/api/*`, `app/(app)/*`, `tests/api/tenant-*`, `tests/api/admin-rbac.test.ts`, `tests/api/storage-tenant-access.test.ts`.
- Implementation scope: Add focused tests or small guard fixes only where a concrete tenant/RBAC gap is found.
- Testing/proof required: `vitest run tests/api/tenant-isolation-queries.test.ts tests/api/tenant-scope-mutations.test.ts tests/lib/tenant-scope.test.ts tests/api/storage-tenant-access.test.ts tests/api/admin-rbac.test.ts`.
- Pass/fail criteria: Pass if cross-tenant reads/writes are rejected and Owner/Admin/Member boundaries hold for settings, members, billing, saving cards, evidence, imports, exports, and workflow.
- Risk level: High.
- Expected Codex output after completion: Tenant isolation proof matrix and any guard/test patch.

### Step 4

- Step number: 4
- Step title: Validate build, Prisma, and release safety
- Why it matters: A paid-pilot release must be deployable, not just demoable locally.
- Main files/routes to inspect: `package.json`, `prisma/schema.prisma`, `prisma/migrations/*`, `scripts/predeploy-check.ts`, `scripts/postdeploy-smoke.ts`, `docs/post-release-smoke-tests.md`, `docs/release-checklist.md`.
- Implementation scope: Fix release-script or doc drift only if found; do not weaken checks to make them pass.
- Testing/proof required: `npm run db:validate`, `npm run typecheck`, `vitest run tests/ci/smoke-contract.test.ts tests/ci/release-safety-consistency.test.ts`; `npm run build` when env supports it.
- Pass/fail criteria: Pass if Prisma validation, smoke contracts, typecheck, and release docs agree on the deploy contract.
- Risk level: Medium.
- Expected Codex output after completion: Release safety proof and remaining deploy blockers.

### Step 5

- Step number: 5
- Step title: Map and fix safe US presentation terminology
- Why it matters: US manufacturing SMEs expect familiar terminology and will notice British spelling in core workflow states.
- Main files/routes to inspect: `lib/constants.ts`, `lib/workflow.ts`, `components/ui/phase-badge.tsx`, dashboard, Kanban, reports, command center, saving-card detail/form/table, tests using `Realised`, `Cancelled`, `REALISED`, or `CANCELLED`.
- Implementation scope: Create a terminology map and apply safe presentation-layer label changes only; avoid Prisma enum/database migrations unless later approved.
- Testing/proof required: `rg "Realised|Cancelled|Canceled|REALISED|CANCELLED"` and targeted component/app tests for changed labels.
- Pass/fail criteria: Pass if customer-facing labels show US terminology while internal enum behavior remains stable.
- Risk level: Medium.
- Expected Codex output after completion: US label decision record, files changed, tests run, and any remaining internal-only enum references.

## Phase 2: Core SaaS Trust And Broken-Flow Fixes, Steps 6-12

### Step 6

- Step number: 6
- Step title: Validate billing visibility and recovery entry point
- Why it matters: Billing must be discoverable to authorized admins without cluttering the main product sidebar.
- Main files/routes to inspect: `components/layout/app-shell-client.tsx`, `app/(app)/admin/settings/page.tsx`, `components/billing/workspace-billing-settings-card.tsx`, `components/billing/billing-recovery-form.tsx`, `app/settings/billing/page.tsx`, `app/billing/recover/route.ts`.
- Implementation scope: Ensure Manage Billing appears only in Workspace Settings and billing detail surfaces for Owner/Admin, not in the main sidebar, and posts to `/billing/recover`.
- Testing/proof required: `vitest run tests/app/admin-pages.test.ts tests/app/settings-billing.page.test.ts tests/components/app-shell-client.test.ts tests/components/workspace-billing-settings-card.test.ts tests/api/billing-recover.route.test.ts`.
- Pass/fail criteria: Pass if Owner/Admin can manage billing, Members cannot, sidebar has no Billing item, and active/trialing paid subscriptions open Stripe Portal through recovery.
- Risk level: High.
- Expected Codex output after completion: Billing visibility proof, exact routes manually verified, and any focused fixes.

### Step 7

- Step number: 7
- Step title: Prove Stripe checkout, portal, webhook, and recovery state matrix
- Why it matters: Subscription states must route predictably during trials, payment failures, cancellation, and recovery.
- Main files/routes to inspect: `lib/billing/access.ts`, `lib/billing/checkout.ts`, `lib/billing/webhooks.ts`, `lib/billing/config.ts`, `app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/billing/webhook/route.ts`, `app/billing/recover/route.ts`, `app/billing-required/page.tsx`.
- Implementation scope: Validate and fix state routing for checkout, portal, webhook sync, recovery, and missing subscription cases.
- Testing/proof required: `vitest run tests/api/billing-checkout.test.ts tests/api/billing-recover.route.test.ts tests/api/stripe-webhook.test.ts tests/lib/billing-access.test.ts tests/integration/subscription-gating-regression.test.ts tests/lib/stripe-billing-safety.test.ts`.
- Pass/fail criteria: Pass if `active` and real `trialing` open Portal; workspace trial, placeholder trialing, no subscription, incomplete, and incomplete expired go to Checkout; `past_due`, `unpaid`, and `canceled` recover deterministically.
- Risk level: High.
- Expected Codex output after completion: Stripe state matrix, webhook sync proof, and any code/test changes.

### Step 8

- Step number: 8
- Step title: Validate subscription gating and trial lifecycle
- Why it matters: First-value access must survive the trial window while blocked states remain enforceable.
- Main files/routes to inspect: `lib/auth.ts`, `lib/billing/access.ts`, `app/billing-required/page.tsx`, `app/settings/billing/page.tsx`, `app/auth/bootstrap/page.tsx`, middleware, protected app routes.
- Implementation scope: Fix trial/gating contradictions and blocked-state messaging without removing subscription gates.
- Testing/proof required: `vitest run tests/lib/auth-guards.test.ts tests/lib/billing-access.test.ts tests/integration/subscription-gating-regression.test.ts tests/app/billing-required.page.test.ts`.
- Pass/fail criteria: Pass if new workspace trial, active workspace trial, expired trial, active subscription, and blocked subscription have deterministic app/API behavior.
- Risk level: High.
- Expected Codex output after completion: Trial lifecycle proof and exact blocked/allowed routes.

### Step 9

- Step number: 9
- Step title: Validate login, logout, bootstrap, and active organization resilience
- Why it matters: Pilot users lose trust quickly if sign-in or workspace selection feels brittle.
- Main files/routes to inspect: `app/api/auth/login/route.ts`, `app/auth/bootstrap/page.tsx`, `app/api/auth/bootstrap/route.ts`, `app/logout/route.ts`, `lib/auth.ts`, `lib/auth-navigation.ts`, `app/page.tsx`, `middleware.ts`.
- Implementation scope: Fix concrete auth routing, bootstrap, redirect, or transient DB resilience issues.
- Testing/proof required: `vitest run tests/api/auth.login.route.test.ts tests/api/auth.bootstrap.route.test.ts tests/app/login.page.test.ts tests/app/logout.route.test.ts tests/app/auth-bootstrap.page.test.ts tests/lib/auth-navigation.test.ts tests/lib/auth-guards.test.ts`.
- Pass/fail criteria: Pass if provisioned users, new users, no-org users, invite continuations, billing-blocked users, and logout all resolve predictably.
- Risk level: High.
- Expected Codex output after completion: Auth flow proof and any route/guard fixes.

### Step 10

- Step number: 10
- Step title: Validate invite email, resend, and invite acceptance
- Why it matters: Procurement and finance pilots need fast teammate activation.
- Main files/routes to inspect: `app/api/invitations/route.ts`, `app/api/admin/invitations/[invitationId]/resend/route.ts`, `app/api/invitations/[token]/accept/route.ts`, `app/api/invitations/[token]/complete/route.ts`, `app/invite/[token]/page.tsx`, `components/invitations/invitation-flow.tsx`, `lib/invitations.ts`, `lib/invited-account.ts`, `lib/auth-email.ts`, jobs.
- Implementation scope: Fix invitation creation, delivery, acceptance, account setup, wrong-account handling, role assignment, active organization bootstrap, quota, and audit gaps.
- Testing/proof required: `vitest run tests/api/invitations.test.ts tests/api/invitation-acceptance.test.ts tests/api/invitation-account-setup.test.ts tests/app/invite.page.test.ts tests/lib/jobs.test.ts`.
- Pass/fail criteria: Pass if create, resend, complete setup, accept existing user, expired/revoked, and wrong-account paths are safe and understandable.
- Risk level: Medium.
- Expected Codex output after completion: Invite lifecycle proof and any focused fixes.

### Step 11

- Step number: 11
- Step title: Validate password reset and change password
- Why it matters: Paid pilots need self-service recovery before support load grows.
- Main files/routes to inspect: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `components/auth/forgot-password-form.tsx`, `components/auth/reset-password-form.tsx`, `components/profile/change-password-form.tsx`, `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `app/api/auth/change-password/route.ts`, `lib/passwords.ts`, `lib/auth-email.ts`.
- Implementation scope: Fix broken reset/change flows, rate-limit issues, password policy mismatch, or unclear recovery errors only.
- Testing/proof required: `vitest run tests/api/password-recovery.test.ts tests/api/change-password.test.ts tests/components/auth-recovery-and-loading-ui.test.ts`.
- Pass/fail criteria: Pass if forgot password queues delivery, reset validates an active recovery session, change password verifies current credentials, and invalid states fail safely.
- Risk level: Medium.
- Expected Codex output after completion: Password-flow proof and any copy/error fixes.

### Step 12

- Step number: 12
- Step title: Harden trust-critical error, loading, and empty states
- Why it matters: Provider outages and sparse data should produce useful guidance, not blank screens or raw errors.
- Main files/routes to inspect: `app/error.tsx`, `app/global-error.tsx`, route loading files, dashboard, Kanban, reports, command center, open actions, billing, onboarding, evidence, import/export, auth forms.
- Implementation scope: Add focused fallback states only on high-value trust routes.
- Testing/proof required: Existing app/component tests plus targeted tests for any changed fallback.
- Pass/fail criteria: Pass if trust-critical routes render actionable messages for missing data, failed loaders, provider failures, and blocked states.
- Risk level: Medium.
- Expected Codex output after completion: Error-state proof with routes/screens to manually verify.

## Phase 3: First-Value Onboarding And Saving-Card Activation, Steps 13-18

### Step 13

- Step number: 13
- Step title: Prove first saving card in under 10 minutes
- Why it matters: First value is the fastest path from trial signup to procurement-manager confidence.
- Main files/routes to inspect: `app/onboarding/page.tsx`, `components/onboarding/first-value-launchpad.tsx`, `components/onboarding/workspace-setup-guide.tsx`, `app/(app)/saving-cards/new/page.tsx`, `components/saving-cards/saving-card-form.tsx`.
- Implementation scope: Remove friction that blocks one credible saving card from being created quickly.
- Testing/proof required: `vitest run tests/app/onboarding.page.test.ts tests/integration/first-value-onboarding.test.ts tests/app/saving-cards-new.page.test.ts tests/components/saving-card-form.test.ts`.
- Pass/fail criteria: Pass if a user can start from onboarding and create a first card with inline master data and credible financial fields in less than 10 minutes.
- Risk level: High.
- Expected Codex output after completion: First-value path proof, timing assumptions, and any activation fixes.

### Step 14

- Step number: 14
- Step title: Make master data helpful but non-blocking
- Why it matters: Master data improves reporting, but requiring perfect setup before first value recreates enterprise friction.
- Main files/routes to inspect: `components/saving-cards/creatable-master-data-field.tsx`, `components/saving-cards/saving-card-form.tsx`, `components/onboarding/master-data-starter-table.tsx`, `components/onboarding/master-data-upload-step.tsx`, `lib/onboarding/master-data-config.ts`, `app/api/onboarding/master-data/route.ts`.
- Implementation scope: Validate inline create behavior for buyers, suppliers, materials, categories, plants, and business units; keep onboarding templates useful but optional.
- Testing/proof required: `vitest run tests/components/saving-card-form.test.ts tests/api/onboarding-master-data.route.test.ts tests/components/master-data-upload-step.test.ts`.
- Pass/fail criteria: Pass if missing master data can be created inline during card creation and onboarding can be revisited from Workspace Settings/onboarding.
- Risk level: Medium.
- Expected Codex output after completion: Non-blocking master-data proof and any UI/API fixes.

### Step 15

- Step number: 15
- Step title: Improve saving-card commercial realism
- Why it matters: US manufacturing buyers need the card to reflect real procurement economics.
- Main files/routes to inspect: `components/saving-cards/saving-card-form.tsx`, `components/saving-cards/detail-workspace.tsx`, `components/saving-cards/results-tab.tsx`, `lib/validation.ts`, `lib/calculations.ts`, `lib/saving-cards/shared.ts`, `prisma/schema.prisma`.
- Implementation scope: Strengthen presentation and validation for saving type, hard savings vs cost avoidance, recurring vs one-time, baseline price, new price, annual volume, currency, impact dates, forecast vs actual where available, and finance validation explanation.
- Testing/proof required: `vitest run tests/components/saving-card-form.test.ts tests/lib/data.saving-cards.test.ts tests/api/saving-cards.route.test.ts`.
- Pass/fail criteria: Pass if a card reads like a credible procurement savings case without requiring new schema unless a concrete gap is proven.
- Risk level: Medium.
- Expected Codex output after completion: Saving-card realism changes, proof, and any deferred schema decisions.

### Step 16

- Step number: 16
- Step title: Explain evidence and finance validation during activation
- Why it matters: Evidence is central to finance trust, but first-time users need to understand what to attach and when.
- Main files/routes to inspect: `components/saving-cards/evidence-uploader.tsx`, `components/saving-cards/saving-card-form.tsx`, `components/saving-cards/detail-workspace.tsx`, `app/api/upload/evidence/route.ts`, `app/api/evidence/[id]/download/route.ts`.
- Implementation scope: Improve activation guidance for quote, contract, invoice, calculation, and finance-validation evidence; do not change storage behavior unless a gap is found.
- Testing/proof required: `vitest run tests/api/import-and-evidence.route.test.ts tests/api/storage-tenant-access.test.ts tests/components/saving-card-form.test.ts`.
- Pass/fail criteria: Pass if first-card users can save the card, attach evidence, and understand how finance validation uses it.
- Risk level: Medium.
- Expected Codex output after completion: Evidence activation proof and any UI copy/test fixes.

### Step 17

- Step number: 17
- Step title: Validate onboarding readiness and activation signals
- Why it matters: The product should show whether a workspace is ready without blocking useful work.
- Main files/routes to inspect: `lib/workspace/readiness.ts`, `lib/first-value.ts`, `components/onboarding/workspace-setup-guide.tsx`, `components/admin/admin-activation-signals.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/admin/insights/page.tsx`.
- Implementation scope: Confirm readiness metrics, missing-core-setup labels, activation signals, and sample-data paths match the first-value strategy.
- Testing/proof required: `vitest run tests/app/onboarding.page.test.ts tests/components/first-value-launchpad.test.ts tests/api/sample-data-telemetry.test.ts tests/app/admin-insights.page.test.ts`.
- Pass/fail criteria: Pass if readiness guidance helps users move forward and admin signals clearly show activation progress.
- Risk level: Medium.
- Expected Codex output after completion: Activation signal proof and focused fixes.

### Step 18

- Step number: 18
- Step title: Make import-assisted activation safe
- Why it matters: SMEs often arrive with Excel data, so import must accelerate activation without threatening tenant safety.
- Main files/routes to inspect: `app/api/import/route.ts`, `components/reports/import-export-panel.tsx`, `components/onboarding/master-data-upload-step.tsx`, `app/api/onboarding/master-data-template/[entity]/route.ts`, `tests/api/import-and-evidence.route.test.ts`, `tests/components/import-export-panel.test.ts`.
- Implementation scope: Improve activation import guidance and identify saving-card row-level-error needs; fix category option mismatch if approved in this step.
- Testing/proof required: `vitest run tests/api/import-and-evidence.route.test.ts tests/components/import-export-panel.test.ts tests/api/onboarding-master-data-template.route.test.ts`.
- Pass/fail criteria: Pass if import remains tenant-scoped, master-data row errors are visible, and saving-card import limitations are documented or fixed.
- Risk level: Medium.
- Expected Codex output after completion: Import-assisted activation proof and remaining import backlog.

## Phase 4: Procurement Workflow And Finance Trust, Steps 19-24

### Step 19

- Step number: 19
- Step title: Prove canonical workflow and approval controls
- Why it matters: Governance credibility depends on no skipped phases and no parallel approval path.
- Main files/routes to inspect: `lib/workflow.ts`, `lib/workflow/service.ts`, `app/api/phase-change-request/route.ts`, `app/api/approve-phase-change/route.ts`, `components/saving-cards/approval-panel.tsx`, `components/kanban/kanban-board.tsx`, `components/open-actions/open-actions-list.tsx`.
- Implementation scope: Validate Idea -> Validated -> Realized/Implemented -> Achieved and cancellation rules through request/approval only.
- Testing/proof required: `vitest run tests/lib/workflow-definition.test.ts tests/api/workflow.route.test.ts tests/lib/data.workflow.test.ts tests/components/kanban-board.test.ts tests/app/open-actions.page.test.ts`.
- Pass/fail criteria: Pass if direct phase mutation is blocked, pending requests do not relocate Kanban cards, and cancellation requires a reason.
- Risk level: High.
- Expected Codex output after completion: Workflow proof matrix and any route/UI fixes.

### Step 20

- Step number: 20
- Step title: Prove finance validation and finance lock behavior
- Why it matters: CFO and controller trust depends on protecting validated financial assumptions.
- Main files/routes to inspect: `lib/workflow.ts`, `lib/permissions.ts`, `lib/saving-cards/mutations.ts`, `components/saving-cards/detail-workspace.tsx`, `components/saving-cards/results-tab.tsx`, `components/saving-cards/approval-panel.tsx`.
- Implementation scope: Validate finance lock only on Validated cards, protect baseline/new price/volume/currency/impact dates when locked, and explain the lock clearly.
- Testing/proof required: `vitest run tests/lib/workflow-definition.test.ts tests/lib/data.saving-cards.test.ts tests/api/saving-cards.route.test.ts tests/components/saving-card-form.test.ts`.
- Pass/fail criteria: Pass if finance lock cannot be misused and locked fields remain stable under edit attempts.
- Risk level: High.
- Expected Codex output after completion: Finance-lock proof and any mutation/UI fixes.

### Step 21

- Step number: 21
- Step title: Prove private evidence upload and signed download trust
- Why it matters: Evidence files may contain quotes, contracts, and finance-sensitive data.
- Main files/routes to inspect: `app/api/upload/evidence/route.ts`, `app/api/evidence/[id]/download/route.ts`, `lib/uploads.ts`, `lib/evidence-config.ts`, `components/saving-cards/evidence-uploader.tsx`, `tests/api/storage-tenant-access.test.ts`.
- Implementation scope: Validate upload restrictions, private bucket paths, signed download TTL, tenant access control, stakeholder/approver visibility, audit logging, quota/rate limits, and cross-tenant rejection.
- Testing/proof required: `vitest run tests/api/import-and-evidence.route.test.ts tests/api/storage-tenant-access.test.ts tests/api/quota-enforcement.test.ts tests/api/rate-limit.test.ts`.
- Pass/fail criteria: Pass if unauthorized tenants cannot upload/download evidence and signed URLs are short-lived provider-backed links.
- Risk level: High.
- Expected Codex output after completion: Evidence trust proof with manual Supabase bucket checks.

### Step 22

- Step number: 22
- Step title: Validate alternative supplier and material scenarios
- Why it matters: Procurement decisions need credible alternatives, not just a final price.
- Main files/routes to inspect: `components/saving-cards/detail-workspace.tsx`, `components/saving-cards/saving-card-form.tsx`, `app/api/saving-cards/[id]/alternative-suppliers/*`, `app/api/saving-cards/[id]/alternative-materials/*`, `lib/saving-cards/mutations.ts`, `lib/validation.ts`.
- Implementation scope: Verify add/edit/delete/select alternative supplier/material flows, tenant safety, selected scenario impact, and buyer-facing clarity.
- Testing/proof required: `vitest run tests/api/saving-cards.route.test.ts tests/lib/data.saving-cards.test.ts tests/components/saving-card-form.test.ts`.
- Pass/fail criteria: Pass if alternatives are tenant-scoped, optional, explainable, and do not corrupt baseline case data.
- Risk level: Medium.
- Expected Codex output after completion: Alternative scenario proof and any route/UI fixes.

### Step 23

- Step number: 23
- Step title: Validate forecast, actuals, and timeline realism
- Why it matters: Manufacturing SMEs care about when savings hit, not just headline value.
- Main files/routes to inspect: `app/api/saving-cards/[id]/volume/*`, `lib/volume.ts`, `components/timeline/timeline-board.tsx`, `components/timeline/volume-scurve.tsx`, `lib/dashboard/data.ts`, `lib/command-center/data.ts`.
- Implementation scope: Prove forecast vs actual volume rows, import behavior, impact dates, S-curve/timeline display, and tenant safety.
- Testing/proof required: Target volume/timeline tests if present, plus relevant API/app tests; add focused tests only if a gap is found.
- Pass/fail criteria: Pass if forecast/actual information supports executive reporting without misleading users when data is missing.
- Risk level: Medium.
- Expected Codex output after completion: Volume/timeline proof and any targeted fixes.

### Step 24

- Step number: 24
- Step title: Validate audit trail, notifications, and open actions
- Why it matters: Governance platforms need traceability from request to decision.
- Main files/routes to inspect: `lib/audit.ts`, `lib/notifications.ts`, `app/api/notifications/route.ts`, `components/layout/notification-bell.tsx`, `components/open-actions/open-actions-list.tsx`, `app/(app)/open-actions/page.tsx`, `app/(app)/admin/settings/page.tsx`.
- Implementation scope: Verify audit records, notifications, pending approval counts, bulk approval behavior, and admin activity visibility.
- Testing/proof required: `vitest run tests/api/audit-events.test.ts tests/api/notifications.route.test.ts tests/components/notification-bell.test.ts tests/app/open-actions.page.test.ts`.
- Pass/fail criteria: Pass if important changes leave an audit trail and users see their actionable workflow queue.
- Risk level: Medium.
- Expected Codex output after completion: Audit/action proof and any fixes.

## Phase 5: Demo Workspace, Reporting, And US SME Buyer Experience, Steps 25-30

### Step 25

- Step number: 25
- Step title: Validate UtopiaTrax demo workspace end to end
- Why it matters: The demo workspace is the buyer’s first proof that Traxium understands manufacturing procurement.
- Main files/routes to inspect: `scripts/seed-utopiatrax-demo.ts`, `tests/scripts/seed-utopiatrax-demo.test.ts`, `docs/demo-utopiatrax.md`, seeded dashboard/report/command-center/open-action surfaces.
- Implementation scope: Prove the seed creates realistic manufacturing data, at least 25 cards, 6 direct categories, realistic phase distribution, evidence, alternatives, users/roles, finance locks, forecasts/actuals, and billing trial records.
- Testing/proof required: `vitest run tests/scripts/seed-utopiatrax-demo.test.ts`; run `npm run db:seed:utopiatrax` only against an approved non-production database.
- Pass/fail criteria: Pass if seed is idempotent, demo data populates buyer-facing surfaces, and no unrelated workspace is modified.
- Risk level: Medium.
- Expected Codex output after completion: UtopiaTrax seed proof and staging/manual validation checklist.

### Step 26

- Step number: 26
- Step title: Prove dashboard, Kanban, command center, timeline, and open actions demo value
- Why it matters: Paid-pilot buyers need to see governed savings work as a portfolio, not isolated cards.
- Main files/routes to inspect: `app/(app)/dashboard/page.tsx`, `components/dashboard/dashboard-client.tsx`, `app/(app)/kanban/page.tsx`, `components/kanban/kanban-board.tsx`, `app/(app)/command-center/page.tsx`, `components/command-center/command-center-client.tsx`, `app/(app)/timeline/page.tsx`, `app/(app)/open-actions/page.tsx`.
- Implementation scope: Validate UtopiaTrax-driven metrics, phase columns, pending requests, filters, empty states, and executive context.
- Testing/proof required: `vitest run tests/app/dashboard.page.test.ts tests/app/kanban.page.test.ts tests/app/command-center.page.test.ts tests/app/timeline.page.test.ts tests/app/open-actions.page.test.ts tests/components/dashboard-client.test.ts tests/components/kanban-board.test.ts tests/components/command-center-client.test.ts`.
- Pass/fail criteria: Pass if demo pages are populated, coherent, tenant-scoped, and consistent after workflow changes.
- Risk level: Medium.
- Expected Codex output after completion: Demo surface proof with manual routes to verify.

### Step 27

- Step number: 27
- Step title: Improve reports and executive export usability
- Why it matters: Finance and executives need a clear takeaway and a usable offline report.
- Main files/routes to inspect: `app/(app)/reports/page.tsx`, `components/reports/executive-savings-summary.tsx`, `components/reports/import-export-panel.tsx`, `app/api/export/route.ts`, `lib/data.ts`, export mapping helpers.
- Implementation scope: Validate executive summary, workbook summary sheet, saving-card rows, customer-facing terminology, file naming, and empty/partial-data behavior.
- Testing/proof required: `vitest run tests/api/export.route.test.ts tests/components/executive-savings-summary.test.ts tests/components/import-export-panel.test.ts tests/app/reports.page.test.ts`.
- Pass/fail criteria: Pass if exported workbook is tenant-scoped, usable by a controller, and consistent with reports/dashboard values.
- Risk level: Medium.
- Expected Codex output after completion: Export proof with workbook fields and manual report checks.

### Step 28

- Step number: 28
- Step title: Harden import/export for pilot operations
- Why it matters: Excel replacement claims require reliable import and export expectations.
- Main files/routes to inspect: `app/api/import/route.ts`, `app/api/export/route.ts`, `components/reports/import-export-panel.tsx`, `components/onboarding/master-data-upload-step.tsx`, tests for imports/exports.
- Implementation scope: Add saving-card row-level errors if approved, expose category import consistently, validate tenant safety, and document import limitations.
- Testing/proof required: `vitest run tests/api/import-and-evidence.route.test.ts tests/api/export.route.test.ts tests/components/import-export-panel.test.ts`.
- Pass/fail criteria: Pass if bad rows are visible without unsafe partial imports, exports remain tenant-scoped, and customer expectations are clear.
- Risk level: Medium.
- Expected Codex output after completion: Import/export proof and any UI/API/test changes.

### Step 29

- Step number: 29
- Step title: Tune US SME buyer experience and role labels
- Why it matters: The product should feel built for 50-500 employee US manufacturers, not a generic enterprise suite.
- Main files/routes to inspect: `lib/constants.ts`, app sidebar/settings/admin labels, onboarding copy, reports copy, billing pages, invite/member labels, demo docs.
- Implementation scope: Adjust role labels and customer-facing language where useful; avoid enum/schema changes unless proven necessary.
- Testing/proof required: `rg` terminology scan and targeted app/component tests for changed labels.
- Pass/fail criteria: Pass if buyer-facing language is plain, US-friendly, procurement/finance-specific, and still maps safely to existing roles/enums.
- Risk level: Low.
- Expected Codex output after completion: US SME wording changes and terminology proof.

### Step 30

- Step number: 30
- Step title: Create paid-pilot buyer experience package
- Why it matters: After trust and activation are stable, the product needs a coherent first-buyer story.
- Main files/routes to inspect: `app/page.tsx`, `app/layout.tsx`, `README.md`, `docs/demo-utopiatrax.md`, possible new GTM docs/routes only if approved.
- Implementation scope: Define landing-page promise, demo script, paid pilot offer, security/trust page needs, support expectations, and data export expectations.
- Testing/proof required: App/page tests if UI changes; docs review if documentation only.
- Pass/fail criteria: Pass if the buyer-facing story matches product reality and does not promise unbuilt enterprise capabilities.
- Risk level: Low.
- Expected Codex output after completion: GTM/buyer experience docs or focused page changes.

## Phase 6: Provider-Flow Validation And Operational Readiness, Steps 31-35

### Step 31

- Step number: 31
- Step title: Validate Supabase auth, storage, and redirect provider flows
- Why it matters: Some trust-critical behavior can only be proven against provider configuration.
- Main files/routes to inspect: `lib/supabase/*`, `lib/auth-email.ts`, `lib/uploads.ts`, `docs/environment-setup.md`, Supabase redirect notes, evidence routes, invite/reset routes.
- Implementation scope: Run staging/local-provider validation for auth redirects, invite links, recovery links, private storage, signed URLs, and service-role boundaries.
- Testing/proof required: Targeted automated tests plus manual/provider checks; no success claim without provider proof.
- Pass/fail criteria: Pass if configured Supabase Auth and Storage match the app contract and manual checks are recorded.
- Risk level: High.
- Expected Codex output after completion: Supabase provider proof and exact manual validation evidence.

### Step 32

- Step number: 32
- Step title: Validate Stripe provider flows in staging
- Why it matters: Billing logic needs real Stripe session, portal, and webhook confirmation before paid pilots.
- Main files/routes to inspect: `lib/billing/*`, `app/api/billing/*`, `app/billing/recover/route.ts`, `docs/billing-access-staging-qa.md`, `docs/subscription-gating-and-billing-recovery.md`.
- Implementation scope: Exercise Checkout, Portal, webhook sync, recovery, active/trialing/past_due/unpaid/canceled/no_subscription states, and mode separation in a non-production Stripe environment.
- Testing/proof required: Billing tests plus Stripe CLI/dashboard evidence where available.
- Pass/fail criteria: Pass if every state in the billing matrix is observed or simulated with recorded proof.
- Risk level: High.
- Expected Codex output after completion: Stripe staging proof, state matrix result, and unresolved provider blockers.

### Step 33

- Step number: 33
- Step title: Validate async jobs and admin operations
- Why it matters: Invitations, password recovery, analytics, observability, and operational retry depend on the worker.
- Main files/routes to inspect: `scripts/run-job-worker.ts`, `lib/jobs.ts`, `lib/job-runner.ts`, `lib/auth-email.ts`, `app/(app)/admin/jobs/page.tsx`, `app/api/admin/jobs/*`, `docs/operations-runbook.md`.
- Implementation scope: Prove worker healthcheck, job enqueue/reserve/process/retry, admin jobs visibility, and sensitive payload sanitization.
- Testing/proof required: `npm run jobs:worker:healthcheck`, `vitest run tests/lib/jobs.test.ts tests/lib/job-runner.test.ts tests/api/admin-jobs.test.ts tests/components/admin-jobs-ui.test.ts`.
- Pass/fail criteria: Pass if worker can see registered handlers, jobs process or fail safely, and admins can inspect/retry tenant-scoped jobs.
- Risk level: Medium.
- Expected Codex output after completion: Worker/admin ops proof and any fixes.

### Step 34

- Step number: 34
- Step title: Validate observability, rate limits, quotas, and admin insight signals
- Why it matters: Pilot operations need visibility into failures, abuse, activation, and quota pressure.
- Main files/routes to inspect: `lib/observability.ts`, `lib/analytics.ts`, `lib/rate-limit.ts`, `lib/usage.ts`, `app/(app)/admin/insights/page.tsx`, `app/api/admin/insights/route.ts`, `app/api/admin/audit/route.ts`.
- Implementation scope: Prove telemetry boundaries, admin insights, rate-limit responses, quota enforcement, and no secret leakage.
- Testing/proof required: `vitest run tests/api/rate-limit.test.ts tests/api/quota-enforcement.test.ts tests/lib/usage-tracking.test.ts tests/lib/observability.test.ts tests/app/admin-insights.page.test.ts`.
- Pass/fail criteria: Pass if operational signals are tenant-scoped, actionable, and safe for production-like logs.
- Risk level: Medium.
- Expected Codex output after completion: Operational visibility proof and any fixes.

### Step 35

- Step number: 35
- Step title: Run predeploy and post-release smoke readiness
- Why it matters: A pilot launch needs repeatable release-day proof.
- Main files/routes to inspect: `scripts/predeploy-check.ts`, `scripts/postdeploy-smoke.ts`, `docs/post-release-smoke-tests.md`, `docs/deployment-strategy.md`, `vercel.json`, `.github/workflows/ci.yml`.
- Implementation scope: Validate predeploy, deployment separation, post-release smoke, dashboard/Kanban freshness, and manual smoke checklist.
- Testing/proof required: `npm run predeploy` in preview/production-like env, `npm run build` when env allows, `node --import tsx scripts/postdeploy-smoke.ts` against approved deployment.
- Pass/fail criteria: Pass if deploy checks and post-release smoke can be executed or blockers are documented precisely.
- Risk level: High.
- Expected Codex output after completion: Release readiness proof and launch blocker list.

## Phase 7: GTM, Pricing, Pilot, And Launch Readiness, Steps 36-40

### Step 36

- Step number: 36
- Step title: Tighten landing-page promise for US manufacturing SMEs
- Why it matters: The first page should sell the real paid-pilot wedge, not a vague procurement platform.
- Main files/routes to inspect: `app/page.tsx`, `app/layout.tsx`, current product routes, UtopiaTrax docs, README positioning.
- Implementation scope: Update promise, audience, proof points, and CTA only after trust/activation steps are proven.
- Testing/proof required: App/page tests if UI changes; manual review against actual implemented capabilities.
- Pass/fail criteria: Pass if the page clearly promises finance-trusted savings governance for US manufacturing SMEs without overclaiming.
- Risk level: Low.
- Expected Codex output after completion: Landing-page changes or copy doc with proof that claims map to product reality.

### Step 37

- Step number: 37
- Step title: Define paid pilot offer and pricing hypothesis
- Why it matters: Buyers need a concrete commercial next step after demo.
- Main files/routes to inspect: `docs/*`, billing plan config/docs, `app/settings/billing/page.tsx`, `lib/billing/config.ts`, product positioning.
- Implementation scope: Draft pilot offer, inclusion/exclusion scope, duration, success criteria, support model, pricing hypothesis, and how it relates to Stripe plan names.
- Testing/proof required: Documentation review; billing tests only if product billing UI/config changes.
- Pass/fail criteria: Pass if pilot commercial terms are clear and do not require unbuilt pricing complexity.
- Risk level: Low.
- Expected Codex output after completion: Paid-pilot offer document and pricing assumptions.

### Step 38

- Step number: 38
- Step title: Build demo script for CFO, procurement manager, controller, and IT reviewer
- Why it matters: The same product must answer different trust questions in a short buyer meeting.
- Main files/routes to inspect: `docs/demo-utopiatrax.md`, UtopiaTrax seed, dashboard, reports, command center, saving-card detail, evidence, admin members/settings, billing settings.
- Implementation scope: Create a demo script with persona-specific path, talk track, proof points, and fallback route if provider flows are unavailable.
- Testing/proof required: Manual route walkthrough against UtopiaTrax; update docs only unless broken demo flow is found.
- Pass/fail criteria: Pass if the script shows first value, evidence, finance validation, executive reporting, tenant safety, billing readiness, and export expectations.
- Risk level: Low.
- Expected Codex output after completion: Demo script and manual walkthrough proof.

### Step 39

- Step number: 39
- Step title: Create security, trust, support, and data export expectations
- Why it matters: IT and finance reviewers need clear operational expectations before uploading real data.
- Main files/routes to inspect: `docs/environment-setup.md`, `docs/db-security-access-matrix.md`, `docs/api-hardening-matrix.md`, evidence routes, export route, auth/billing docs, possible new trust doc/page.
- Implementation scope: Document tenant isolation, auth, evidence privacy, backups/retention assumptions, support expectations, incident contacts, and export availability.
- Testing/proof required: Docs review plus targeted security tests if code changes.
- Pass/fail criteria: Pass if trust expectations are honest, specific, and backed by implemented controls or named limitations.
- Risk level: Medium.
- Expected Codex output after completion: Security/trust/support/data-export readiness artifact.

### Step 40

- Step number: 40
- Step title: Final paid-pilot launch gate
- Why it matters: Launch should happen only when trust, activation, provider flows, reporting, demo, operations, and GTM are all proven.
- Main files/routes to inspect: `docs/readiness-proof-log.md`, all docs created in prior steps, release checklist, pilot offer, demo script, security/trust artifact, current test/build status.
- Implementation scope: Review every proof-log entry, mark blockers, define pilot success metrics, decide go/no-go, and identify what not to build before pilot feedback.
- Testing/proof required: `npm run env:check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run predeploy`, `npm run jobs:worker:healthcheck`, plus manual provider/demo proofs where available.
- Pass/fail criteria: Pass if all high-risk steps are passed or explicitly accepted with documented mitigation; fail if any trust-critical blocker remains unowned.
- Risk level: High.
- Expected Codex output after completion: Paid-pilot readiness decision, blocker register, next sprint recommendation, and safe launch checklist.
