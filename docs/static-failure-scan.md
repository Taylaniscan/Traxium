# Traxium Static Failure Scan

Scan date: 2026-06-06

This scan distinguishes executable results from textual matches. A passing static
check is not browser, provider, or end-to-end proof.

## Command Results

| Command | Result | Evidence status |
| --- | --- | --- |
| `npm run typecheck` | PASS | TypeScript completed with exit code 0 |
| `npm run build` | PASS WITH WARNINGS | Next.js production build completed; 38 lint warnings and webpack cache-size warnings |
| `npm test` | PASS | 154 files, 746 tests passed |
| `npm run lint` | PASS WITH WARNINGS | 0 errors, 38 unused-code warnings |
| `npm run env:check` | PASS | Development environment, DB and Supabase keys present; Stripe publishable key/webhook secret absent |
| `npm run predeploy` | BLOCKED BY ENVIRONMENT | Correctly refused `APP_ENV=development`; preview/production proof not obtained |
| `npx prisma validate` | PASS | Prisma schema valid |
| Prisma generation through `npm run build` | PASS | Prisma Client 6.19.2 generated |
| `npx prisma migrate status` | PASS | Database reachable; 12 migrations; schema up to date |

The installed Next.js build resolved to 15.5.12 through the package range, while
`package.json` declares `^15.2.4`.

## Risky Pattern Results

### Secrets and Client Exposure

- No `console.log` or `console.error` call was found logging passwords, secrets,
  tokens, cookies, authorization headers, or signed URLs.
- `SUPABASE_SERVICE_ROLE_KEY`, database URLs, and Stripe secrets are used in
  server libraries/scripts and documentation/tests.
- Client components containing `process.env` reference only `NODE_ENV`.
- No `as any`, `@ts-ignore`, or `dangerouslySetInnerHTML` use was found in
  application, library, script, Prisma, or test TypeScript.
- `localStorage` is used only for a dashboard welcome-dismissal flag. No secret
  or session material is stored there.
- `.env.example` contains deliberately fake JWT-shaped local-development keys.
  This is a search hit, not evidence of a live secret.

### Workflow and Finance Controls

- Direct saving-card `PATCH` phase mutation returns `409`.
- Direct legacy approval actions return `409`.
- Saving-card edits compare the submitted phase to the persisted phase and
  preserve the persisted phase.
- Saving-card creation and import enforce the initial workflow phase.
- The only application phase update found is in
  `lib/workflow/service.ts` after assigned approvals complete inside a database
  transaction. Other phase writes are seed/demo data.
- Finance lock is role-checked at the route and phase-checked in the mutation.
- Finance-locked financial/classification fields are preserved during updates.

### Billing and Provider Internals

- No UI link or client fetch directly targets `/api/billing/portal`.
- Billing UI recovery posts through `/billing/recover`.
- Stripe customer/subscription/product/price IDs occur in server billing models,
  provider handling, and demo seed logic. No inspected UI renders a raw ID.
- Evidence upload responses return application download routes, not bucket/path.
- Evidence download authorizes the DB row and validates its managed tenant path,
  then redirects to a 60-second signed URL.
- `storageBucket` and `storagePath` search hits are server persistence,
  validation, or provider scripts. They are not included in upload JSON.

### Tenant Scope

- Saving-card reads use `findFirst` with `organizationId` through tenant helpers.
- Evidence upload/download queries combine tenant and role/stakeholder access.
- Volume writes first resolve a tenant-scoped card and relation deletes include
  the tenant-owned card relation.
- Several writes use an ID-only `update` after a tenant-scoped lookup inside the
  same transaction. This is not a proven leak, but runtime attack tests remain
  required.
- User, organization, billing-provider, job, invitation, and workflow
  `findUnique` calls were inspected as context/provider lookups. Authorization
  is generally applied before or after lookup through session membership,
  tenant ownership, provider signature, or service-layer checks.
- `getApprovalStatus(cardId, phase)` has no tenant parameter, but no application
  caller exists. It is an unused exported helper and not a proven runtime leak.

### Terminology and Trust Claims

- Internal database enums retain `REALISED` and `CANCELLED`.
- Customer-facing phase maps convert these to `Implemented` and `Canceled`.
- Search hits for SOC 2, 24/7 support, ERP integration, accounting posting,
  audited recognition, and guaranteed savings are predominantly explicit
  exclusions or negative tests.
- Public pilot/trust copy explicitly says those capabilities are not included.
- README uses internal enum values alongside US-facing lifecycle labels.
- No affirmative certification/support/integration overclaim was proven by the
  static scan.

## False Positives

- Internal enum identifiers and metric names such as `realisedSavings`
- `checkout=cancelled` billing query-state values
- Negative trust statements containing prohibited claim phrases
- Provider validation scripts that intentionally inspect redacted/hashable
  storage paths and provider IDs
- Script `console.log` calls that print summaries, counts, statuses, and file
  locations rather than credentials
- Server-side environment reads and fake test/example keys

## Actual Blockers

### P1

1. **No browser test framework or browser certification exists.**
   All 746 passing tests remain `NOT BROWSER-PROVEN`.
2. **Stripe runtime proof is blocked by incomplete local configuration.**
   The publishable key and webhook secret are absent. Checkout/portal/webhook
   behavior cannot be called provider-proven.
3. **Preview/production predeploy proof is blocked by environment.**
   The local development result cannot certify deployment configuration.
4. **Critical handler coverage is incomplete.**
   No direct route tests were identified for pending approvals or the volume
   portfolio/card forecast/actual/import handlers.

### P2

1. Lint reports 38 unused variables/imports/functions across application and
   test code.
2. Next.js build reports large webpack cache serialization warnings.
3. Several major client bundles are large for this product stage:
   dashboard about 310 kB first load, timeline about 316 kB, saving-card detail
   about 347 kB.
4. `getApprovalStatus` is an unused tenant-unscoped helper and should not be
   adopted by new callers without adding tenant context.

No proven P0 static blocker was found.

## Files Needing Follow-up

Browser/runtime certification:

- `package.json`
- new Playwright configuration and `tests/e2e/` helpers/specifications

Missing direct route coverage:

- `app/api/pending-approvals/route.ts`
- `app/api/volume/portfolio/route.ts`
- `app/api/saving-cards/[id]/volume/route.ts`
- `app/api/saving-cards/[id]/volume/forecast/route.ts`
- `app/api/saving-cards/[id]/volume/actual/route.ts`
- `app/api/saving-cards/[id]/volume/import/route.ts`

Provider/environment completion:

- local/preview secret configuration outside the repository
- `scripts/validate-stripe-provider.ts`
- `scripts/validate-supabase-provider.ts`
- `scripts/predeploy-check.ts`

Potential cleanup, not automatic P0/P1 work:

- files listed by `npm run lint`
- `lib/workflow/service.ts` unused `getApprovalStatus` export
