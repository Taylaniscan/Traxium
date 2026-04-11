# Billing Access Staging QA

This runbook is the manual and simulated release-validation pack for Traxium's subscription gating, billing recovery, and Stripe deploy safety behavior. Use it during preview signoff before production release. It is intentionally explicit so a teammate who did not author the feature can still validate it safely.

## Evidence Labels

- `Automated`: already proven by deterministic tests in this repository
- `Simulated`: proven through route-contract tests, local runtime checks, or code-backed behavior without a full provider round-trip
- `Manual / staging required`: needs a real authenticated browser session, real organization data, or live provider-backed behavior in preview

## Routes And APIs In Scope

Pages:

- `/dashboard`
- `/saving-cards`
- `/admin/members`
- `/billing-required`
- `/settings/billing`
- `/login`
- `/logout`
- `/forgot-password`
- `/reset-password`
- `/invite/[token]`

APIs:

- `/api/auth/bootstrap`
- `/api/command-center`
- `/api/export`
- `/api/saving-cards`
- `/api/billing/checkout`
- `/api/billing/portal`
- `/billing/recover`
- `/api/organizations/switch`

Release checks:

- `npm run env:check`
- `npm run predeploy`
- `npm run build`

## Manual QA Matrix

| Scenario name | Role | Org billing state | Expected page result | Expected API result | Expected recovery result | Validation type |
|---|---|---|---|---|---|---|
| Active org admin | Admin | `active` or `trialing` | Protected app routes load normally | Protected APIs return `200` | No billing interruption or CTA | Automated + Manual / staging required |
| Active org member | Member | `active` or `trialing` | Protected app routes load normally | Protected APIs return `200` | No billing interruption or CTA | Automated + Manual / staging required |
| Canceled org admin | Admin | `canceled` | Protected routes redirect to `/billing-required` | Protected APIs return structured `402` | Admin sees recovery CTA and can launch billing recovery | Automated + Manual / staging required |
| Canceled org member | Member | `canceled` | Protected routes redirect to `/billing-required` | Protected APIs return structured `402` | Member sees blocked guidance without admin controls | Automated + Manual / staging required |
| Unpaid org admin | Admin | `unpaid` | `/billing-required` shows unpaid messaging | Protected APIs return structured `402` | Admin sees billing portal / payment recovery actions | Automated + Manual / staging required |
| Past-due org admin | Admin | `past_due` blocked state | `/billing-required` shows past-due messaging | Protected APIs return structured `402` | Admin sees recovery actions; grace-period orgs should still be allowed | Automated + Manual / staging required |
| No-subscription org admin | Admin | `no_subscription` / `incomplete` | Protected routes redirect to `/billing-required` | Protected APIs return structured `402` | Admin is routed toward checkout-style recovery | Automated + Manual / staging required |
| Cross-tenant user with one active org and one blocked org | Admin or member in multiple orgs | Active org A, blocked org B | Behavior follows the active org only | API payloads and redirects reflect the active org only | Switching into blocked org changes the next protected request into blocked behavior | Simulated + Manual / staging required |
| Blocked org using protected API | Admin or member | Any blocked state | UI remains blocked | Protected API returns `402` with `code`, `accessState`, `reasonCode`, and `billingRequiredPath` | No raw 401/403/500 leak | Automated |
| Blocked org using allowed recovery route | Admin or member | Any blocked state | `/billing-required` and `/settings/billing` stay reachable | Billing recovery routes stay reachable while blocked | Admin can continue recovery; member stays limited | Automated + Manual / staging required |
| Staging / test-key environment | Release engineer | Preview or staging env | App can run with Stripe test mode config | `npm run env:check` and preview deploy checks pass | Test Stripe checkout / portal can be used safely | Automated + Manual / staging required |
| Production / live-key predeploy environment | Release engineer | Production env | Deploy should be blocked on unsafe Stripe config | `npm run predeploy` rejects test or mixed config | Only live-key production config is accepted | Automated |

## Staging Preconditions

Prepare these before manual testing:

1. A preview deployment with `APP_ENV=preview` and Stripe test-mode billing config.
2. At least four validation workspaces:
   - active admin/member workspace
   - canceled workspace
   - unpaid or blocked past-due workspace
   - no-subscription or incomplete-checkout workspace
3. At least one multi-org validation user who belongs to:
   - one active workspace
   - one blocked workspace
4. One admin-capable user and one normal member user for each blocked workspace.
5. A known Stripe test recovery path for each blocked state you intend to validate.

## Staging Checklist

### 1. Active org admin path

- Precondition: sign in as an admin for an organization with `ACTIVE` or `TRIALING` subscription state.
- User action: open `/dashboard`, `/saving-cards`, and `/admin/members`, then call `/api/auth/bootstrap` and one protected API such as `/api/command-center`.
- Expected result: pages render normally, admin surfaces stay usable, and protected APIs return `200`.
- Failure meaning: billing gating is incorrectly applied to allowed organizations, or active-org context is not being resolved consistently.

### 2. Active org member path

- Precondition: sign in as a member for an organization with `ACTIVE` or `TRIALING` subscription state.
- User action: open `/dashboard` and `/saving-cards`, then call `/api/auth/bootstrap`.
- Expected result: core protected pages load normally and bootstrap returns a successful user payload.
- Failure meaning: billing or auth guards are over-blocking valid non-admin members.

### 3. Canceled org admin interruption

- Precondition: sign in as an admin for a workspace with `CANCELED` subscription state.
- User action: open `/dashboard`.
- Expected result: request lands on `/billing-required` instead of rendering the protected page.
- Failure meaning: app-route billing gating regressed or the active workspace billing state is not being evaluated.

### 4. Canceled org member interruption

- Precondition: sign in as a member for the same canceled workspace.
- User action: open `/dashboard`.
- Expected result: request lands on `/billing-required` and the member sees a blocked explanation without privileged controls.
- Failure meaning: role-based recovery isolation regressed or member guidance is missing.

### 5. Unpaid org admin messaging

- Precondition: sign in as an admin for an `UNPAID` workspace.
- User action: open `/billing-required`.
- Expected result: page copy clearly references unpaid billing, recovery actions are visible, and the page is visually complete.
- Failure meaning: state-to-message mapping regressed or the paywall is incomplete.

### 6. Past-due org admin messaging

- Precondition: sign in as an admin for a `PAST_DUE` workspace where the grace period has expired.
- User action: open `/billing-required`.
- Expected result: page copy clearly references past-due billing, not no-subscription or canceled messaging.
- Failure meaning: past-due mapping regressed or the grace-period boundary is wrong.

### 7. No-subscription org admin behavior

- Precondition: sign in as an admin for a workspace with no active subscription or incomplete checkout.
- User action: open `/billing-required`, then submit the recovery CTA.
- Expected result: the UI explains that setup is still required and recovery routes toward checkout instead of the portal.
- Failure meaning: no-subscription mapping regressed or the recovery router is choosing the wrong Stripe handoff.

### 8. Billing-required page quality

- Precondition: use each blocked-state workspace above.
- User action: review `/billing-required` on desktop and mobile widths.
- Expected result: content is readable, CTAs are visible, no broken layout appears, and the page is not a dead end.
- Failure meaning: billing-required UX is not release-ready even if route contracts pass.

### 9. Restored subscription clears the block

- Precondition: start from a blocked admin workspace and complete the Stripe recovery action in preview.
- User action: return through `/settings/billing`, then refresh until sync completes.
- Expected result: once the subscription is active again, the app redirects back into `/dashboard`.
- Failure meaning: billing restoration is not clearing the gate, webhook sync is stale, or the Stripe return flow is broken.

### 10. Admin recovery controls

- Precondition: sign in as an admin for any blocked workspace.
- User action: inspect `/billing-required` and submit the relevant recovery CTA.
- Expected result: admin sees actionable controls such as portal, payment update, or subscription resume depending on the billing state.
- Failure meaning: the blocked admin path is not recoverable in-app.

### 11. Member restricted recovery path

- Precondition: sign in as a non-admin member for any blocked workspace.
- User action: inspect `/billing-required`.
- Expected result: member sees contact-admin guidance and does not see admin-only recovery controls.
- Failure meaning: privileged billing actions are leaking to non-admins.

### 12. Recovery route reachability while blocked

- Precondition: stay signed in as a blocked admin.
- User action: submit `POST /billing/recover` from the paywall or call `/api/billing/checkout` and `/api/billing/portal` through the app.
- Expected result: billing recovery endpoints stay reachable even though product routes are blocked.
- Failure meaning: a total lockout has been introduced and admins cannot recover billing.

### 13. No sensitive billing detail leakage to non-admins

- Precondition: sign in as a blocked member.
- User action: inspect page content, network responses, and any route transitions around `/billing-required`.
- Expected result: the user sees state-level guidance only; no Stripe customer IDs, portal URLs, or workspace-internal billing records are exposed.
- Failure meaning: billing recovery isolation has regressed.

### 14. Protected API behavior for blocked orgs

- Precondition: sign in as a user in a blocked workspace.
- User action: call `/api/auth/bootstrap` and one protected API such as `/api/command-center`, `/api/export`, or `/api/saving-cards`.
- Expected result: each response is `402` with the structured billing error contract.
- Failure meaning: blocked APIs are leaking the wrong status code or inconsistent error shapes.

### 15. Protected API behavior for active orgs

- Precondition: sign in as a user in an active workspace.
- User action: call `/api/auth/bootstrap` and one protected API such as `/api/command-center`.
- Expected result: responses succeed normally with `200`.
- Failure meaning: valid orgs are being blocked or billing state is misread.

### 16. Allowlisted routes continue to work while blocked

- Precondition: test both a signed-out browser session and a blocked authenticated session.
- User action: as a signed-out user, open `/login`, `/logout`, `/forgot-password`, `/reset-password`, and `/invite/[token]` when applicable. As a blocked authenticated user, open `/login`, `/billing-required`, and `/settings/billing`.
- Expected result: signed-out public auth routes remain reachable. Authenticated blocked users may be handed off from `/login` back into `/dashboard` and then `/billing-required`, but they must not hit a redirect loop, raw error, or dead end.
- Failure meaning: public or recovery routes were accidentally moved behind the product billing gate.

### 17. Error-shape consistency

- Precondition: use a blocked workspace session.
- User action: compare `/api/auth/bootstrap` and one protected API response body.
- Expected result: billing errors stay intentional and include `code`, `accessState`, `reasonCode`, and `billingRequiredPath`.
- Failure meaning: consumers cannot reliably detect billing-required responses.

### 18. Cross-tenant active-vs-blocked behavior

- Precondition: sign in as a user who belongs to one active workspace and one blocked workspace.
- User action: verify behavior in the current active workspace, then switch organizations and repeat protected page/API checks.
- Expected result: behavior follows the active workspace only; the other org's billing state does not leak until that org becomes active.
- Failure meaning: tenant context resolution or organization switching is incorrect.

### 19. Organization switch updates billing gating

- Precondition: same multi-org user as above.
- User action: call `/api/organizations/switch` into the blocked org, then open `/dashboard` or call `/api/auth/bootstrap`.
- Expected result: the switch succeeds, and the very next protected request reflects the blocked org's billing state.
- Failure meaning: switching orgs does not update billing gating consistently.

### 20. Cross-tenant leakage check

- Precondition: same multi-org setup.
- User action: compare responses, redirects, and paywall details in each workspace context.
- Expected result: redirects and responses reflect only the active organization and never expose the other org's billing metadata.
- Failure meaning: a critical tenant-scope regression exists.

### 21. Production guard rejects `sk_test_`

- Precondition: prepare a production-like env config with `APP_ENV=production` and a Stripe test secret key.
- User action: run `npm run predeploy`.
- Expected result: validation fails with an explicit error about `sk_test_` being invalid in production.
- Failure meaning: production deploy safety is not enforceable.

### 22. Production guard accepts `sk_live_`

- Precondition: prepare a production-like env config with live-looking Stripe key and catalog IDs.
- User action: run `npm run predeploy`.
- Expected result: Stripe mode validation passes.
- Failure meaning: release safety is too strict or live-mode validation is broken.

### 23. Preview / staging accepts Stripe test mode

- Precondition: preview env with `APP_ENV=preview` and Stripe test-mode config.
- User action: run `npm run env:check` and `npm run predeploy`.
- Expected result: validation passes for preview-safe test config.
- Failure meaning: preview deployments cannot safely use Stripe test mode.

### 24. Mixed Stripe config fails clearly

- Precondition: set mismatched publishable/secret keys or live secret with preview catalog IDs.
- User action: run `npm run predeploy`.
- Expected result: validation fails with a clear mixed-mode explanation.
- Failure meaning: deploy safety leaves room for silent mode mismatch.

### 25. Missing production billing env fails clearly

- Precondition: production-like env missing one required billing variable such as `STRIPE_PORTAL_RETURN_URL`.
- User action: run `npm run predeploy`.
- Expected result: validation fails with the missing env name and why it is required.
- Failure meaning: production deploy can proceed with incomplete billing config.

### 26. Release docs match current billing gating

- Precondition: open the billing/access and release docs in the repo.
- User action: compare [subscription-gating-and-billing-recovery.md](/Users/atlas/Documents/Traxium/docs/subscription-gating-and-billing-recovery.md), [post-release-smoke-tests.md](/Users/atlas/Documents/Traxium/docs/post-release-smoke-tests.md), and [release-checklist.md](/Users/atlas/Documents/Traxium/docs/release-checklist.md).
- Expected result: docs consistently describe blocked routes, recovery flow, and Stripe deploy safety.
- Failure meaning: release verification will drift from real behavior.

### 27. Runtime and smoke docs mention billing-required scenario

- Precondition: open runtime and smoke docs in the repo.
- User action: review [runtime-baseline.md](/Users/atlas/Documents/Traxium/docs/runtime-baseline.md) and [post-release-smoke-tests.md](/Users/atlas/Documents/Traxium/docs/post-release-smoke-tests.md).
- Expected result: both docs explicitly call out billing-required validation.
- Failure meaning: billing gating is easy to miss during release verification.

### 28. Non-author engineer usability check

- Precondition: hand this runbook to a teammate who did not implement the feature.
- User action: ask them to explain how they would validate an unpaid workspace, a member blocked path, and the Stripe predeploy gate.
- Expected result: they can follow the matrix and checklist without needing feature-author context.
- Failure meaning: the release pack is not operationally usable yet.

## Automated Support For This Runbook

Use these suites before manual staging work:

- `tests/lib/billing-access.test.ts`
- `tests/lib/auth-guards.test.ts`
- `tests/app/billing-required.page.test.ts`
- `tests/app/settings-billing.page.test.ts`
- `tests/api/auth.bootstrap.route.test.ts`
- `tests/api/billing-checkout.test.ts`
- `tests/api/billing-recover.route.test.ts`
- `tests/api/stripe-webhook.test.ts`
- `tests/integration/subscription-gating-regression.test.ts`
- `tests/lib/stripe-billing-safety.test.ts`
- `tests/ci/deploy-guard.test.ts`

## Release Notes

- This runbook validates the billing/access recommendation set itself.
- It does not override broader repository release blockers such as unrelated build or Prisma drift.
- If `npm run build` is red for unrelated reasons, billing/access staging signoff can still be complete, but production release should remain blocked until the global build gate is green.
