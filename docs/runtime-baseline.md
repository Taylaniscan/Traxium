# Runtime Baseline

This baseline is the current operational checklist for local, preview, and production verification. It distinguishes what is already proven by automated coverage from what still requires a real environment, a browser, or provider-backed infrastructure.

## Status Keys

- `Verified`: proven by current automated tests or deterministic build / config checks
- `Pending Manual Verification`: requires a browser session, real provider callback, or storage / email infrastructure
- `Blocked`: not currently testable because a required dependency or environment is missing

## Environment Targets

### Local

- Purpose: developer workflow, route contract checks, UI sanity checks, and safe smoke tests against local or non-production Supabase data.
- Minimum commands:
  - `npm run env:check`
  - `npm run db:generate`
  - `npm run build`
  - `npm run test`
- Use when validating page rendering, auth routing, tenant guards, and non-destructive route behavior.

### Preview / Staging

- Purpose: first realistic runtime verification with provider-backed auth, storage, queue processing, and deployment headers.
- Minimum commands:
  - `npm run predeploy`
  - `npm run build`
  - targeted smoke steps below
- Use for invitation emails, password-reset redirects, storage uploads, and security-header inspection on the deployed host.

### Production

- Purpose: release acceptance after preview is already green.
- Minimum commands:
  - `npm run release:verify`
  - production smoke steps below
- Use only for low-volume confirmation that live auth, storage, and async jobs still behave as expected after release.

## Verified Automated Coverage

| Area | Status | Evidence |
|---|---|---|
| Environment validation | Verified | `tests/lib/env-config.test.ts`, `tests/ci/smoke-contract.test.ts`, `tests/ci/release-safety-consistency.test.ts` |
| Build integrity | Verified | `npm run build` |
| Auth + onboarding provisioning | Verified | `tests/integration/first-login-onboarding-provisioning.test.ts`, `tests/api/workspace-onboarding.test.ts` |
| Invitation creation / acceptance / account setup | Verified | `tests/api/invitations.test.ts`, `tests/api/invitation-acceptance.test.ts`, `tests/api/invitation-account-setup.test.ts` |
| Password recovery + reset route contracts | Verified | `tests/api/password-recovery.test.ts`, `tests/components/auth-recovery-and-loading-ui.test.ts` |
| Admin members / settings / audit / jobs / insights RBAC | Verified | `tests/api/admin-member-lifecycle.test.ts`, `tests/api/member-role-update.test.ts`, `tests/api/admin-settings-audit.test.ts`, `tests/api/admin-jobs.test.ts`, `tests/api/admin-insights.test.ts`, `tests/api/admin-rbac.test.ts` |
| Saving-card create / update / workflow actions | Verified | `tests/api/saving-cards.route.test.ts`, `tests/api/quota-enforcement.test.ts` |
| Import / evidence download and upload route contracts | Verified | `tests/api/import-and-evidence.route.test.ts` |
| Export workbook route contract | Verified | `tests/api/export.route.test.ts` |
| Billing and webhook route contracts | Verified | `tests/api/billing-checkout.test.ts`, `tests/api/stripe-webhook.test.ts` |
| Subscription gating, billing recovery UX, and Stripe deploy safety | Verified | `tests/lib/billing-access.test.ts`, `tests/lib/auth-guards.test.ts`, `tests/integration/first-login-onboarding-provisioning.test.ts`, `tests/integration/subscription-gating-regression.test.ts`, `tests/app/billing-required.page.test.ts`, `tests/api/billing-recover.route.test.ts`, `tests/lib/stripe-billing-safety.test.ts`, `tests/ci/deploy-guard.test.ts` |
| Distributed rate-limit policy behavior | Verified | `tests/api/rate-limit.test.ts`, `tests/lib/rate-limit.test.ts` |
| HTTP security header contract | Verified | `tests/config/http-security-headers.test.ts` |

## Hardening Assumptions

- The distributed limiter assumes the shared PostgreSQL `RateLimitBucket` table has been migrated and is reachable from every runtime instance. A 429 means the limiter is working; a 503 from limiter-protected routes means the shared backend is unavailable and should be restored before retry-heavy operations continue.
- Browser hardening is enforced centrally through `next.config.ts`, so local tests prove the config contract while preview and production still need one deployed-host header inspection pass.

## Manual Smoke Checklist

### 1. Login and authenticated bootstrap

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open `/login`.
  2. Sign in with a valid non-production user in local / preview, then a real operational account in production.
  3. Confirm the app lands on `/dashboard` or `/onboarding` depending on membership state.
- Expected Result:
  - Login succeeds without redirect loops.
  - Protected routes stop redirecting back to `/login`.
  - The active organization is present in the authenticated user context.
- Failure Interpretation:
  - Redirect loop or 401 after login usually means Supabase cookie propagation or middleware session hydration regressed.

### 2. Workspace creation

- Status: `Pending Manual Verification`
- Target: Local, Preview
- Steps:
  1. Sign in as a first-time user with no organization.
  2. Submit the onboarding workspace form once.
  3. Refresh the page and confirm onboarding is no longer offered.
- Expected Result:
  - Exactly one organization and one active membership are created.
  - The user receives an active organization context.
- Failure Interpretation:
  - Duplicate workspaces or memberships indicate onboarding idempotency has regressed.

### 3. Sample data load

- Status: `Pending Manual Verification`
- Target: Local, Preview
- Steps:
  1. From onboarding or first-value launchpad, trigger sample data load.
  2. Open `/dashboard` and `/saving-cards`.
- Expected Result:
  - Sample saving cards appear only inside the active organization.
  - Dashboard counts and command-center summaries reflect the inserted tenant data.
- Failure Interpretation:
  - Missing cards means seed pipeline failed; cross-tenant data indicates tenant scoping regression.

### 4. Saving-card create

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open `/saving-cards/new`.
  2. Create a valid saving card with real master-data selections.
  3. Return to `/saving-cards` and open the detail page.
- Expected Result:
  - Card appears in the active organization list immediately.
  - The detail page opens and updated metrics render.
- Failure Interpretation:
  - 422 responses indicate validation issues; missing list refresh suggests client-state or query invalidation regression; 429/503 means throttling or quota conditions should be reviewed.

### 5. Evidence upload

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Open a saving card detail page.
  2. Upload a supported file type within the configured file-size limit.
  3. Download the uploaded evidence link.
- Expected Result:
  - Upload succeeds, evidence row appears, and the download redirects to a signed URL.
  - The file remains scoped to the organization and saving card.
- Failure Interpretation:
  - Upload failure usually points to Supabase storage or quota issues; 404 on download after upload indicates storage path validation mismatch.

### 6. Import and volume import

- Status: `Pending Manual Verification`
- Target: Local, Preview
- Steps:
  1. Use `/api/import` through the import UI with a valid workbook.
  2. Use the saving-card volume import flow with a valid CSV or XLSX.
- Expected Result:
  - Valid rows import without cross-tenant leakage.
  - Invalid rows fail with row-level validation messages.
- Failure Interpretation:
  - Generic 500 responses usually point to workbook parsing or reference-data lookup regressions; 429/503 means the shared rate limiter is correctly active but thresholds may need operational review.

### 7. Export

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open the export surface from reports or import/export UI.
  2. Trigger an XLSX export.
  3. Open the downloaded workbook and inspect both `Report Summary` and `Savings`.
- Expected Result:
  - File name includes the workspace slug and current date.
  - Workbook only contains active-organization data.
- Failure Interpretation:
  - Empty workbook with real data present indicates query or export-mapping regression; repeated 429s indicate the export limiter is functioning and should be reviewed against operator expectations.

### 8. Invitation flow

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Open `/admin/members`.
  2. Create a new invite for a fresh email.
  3. Use the emailed invite link.
  4. Complete either existing-user accept or new-user setup depending on the target account state.
- Expected Result:
  - Invite appears in pending invites.
  - Email or queued delivery is observable.
  - Acceptance activates the correct membership in the correct organization.
- Failure Interpretation:
  - Wrong-email rejection is expected and confirms isolation.
  - Missing email with successful pending invite indicates async delivery or worker failure, not route-layer validation failure.

### 9. Password reset flow

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Open `/forgot-password`.
  2. Submit a real test account email.
  3. Follow the received reset link and submit a new password at `/reset-password`.
- Expected Result:
  - The forgot-password route accepts the request.
  - Reset link opens the reset screen.
  - New password is accepted and the user can sign in with it.
- Failure Interpretation:
  - Missing email indicates provider or queue failure.
  - 401 on reset indicates an expired or invalid recovery session.

### 10. Admin members

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open `/admin/members` as an owner or admin.
  2. Confirm members and pending invites are limited to the active organization.
  3. Attempt the same page with a normal member account.
- Expected Result:
  - Admin sees only the current organization.
  - Normal member receives a forbidden response or is blocked by the UI.
- Failure Interpretation:
  - Cross-tenant member rows indicate a critical tenant-scope regression.

### 11. Admin settings

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open `/admin/settings`.
  2. Update workspace name and description.
  3. Refresh the page and confirm changes persist.
- Expected Result:
  - Changes apply only to the active organization.
  - Audit history includes the workspace update event.
- Failure Interpretation:
  - No persisted change means organization update path regressed; wrong-tenant change is a critical isolation failure.

### 12. Admin insights

- Status: `Pending Manual Verification`
- Target: Local, Preview, Production
- Steps:
  1. Open `/admin/insights`.
  2. Confirm member, invite, audit, and error metrics reflect the active workspace.
- Expected Result:
  - Metrics are organization-scoped and consistent with known recent activity.
- Failure Interpretation:
  - Cross-tenant counts or impossible totals indicate aggregation or tenant-filter regression.

### 13. Admin jobs

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Open `/admin/jobs`.
  2. Confirm jobs are listed only for the active organization.
  3. Retry a known failed job once.
  4. Run `npm run jobs:worker:once` in non-production if needed.
- Expected Result:
  - Retry moves the failed job back to `QUEUED` once and does not duplicate the record on repeat.
- Failure Interpretation:
  - Missing jobs indicates ingestion or retention issue; retry doing nothing on a failed job suggests job state transition regression.

### 14. Security headers

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Open `/dashboard` in a deployed environment after signing in.
  2. Inspect the document response headers in browser devtools or with `curl -I`.
  3. Confirm `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` are all present with non-empty values.
- Expected Result:
  - Security headers are present on the primary authenticated app shell and match the contract enforced by `next.config.ts`.
- Failure Interpretation:
  - Missing or empty headers indicate deployment config drift, proxy/header stripping, or an unexpected Next config regression even if local contract tests are still green.

### 15. Blocked billing and recovery

- Status: `Pending Manual Verification`
- Target: Preview, Production
- Steps:
  1. Use a validation workspace that is already in a blocked billing state such as `UNPAID`, blocked `PAST_DUE`, `CANCELED`, or no completed subscription.
  2. Sign in as an admin and open `/dashboard`.
  3. Confirm the app redirects to `/billing-required`.
  4. Submit `POST /api/auth/bootstrap` from the authenticated browser session or network panel and confirm the response is `402` with `billingRequiredPath: "/billing-required"`.
  5. On `/billing-required`, confirm the copy matches the blocked state and the admin can launch billing recovery.
  6. Sign in as a normal member for the same workspace and confirm the page limits recovery to contact-admin guidance.
  7. Complete recovery in Stripe, land on `/settings/billing`, then refresh until the workspace re-enters `/dashboard`.
- Expected Result:
  - Protected app routes stay blocked while billing is unresolved.
  - Admins can reach Stripe recovery without raw error pages.
  - Members never receive privileged billing controls.
  - Once billing is restored, the paywall clears and the app becomes reachable again.
- Failure Interpretation:
  - A protected route rendering normally while the org is blocked indicates guard regression.
  - Missing admin CTAs, raw `402` pages, or recovery loops indicate billing recovery regressions.
  - A member seeing portal or checkout actions indicates role-isolation regression.

## Current Blockers

- None in the repository itself.
- Real email delivery, Supabase storage writes, and deployed-header inspection still require preview or production infrastructure and cannot be fully proven by local unit / route tests alone.
