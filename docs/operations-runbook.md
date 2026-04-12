# Operations Runbook

This runbook is for release-day validation and post-release incidents across Traxium’s auth, onboarding, invitations, admin, observability, and async jobs surfaces.

## First 15 Minutes After Release

- Export the current deployment URL to `POSTDEPLOY_BASE_URL`, then run `node --import tsx scripts/postdeploy-smoke.ts`.
- Run the manual checks in [post-release-smoke-tests.md](/Users/atlas/Documents/Traxium/docs/post-release-smoke-tests.md).
- Keep these three admin surfaces open in an `OWNER` or `ADMIN` session for the active release-validation workspace:
  - [admin/insights](/Users/atlas/Documents/Traxium/app/(app)/admin/insights/page.tsx)
  - [admin/jobs](/Users/atlas/Documents/Traxium/app/(app)/admin/jobs/page.tsx)
  - [admin/settings](/Users/atlas/Documents/Traxium/app/(app)/admin/settings/page.tsx)

## Primary Triage Sources

- Deployment/build output:
  - Vercel deployment logs
  - `npm run predeploy`
  - `npm run build`
- Structured runtime logs:
  - `auth.bootstrap.failed`
  - `invitation.create.failed`
  - `invitation.accept.failed`
  - `invitation.complete.failed`
  - `admin.members.role_update.failed`
  - `admin.members.remove.failed`
  - `admin.settings.update.failed`
  - `admin.insights.read.failed`
  - `admin.jobs.read.failed`
  - `jobs.process.failed`
  - `jobs.worker.crashed`
  - `jobs.auth_email.invitation_delivery.enqueue_failed`
  - `jobs.auth_email.password_recovery_delivery.enqueue_failed`
  - `observability.enqueue.failed`
  - `analytics.track.failed`
  - `analytics.identify.failed`
- Tenant-scoped operator UIs:
  - [admin insights page](/Users/atlas/Documents/Traxium/app/(app)/admin/insights/page.tsx) for health metrics, activation signals, and recent admin actions
  - [admin jobs page](/Users/atlas/Documents/Traxium/app/(app)/admin/jobs/page.tsx) for queued/processing/failed/completed job visibility
  - [admin settings page](/Users/atlas/Documents/Traxium/app/(app)/admin/settings/page.tsx) for recent admin audit entries
  - [admin members page](/Users/atlas/Documents/Traxium/app/(app)/admin/members/page.tsx) for pending invites and role/member posture

## Auth Incident Flow

- Check `/login`, `/forgot-password`, and `/reset-password` first. These should render without blank states or 5xxs.
- Call [auth bootstrap](/Users/atlas/Documents/Traxium/app/api/auth/bootstrap/route.ts) without a session and confirm it returns `401` or `403`, never `500`.
- If sign-in succeeds but routing is wrong, verify:
  - `NEXT_PUBLIC_APP_URL`
  - Supabase Auth redirect configuration from [environment-setup.md](/Users/atlas/Documents/Traxium/docs/environment-setup.md)
  - `auth.bootstrap.*` log events
- If forgot-password succeeds but no email arrives, jump to the jobs flow below and inspect `auth_email.password_recovery_delivery` jobs.

## Onboarding Incident Flow

- Check [onboarding page](/Users/atlas/Documents/Traxium/app/onboarding/page.tsx) and the APIs behind it:
  - `/api/onboarding/workspace`
  - `/api/onboarding/sample-data`
- If first-login users loop or fail to provision, search `auth.bootstrap.failed` and `auth.bootstrap.denied`.
- If workspace creation succeeded but the user cannot proceed, verify the active organization state from the dashboard and the workspace readiness card on [admin root](/Users/atlas/Documents/Traxium/app/(app)/admin/page.tsx).
- If sample data looks missing, confirm the active organization was correct before loading and then re-open dashboard and admin readiness surfaces.

## Invitation Incident Flow

- Check invitation creation from [invitations API](/Users/atlas/Documents/Traxium/app/api/invitations/route.ts) and the invite token resolution path:
  - `/api/invitations/[token]`
  - `/api/invitations/[token]/accept`
  - `/api/invitations/[token]/complete`
- Use [admin members](/Users/atlas/Documents/Traxium/app/(app)/admin/members/page.tsx) to confirm the invite appears under pending invitations.
- If resend fails, inspect [admin resend route](/Users/atlas/Documents/Traxium/app/api/admin/invitations/[invitationId]/resend/route.ts) logs.
- If the invite exists but delivery did not happen, open [admin jobs](/Users/atlas/Documents/Traxium/app/(app)/admin/jobs/page.tsx) and look for `auth_email.invitation_delivery` failures before retrying.

## Admin / RBAC Incident Flow

- Use [admin members](/Users/atlas/Documents/Traxium/app/(app)/admin/members/page.tsx) to validate member list, role changes, removals, and pending invite posture for the active workspace only.
- Use [admin settings](/Users/atlas/Documents/Traxium/app/(app)/admin/settings/page.tsx) to confirm workspace updates and recent audit rows.
- Relevant APIs for direct checks:
  - `/api/admin/members`
  - `/api/admin/members/[membershipId]`
  - `/api/admin/members/[membershipId]/role`
  - `/api/admin/settings`
  - `/api/admin/audit`
- If RBAC breaks after release, confirm the actor is still in the expected organization and search `admin.members.*.rejected` or `admin.settings.*.rejected` events.

## Observability / Analytics Incident Flow

- Open [admin insights](/Users/atlas/Documents/Traxium/app/(app)/admin/insights/page.tsx). This is the fastest tenant-scoped read on activation, recent admin actions, invitation velocity, and error signals.
- Search logs for:
  - `admin.insights.read.failed`
  - `observability.enqueue.failed`
  - `analytics.track.failed`
  - `analytics.identify.failed`
- Confirm the expected analytics events show up in the downstream sink after the smoke run:
  - `auth.login.succeeded`
  - `onboarding.workspace_created`
  - `invitation.sent`
  - `invitation.accepted`
  - `workspace.sample_data_loaded`
  - `admin.member_role_changed`

## Jobs / Worker Incident Flow

- Open [admin jobs](/Users/atlas/Documents/Traxium/app/(app)/admin/jobs/page.tsx) and inspect:
  - queued vs processing trend
  - fresh failed rows
  - retryable jobs
- Search worker/runtime logs for:
  - `jobs.worker.started`
  - `jobs.worker.finished`
  - `jobs.worker.crashed`
  - `jobs.process.failed`
  - `jobs.process.completed`
  - `jobs.auth_email.invitation_delivery.completed`
  - `jobs.auth_email.password_recovery_delivery.completed`
- Run `npm run jobs:worker:once` in the deployed worker environment when you need a safe one-shot drain or an immediate retry follow-up.
- If only async delivery is unhealthy while the web app is otherwise stable, contain the incident at the worker layer first rather than rolling back the whole web release immediately.

## Rollback Notes

- Code rollback:
  - Redeploy the previous known-good Vercel deployment or commit.
  - Re-run `scripts/postdeploy-smoke.ts` and the manual checks in [post-release-smoke-tests.md](/Users/atlas/Documents/Traxium/docs/post-release-smoke-tests.md).
- Migration caution:
  - If `npm run release:migrate` already ran, never answer by using `prisma migrate dev`.
  - Roll back code only when the migrated schema is backward-compatible with the previous app build.
  - If the migration itself caused the incident, prefer a forward corrective migration or restore from a verified backup.
- Environment rollback:
  - Restore the last known-good values for `APP_ENV`, app URL, Supabase keys/URLs, and database URLs.
  - Re-run `npm run predeploy` before re-deploying.
- Worker containment:
  - If the incident is isolated to queue processing, pause the long-lived worker or switch to controlled `jobs:worker:once` runs while the fix is prepared.
