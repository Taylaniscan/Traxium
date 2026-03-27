# Post-Release Smoke Tests

Run these checks immediately after every preview signoff deployment and every production release. Keep the list short, but do not skip items that touch auth, onboarding, invitations, admin, observability, or jobs.

1. Route-contract smoke:
   Export the current deployment URL to `POSTDEPLOY_BASE_URL`, then run `node --import tsx scripts/postdeploy-smoke.ts`.
   Expected: all scripted checks pass with no unexpected `500`, open redirect, or unauthenticated admin leak.

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
   Expected: dashboard/admin readiness counts move for the active workspace only and no duplicate workspace is created.

6. Invite creation:
   From `/admin/members`, create a new invitation.
   Expected: pending invitation appears in the active organization only and no unexpected validation or RBAC error appears.

7. Invite acceptance / account setup:
   Open the invitation link generated in the previous step and complete the correct flow:
   - new user: account setup flow
   - existing user: accept flow
   Expected: organization, role, and invitation email render correctly and acceptance finishes without looping to generic login.

8. Forgot-password / reset-password:
   Submit `/forgot-password` for a known test user, then complete `/reset-password`.
   Expected: request is accepted, async delivery is queued or sent, new password works on next login.

9. Admin members:
   Re-open `/admin/members`.
   Expected: member list and pending invites show only the active organization, resend/revoke/role actions are available to admins, and no tenant leak is visible.

10. Admin settings and audit:
    Update a safe workspace setting in `/admin/settings`.
    Expected: save succeeds and a new audit row appears in the admin activity list for that workspace.

11. Admin insights, observability, and analytics:
    Open `/admin/insights` after the checks above.
    Expected: page loads, activation and health cards are tenant-scoped, recent admin activity appears, and downstream analytics/structured logs show events such as `auth.login.succeeded`, `onboarding.workspace_created`, `invitation.sent`, `invitation.accepted`, and `workspace.sample_data_loaded`.

12. Jobs health:
    Open `/admin/jobs`.
    Expected: queued/processing/failed/completed counts are sane for the active workspace, no unexplained failed job spike exists, and any known retryable failure can be re-queued safely.

13. Worker health:
    Run `npm run jobs:worker:once` in the deployed worker environment.
    Expected: the worker starts, drains available work once, exits cleanly, and the jobs page reflects the updated status without new unexpected failures.
