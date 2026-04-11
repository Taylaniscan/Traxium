# Post-Release Smoke Tests

Run these checks immediately after every preview signoff deployment and every production release. Keep the list short, but do not skip items that touch auth, onboarding, invitations, admin, observability, or jobs.

1. Route-contract smoke:
   Export the current deployment URL to `POSTDEPLOY_BASE_URL`, then run `node --import tsx scripts/postdeploy-smoke.ts`.
   If a release-validation browser session is available, also export `POSTDEPLOY_SESSION_COOKIE` with the authenticated `Cookie` header value before running the script. If that workspace intentionally has a pending workflow request, also set `POSTDEPLOY_EXPECT_PENDING_PHASE_REQUEST=true`.
   Expected: all scripted checks pass with no unexpected `500`, open redirect, unauthenticated admin leak, dashboard empty fallback with seeded data, or Kanban board empty fallback with seeded data.

2. Auth shell:
   Open `/login`, `/forgot-password`, and `/reset-password`.
   Expected: each page renders correctly, no blank UI, no hydration error, no server error.

3. Auth bootstrap:
   Sign in with an existing release-validation user.
   Expected: user lands on `/dashboard` or `/onboarding` depending on workspace state, not on a dead-end page.

4. Workspace onboarding:
   With a fresh user that still needs a workspace, open `/onboarding` and submit workspace creation.
   Expected: organization and membership are created, active organization is set, user leaves onboarding successfully.

5. Sample data:
   From the first-value launchpad, load sample data once.
   Expected: dashboard, Kanban, and admin readiness counts move for the active workspace only and no duplicate workspace is created.

6. Dashboard portfolio:
   Open `/dashboard` in the release-validation workspace after sample data or other seeded saving cards exist.
   Expected:
   - page loads without blank UI or server error
   - chart-bearing sections such as `Savings by Phase`, `Savings by Category`, and `Savings Forecast` render
   - the page does not fall back to `No live saving cards yet.` when seeded portfolio data exists
   - if a recent saving-card or workflow mutation was part of the release validation, refreshed metrics reflect the persisted portfolio state instead of stale pre-mutation data

7. Kanban workflow board:
   Open `/kanban` in the same release-validation workspace.
   Expected:
   - page loads without blank UI or server error
   - cards stay grouped by persisted phase columns, not by pending destination
   - invalid jump controls such as `Idea -> Achieved` are not offered
   - if the workspace has a pending phase request, the card stays in its persisted column and shows `Pending approval` metadata instead of appearing moved
   - cancellation still requires a reason
   - if there is a safe validation card for workflow rejection, an invalid jump still produces visible blocked feedback instead of feeling like drag-and-drop silently failed

8. Workflow and saving-card freshness:
   In the same seeded workspace, perform one safe mutation if the release scope touched workflow, saving cards, or reporting:
   - a saving-card update that should affect portfolio surfaces, or
   - a valid sequential phase-change request / approval outcome, or
   - a safe rejection path for an invalid move
   Refresh `/dashboard`, `/kanban`, and `/saving-cards`.
   Expected:
   - dashboard metrics reflect the persisted post-mutation portfolio state
   - Kanban grouping still reflects persisted phase while pending state remains metadata only
   - saving-card list and detail screens agree with dashboard and Kanban
   - approval, rejection, cancellation, and finance-lock outcomes do not leave stale cross-page contradictions

9. Invite creation:
   From `/admin/members`, create a new invitation.
   Expected: pending invitation appears in the active organization only and no unexpected validation or RBAC error appears.

10. Invite acceptance / account setup:
   Open the invitation link generated in the previous step and complete the correct flow:
   - new user: account setup flow
   - existing user: accept flow
   Expected: organization, role, and invitation email render correctly and acceptance finishes without looping to generic login.

11. Forgot-password / reset-password:
   Submit `/forgot-password` for a known test user, then complete `/reset-password`.
   Expected: request is accepted, async delivery is queued or sent, new password works on next login.

12. Admin members:
   Re-open `/admin/members`.
   Expected: member list and pending invites show only the active organization, resend/revoke/role actions are available to admins, and no tenant leak is visible.

13. Admin settings and audit:
    Update a safe workspace setting in `/admin/settings`.
    Expected: save succeeds and a new audit row appears in the admin activity list for that workspace.

14. Admin insights, observability, and analytics:
    Open `/admin/insights` after the checks above.
    Expected: page loads, activation and health cards are tenant-scoped, recent admin activity appears, and downstream analytics/structured logs show events such as `auth.login.succeeded`, `onboarding.workspace_created`, `invitation.sent`, `invitation.accepted`, and `workspace.sample_data_loaded`.

15. Jobs health:
    Open `/admin/jobs`.
    Expected: queued/processing/failed/completed counts are sane for the active workspace, no unexplained failed job spike exists, and any known retryable failure can be re-queued safely.

16. Worker health:
    Run `npm run jobs:worker:once` in the deployed worker environment.
    Expected: the worker starts, drains available work once, exits cleanly, and the jobs page reflects the updated status without new unexpected failures.

17. Blocked billing and recovery:
    Use a preview-safe validation workspace that is intentionally in a blocked billing state. Do not induce a real customer billing failure in production.
    Expected:
    - opening `/dashboard` redirects to `/billing-required`
    - `/api/auth/bootstrap` returns `402` with `billingRequiredPath: "/billing-required"`
    - admin users see recovery actions such as portal or checkout handoff
    - normal members only see contact-admin guidance
    - after Stripe recovery, `/settings/billing` returns the user to `/dashboard` once subscription sync is active again
