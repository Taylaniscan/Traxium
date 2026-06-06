# Provider Flow Validation

## Purpose

This is the master Gap 1 release checklist for proving Traxium's real external provider flows before paid pilots. It joins the app-side tests, guarded provider scripts, preview browser proof, and minimal production smoke into one repeatable proof pack.

Do not claim pass unless proof exists. A release note, buyer deck, or pilot handoff may only say a provider flow passed when the matching evidence has been captured in [readiness-proof-log.md](/Users/atlas/Documents/Traxium/docs/readiness-proof-log.md) or in the linked release evidence folder.

Provider-flow validation separates four evidence categories:

- Automated local proof: deterministic tests and route-level behavior in this repository.
- Automated provider proof: read-only or explicitly guarded Stripe/Supabase checks.
- Manual preview proof: browser-based flow evidence against preview/staging.
- Manual production smoke proof: minimal safe checks against production only.

## Environments

### Preview / staging

- `APP_ENV=preview`
- Stripe test mode only.
- Preview Supabase project only.
- Preview email/Auth redirect configuration only.
- Preview worker deployed as a separate process running `npm run jobs:worker`.
- Preview validation may create controlled test invitations, test password reset emails, Stripe test-mode Checkout/Portal sessions, test evidence files, and test import/export data in a designated validation workspace.
- Preview validation must not point at production providers or production customer data.

### Production

- `APP_ENV=production`
- Stripe live mode only.
- Production Supabase project only.
- Production worker deployed as a separate process running `npm run jobs:worker`.
- Production validation is smoke-only and must use controlled internal test users/workspaces.
- Production validation must not send real customer test emails, charge real cards, upload production customer evidence, reset unrelated customer passwords, mutate unrelated customer/workspace data, or test webhooks on uncontrolled customer subscriptions.

## Provider Flow Matrix

| Flow | Automated local coverage | Provider script coverage | Manual preview proof required | Production smoke required | Evidence to capture | Pass/fail criteria | Failure interpretation |
|---|---|---|---|---|---|---|---|
| Environment variables and deploy guards | `npm run env:check`, `npm run predeploy`, deploy-guard/env tests | Stripe/Supabase validators confirm provider alignment where credentials are present | Confirm preview uses `APP_ENV=preview`, Stripe test mode, preview Supabase, preview URLs | Confirm production uses `APP_ENV=production`, Stripe live mode, production Supabase, production URLs | Secret-safe command summaries, provider project refs/modes, deployment env screenshot with values redacted | Env checks pass with no mixed provider modes or placeholder/local URLs | Preview/prod provider boundary is unsafe; release is blocked |
| Worker health | `tests/lib/job-runner.test.ts`, jobs route/UI tests | `npm run jobs:worker:healthcheck` verifies DB reachability and registered handlers without processing jobs | Run healthcheck in preview worker; create one job-producing flow and confirm worker processes it | Run healthcheck in production worker only | Healthcheck JSON, job ID/status transition, worker deployment identifier | Worker has auth email handlers and can see/process due jobs in the right DB | Invite/reset delivery and telemetry may stall even when web app is healthy |
| Invite email | `tests/api/invitations.test.ts`, invitation lifecycle tests prove route queueing and no inline provider send | Supabase validator proves Auth Admin reachability but cannot prove email delivery | Invite a controlled preview test email from `/admin/members`; confirm queued job, worker completion, and received email | Invite controlled internal production email only; do not invite customer addresses | Invitation ID, redacted email domain, job ID, worker completion, received email timestamp, redacted link host/path | Invitation is created, email arrives, link targets preview app, no secrets/full auth links logged | Supabase email/redirect or worker delivery is broken |
| Invitation acceptance | Invitation acceptance/account setup tests prove token, membership, role, and auth contracts | Supabase validator documents redirect allow-list checks as manual/provider-blocked without Management API | Open the invite link, complete setup or accept flow, verify membership/role in `/admin/members` | Only accept a controlled internal production invitation if created for smoke | Invitation ID, role, target workspace, screenshots of accepted state, audit/member row IDs | User lands in correct workspace with correct role and no login loop | Auth redirects, token handling, membership creation, or active workspace state is broken |
| Password reset email | `tests/api/password-recovery.test.ts` proves request acceptance and queued worker job | Supabase validator proves Auth Admin reachability; dashboard redirect checks remain manual | Submit `/forgot-password` for a controlled preview account, confirm queued job, worker completion, and received email | Request reset for controlled production test account only; do not change customer credentials | Redacted test email, job ID, worker completion, received email timestamp, reset link host/path only | Email arrives from the intended project and targets `/reset-password` on the right app URL | Supabase email provider, redirect config, or worker delivery is broken |
| Password reset completion | Reset route tests prove valid session updates password and invalid session fails safely | Supabase validator cannot complete a browser recovery session | Open reset link, set new password, verify old password fails and new password works | Complete only for controlled production test account when planned | User ID/email redacted, timestamp, screenshots of old-password failure and new-password success | Password changes only for the controlled user and session clears correctly | Supabase Auth session exchange or app reset route is broken |
| Stripe Checkout | `tests/api/billing-checkout.test.ts`, Stripe config/safety tests | `npm run stripe:validate -- --exercise-provider-flows` can create test-mode Checkout Session only outside production | Start subscription through app flow in Stripe test mode; verify redirect and DB billing customer/session state | Do not create a live paid subscription unless already part of a controlled internal plan | Checkout Session ID, customer ID, app workspace ID, redirect screenshot, DB row IDs | Test-mode Checkout opens, returns to app, and billing records map to workspace | Product/Price config, checkout route, permissions, or redirect URLs are broken |
| Stripe Billing Portal | `tests/api/billing-checkout.test.ts`, `tests/api/billing-recover.route.test.ts` | `npm run stripe:validate -- --exercise-provider-flows` can create test-mode Portal Session only outside production | Open Manage billing as preview admin, verify portal opens and returns without loop | Open portal for controlled production test admin and return without changing subscription | Portal Session ID, app workspace ID, return screenshot, no-loop observation | Admin reaches Stripe Portal and returns to app without exposing URL to non-admins | Customer mapping, portal config, role guard, or return URL is broken |
| Stripe webhook delivery | `tests/api/stripe-webhook.test.ts` proves signature, idempotency, and DB sync behavior | `npm run stripe:validate` reports webhook secret presence; dashboard/CLI delivery remains blocked until proven | Use Stripe CLI/dashboard to deliver required test events to `/api/billing/webhook`; record event IDs and DB sync | Do not test on uncontrolled live customer subscriptions; smoke only with controlled internal event if approved | Stripe event IDs, delivery status, app response, `WebhookEvent`/billing row IDs, duplicate-event result if tested | Webhook events are accepted once, duplicates are idempotent, billing state updates | Billing state may drift from Stripe; paid access/recovery cannot be trusted |
| Billing recovery state sync | Billing access/recovery tests prove state mapping, portal/checkout fallback, and blocked access contracts | Stripe validator proves catalog and guarded handoff creation; webhook delivery proof completes provider sync | Exercise active, trialing, no-subscription, unpaid/past-due/canceled test states where available; verify `/billing-required` clears after sync | Confirm controlled production test workspace can open `/settings/billing` and portal without redirect loop | Access-state screenshots, Stripe subscription/customer IDs, DB subscription row, route status codes | App state follows Stripe state and admins can recover without dead end | Access gating may over-block, under-block, or trap paid users |
| Evidence upload | `tests/api/import-and-evidence.route.test.ts`, upload/storage tests | Supabase validator checks private bucket and service-role reachability | Upload harmless test evidence to preview validation saving card; verify DB row and private storage object | Upload harmless internal/test evidence only | Evidence row ID, storage bucket/path hash or redacted path, file name/type/size, audit row | Upload succeeds, object is private, path is organization-scoped | Evidence storage, quota, authz, or bucket config is unsafe |
| Evidence signed download | Download/storage tests prove server-mediated signed URL and path validation | Supabase validator checks service-role signed URL creation without printing URL | Download through app route and confirm direct/public access fails | Download harmless internal/test evidence through app route only | Evidence row ID, 307 status, signed URL TTL, public/direct access denial status | App issues short-lived URL after authz and public storage URL is unreadable | Evidence may be unavailable or publicly exposed |
| Cross-tenant evidence rejection | Storage tenant tests reject foreign tenant paths and path traversal | Supabase validator confirms anon/public cannot read private evidence object | Attempt controlled cross-tenant evidence download from another validation user/workspace | Do not run destructive or customer-data cross-tenant attempts in production; use internal/test workspace only if prepared | Source/target workspace IDs, evidence ID, route status, no signed URL issued | Cross-tenant access returns not found/denied and no signed URL is created | Tenant isolation is broken; hard release blocker |
| Import | Import route tests prove row validation, all-or-nothing saving-card import, master-data RBAC, tenant scope | No external provider script; depends on app DB and auth provider session | Import valid workbook and invalid workbook in preview; verify row errors and no partial invalid import | Import only into internal/test workspace when needed; avoid customer data | Workbook name/hash, response summaries, row errors, created row IDs | Valid import writes only active workspace; invalid workbook returns row errors with no corrupt partial write | Buyer data may corrupt or leak across tenants |
| Export | Export route tests prove tenant-scoped data loaders and XLSX structure | No external provider script; depends on app DB and auth provider session | Export controller workbook; open workbook and confirm workspace-only data | Export internal/test workspace report only | Workbook file name, sheet list, row counts, workspace slug/name, no foreign rows | Export includes only active workspace portfolio and opens cleanly | Controller export may leak tenant data or be unusable |
| UtopiaTrax demo workspace provider assumptions | Seed/demo tests prove local seed shape and app surfaces | Provider scripts do not prove demo-specific provider readiness | Run `npm run db:seed:utopiatrax -- --reset` only in safe preview/staging DB, then verify provider-dependent assumptions are either configured or explicitly called out | Do not reset production demo/customer data | Seed command output, workspace ID/slug, provider assumptions checklist | Demo workspace is safe to use and does not imply unproven provider pass | Demo may overclaim storage/auth/billing readiness |
| Dashboard/Kanban/Reports post-provider smoke | Dashboard, Kanban, reports, command center, export tests | No provider script; depends on auth/session and app DB | After provider flows, open `/dashboard`, `/kanban`, `/reports`; verify seeded/live data appears after refresh | Open `/dashboard`, `/admin/settings`, `/settings/billing`, and export only in controlled production workspace | Screenshots, route statuses, export workbook, mutation freshness note if performed | App remains coherent after auth/billing/storage/import/export flows | Provider success may not translate into usable pilot workflow |

## Exact Commands

Run these in order for a release-level provider proof pack. Use preview/staging values for preview proof and production values only for production smoke.

```bash
npm run env:check
npm run predeploy
npm run typecheck
npm test
npm run stripe:validate
npm run stripe:validate -- --exercise-provider-flows
npm run supabase:validate
npm run jobs:worker:healthcheck
npm run jobs:worker:once
npm run db:seed:utopiatrax -- --reset
```

Notes:

- `npm run jobs:worker:once` processes due jobs. Run it only in a controlled environment where queued auth emails and telemetry are expected.
- `npm run db:seed:utopiatrax -- --reset` mutates data. Run it only against local or explicitly approved preview/staging databases, never against production.
- `npm run stripe:validate -- --exercise-provider-flows` creates guarded Stripe test-mode objects only when the Stripe key is test mode and the app environment is not production.
- `npm run providers:validate`, when available, runs the non-mutating release command subset: env check, predeploy, Stripe validation, Supabase validation, and worker healthcheck.

## Manual Preview Checklist

### 1. Invite Email

1. Open `/admin/members` as a preview admin in the validation workspace.
2. Invite a controlled preview test email that is not a customer address.
3. Confirm the API response reports `transport: "job-queued"` or record a blocker if the queue is unavailable.
4. Confirm the job exists with type `auth_email.invitation_delivery`.
5. Run or observe the preview worker until the job completes.
6. Confirm the email arrives in the controlled inbox.
7. Record only the invite link host/path, not the full auth link or token.
8. Open the link, accept the invitation or complete account setup, then verify membership and role in `/admin/members`.

### 2. Password Reset

1. Open `/forgot-password`.
2. Submit a controlled preview test account.
3. Confirm the response is accepted and a `auth_email.password_recovery_delivery` job is queued.
4. Run or observe the preview worker until the job completes.
5. Confirm the email arrives in the controlled inbox.
6. Record only the reset link host/path, not the full auth link or token.
7. Open the reset link and set a new password.
8. Verify the old password fails and the new password works.

### 3. Stripe Checkout

1. Confirm preview uses Stripe test mode.
2. Start the app subscription flow from the validation workspace.
3. Use Stripe test mode only; do not use real card data.
4. Verify Checkout opens with the expected plan/price.
5. Complete or cancel the test flow as planned.
6. Verify the app redirect returns to the configured preview URL.
7. Verify `BillingCustomer`, subscription, and access-state rows match the validation workspace after webhook sync.
8. Verify protected route access reflects the expected billing state.

### 4. Stripe Portal

1. Open `/settings/billing` as a preview admin.
2. Click or submit Manage billing.
3. Verify Stripe Billing Portal opens for the workspace customer.
4. Return to the app.
5. Verify there is no redirect loop and `/settings/billing` remains reachable.
6. Verify non-admin users cannot obtain a portal URL.

### 5. Stripe Webhook

1. Configure `STRIPE_WEBHOOK_SECRET` for the preview webhook endpoint.
2. Use Stripe CLI or Dashboard to deliver `checkout.session.completed`.
3. Deliver or trigger `customer.subscription.created`.
4. Deliver or trigger `customer.subscription.updated` for the states being validated.
5. Deliver or trigger `customer.subscription.deleted` or a canceled subscription update when safe.
6. Record Stripe event IDs and delivery statuses.
7. Verify app-side `WebhookEvent`, `BillingCustomer`, and `Subscription` rows update as expected.
8. Re-deliver one safe event if possible and verify duplicate handling.

### 6. Evidence Upload/Download

1. Upload a harmless test evidence file to a validation saving card.
2. Verify the DB row is created with the configured private bucket.
3. Verify the storage path is under `organizations/{organizationId}/saving-cards/{savingCardId}/evidence/`.
4. Download through `/api/evidence/{id}/download`.
5. Verify the response redirects to a short-lived signed URL.
6. Verify unauthenticated public/direct storage access fails.
7. Attempt a controlled cross-tenant download from another validation workspace and verify no signed URL is issued.

### 7. Import/Export

1. Import a valid workbook into the validation workspace.
2. Verify created rows belong only to the active workspace.
3. Import an invalid workbook.
4. Verify row errors are returned and no invalid partial saving-card import occurs.
5. Export the controller workbook through `/api/export` or the Reports UI.
6. Open the workbook.
7. Confirm the summary and saving-card rows include workspace-only data.

### 8. Worker Health

1. Run `npm run jobs:worker:healthcheck` in the preview worker environment.
2. Create a job-producing flow such as invite email or password reset.
3. Run `npm run jobs:worker:once` only if the queued job is controlled and expected, or observe the long-running worker.
4. Confirm the job transitions to completed or records an actionable failure.
5. Record worker deployment identifier, command output, job ID, and final job status.

## Production Smoke Checklist

Production smoke is intentionally minimal and safe:

- Log in as a controlled production test admin.
- Open `/dashboard`.
- Open `/admin/settings`.
- Open `/settings/billing`.
- Open Stripe Portal and return without changing the subscription.
- Request password reset for a controlled production test account only.
- Invite a controlled internal email only.
- Upload and download a harmless evidence file in an internal/test workspace only.
- Export an internal/test workspace report only.
- Run `npm run jobs:worker:healthcheck` in the production worker environment.

Do not include:

- Real customer email tests.
- Real card charges.
- Destructive reset.
- Deleting customer data.
- Testing webhooks on uncontrolled customer subscriptions.

## Proof Log Template

Copy this template into [readiness-proof-log.md](/Users/atlas/Documents/Traxium/docs/readiness-proof-log.md) for each provider-flow validation run.

```text
Date:
Environment:
Commit SHA:
Validator:
Preview URL:
Worker deployment:
Stripe mode:
Supabase project ref:
Test workspace:
Test users:
Commands run:
Provider checks:
Manual checks:
Evidence captured:
Pass/fail:
Blockers:
Follow-up:
```

## Hard Blockers

- Invite email not delivered.
- Password reset email not delivered.
- Stripe webhook not updating billing state.
- Stripe Portal cannot open for admin.
- Stripe Checkout cannot create subscription.
- Evidence upload fails.
- Evidence download leaks or fails.
- Cross-tenant evidence access succeeds.
- Worker not running.
- Import/export corrupts or leaks tenant data.
- Production uses wrong Stripe mode.
- Preview uses production providers.
- Redirect loops in auth/billing flows.

## Evidence Redaction Rules

- Do not log secrets, tokens, signed URLs, Supabase service-role key data, Stripe customer payment data, full auth links, or full email magic/recovery/invite links.
- Prefer IDs, timestamps, status codes, object modes, redacted host/path values, row IDs, and screenshots with sensitive values hidden.
- For signed URLs, record TTL and status only.
- For Stripe, record object IDs and event IDs, not payment method details.
- For Supabase Auth, record redirect host/path and delivery result, not the full verification URL.
