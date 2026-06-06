# Traxium Runtime Inventory

Inventory date: 2026-06-06

This document records repository surfaces. It does not certify that they work.
At inventory time the repository had extensive pre-existing modified and
untracked files. Those changes were preserved.

## Configuration Baseline

- Framework: Next.js 15.2.4, React 19, TypeScript 5.8
- Database: PostgreSQL through Prisma 6.5
- Auth/storage: Supabase
- Billing: Stripe
- Unit/integration runner: Vitest
- Browser runner: none configured
- Playwright dependency/configuration: absent
- HTTP middleware: Supabase session refresh for non-API page requests
- Security headers: CSP, frame denial, MIME sniffing denial, referrer policy,
  permissions policy, COOP/CORP, and production HSTS

## A. App Route Inventory

### Public

| Route | Source | Purpose | Browser proof |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Marketing homepage; redirects authenticated users | No |
| `/pilot` | `app/pilot/page.tsx` | Guided paid-pilot lead capture | No |
| `/request-demo` | `app/request-demo/page.tsx` | Demo request entry page | No |
| `/trust` | `app/trust/page.tsx` | Trust/security statements | No |
| `/onboarding` | `app/onboarding/page.tsx` | First workspace provisioning for authenticated identity | No |

### Authentication and Invitation

| Route | Source | Purpose | Browser proof |
| --- | --- | --- | --- |
| `/login` | `app/login/page.tsx` | Password login | No |
| `/logout` | `app/logout/route.ts` | Supabase sign-out; GET and POST | No |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password recovery request | No |
| `/reset-password` | `app/reset-password/page.tsx` | Recovery-session password replacement | No |
| `/auth/bootstrap` | `app/auth/bootstrap/page.tsx` | Post-auth application bootstrap | No |
| `/invite/:token` | `app/invite/[token]/page.tsx` | Invitation review/acceptance/account setup | No |

### Protected Application

| Route | Source | Purpose | Browser proof |
| --- | --- | --- | --- |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Portfolio dashboard | No |
| `/saving-cards` | `app/(app)/saving-cards/page.tsx` | Saving-card list and filtered views | No |
| `/saving-cards/new` | `app/(app)/saving-cards/new/page.tsx` | Saving-card creation | No |
| `/saving-cards/:id` | `app/(app)/saving-cards/[id]/page.tsx` | Saving-card detail/workflow/evidence | No |
| `/saving-cards/:id/edit` | `app/(app)/saving-cards/[id]/edit/page.tsx` | Saving-card editing | No |
| `/kanban` | `app/(app)/kanban/page.tsx` | Portfolio phase board | No |
| `/open-actions` | `app/(app)/open-actions/page.tsx` | Pending actions and approvals | No |
| `/command-center` | `app/(app)/command-center/page.tsx` | Blockers and operating review | No |
| `/timeline` | `app/(app)/timeline/page.tsx` | Savings and volume timeline | No |
| `/reports` | `app/(app)/reports/page.tsx` | Executive reporting and import/export | No |
| `/profile` | `app/(app)/profile/page.tsx` | User profile and password access | No |
| `/billing-required` | `app/billing-required/page.tsx` | Subscription recovery gate | No |

### Administration

| Route | Source | Purpose | Browser proof |
| --- | --- | --- | --- |
| `/admin` | `app/(app)/admin/page.tsx` | Legacy/combined workspace administration | No |
| `/admin/members` | `app/(app)/admin/members/page.tsx` | Membership and invitation management | No |
| `/admin/settings` | `app/(app)/admin/settings/page.tsx` | Workspace and billing settings | No |
| `/admin/insights` | `app/(app)/admin/insights/page.tsx` | Administrative activation/health metrics | No |
| `/admin/jobs` | `app/(app)/admin/jobs/page.tsx` | Job health and retry operations | No |

### Billing

| Route | Source | Purpose | Browser proof |
| --- | --- | --- | --- |
| `/settings/billing` | `app/settings/billing/page.tsx` | Subscription status, checkout, portal, recovery | No |
| `/billing/recover` | `app/billing/recover/route.ts` | Owner/Admin billing recovery router | No |

### Debug/Internal

No explicit debug page or debug API route was found. `/admin/jobs` and
`/admin/insights` are privileged operational surfaces, not public debug routes.

## B. API Route Inventory

`Tests` means repository tests reference the route or its handler. It does not
mean real HTTP or browser execution. `Runtime` is `No` for every row at inventory
time.

| Route | Method | Auth | Role/permission | Tenant scoped | Mutates | Provider | Tests | Runtime |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/admin/audit` | GET | Organization session | Owner/Admin | Yes | No | None | Yes | No |
| `/api/admin/insights` | GET | Organization session | Owner/Admin | Yes | No | None | Yes | No |
| `/api/admin/invitations/:invitationId/resend` | POST | Organization session | Owner/Admin in service | Yes | Yes | Jobs/email | Yes | No |
| `/api/admin/invitations/:invitationId` | DELETE | Organization session | Owner/Admin in service | Yes | Yes | None | Yes | No |
| `/api/admin/jobs/:jobId/retry` | POST | Organization session | Owner/Admin | Yes | Yes | Worker/job | Yes | No |
| `/api/admin/jobs` | GET | Organization session | Owner/Admin | Yes | No | Worker/job | Yes | No |
| `/api/admin/members/:membershipId/role` | PATCH | Organization session | Owner/Admin in service | Yes | Yes | None | Yes | No |
| `/api/admin/members/:membershipId` | DELETE | Organization session | Owner/Admin in service | Yes | Yes | None | Yes | No |
| `/api/admin/members` | GET | Organization session | Owner/Admin | Yes | No | None | Yes | No |
| `/api/admin/settings` | GET, PATCH | Organization session | Owner/Admin | Yes | PATCH | None | Yes | No |
| `/api/approve-phase-change` | POST | User session | Required workflow approver | Yes | Yes | None | Yes | No |
| `/api/auth/bootstrap` | POST | Supabase identity in service | Authenticated identity | Yes after bootstrap | Yes | Supabase | Yes | No |
| `/api/auth/change-password` | POST | User and Supabase session | Any active user | Yes for audit | Yes | Supabase | Yes | No |
| `/api/auth/forgot-password` | POST | Public | None | N/A | Yes | Supabase/email | Yes | No |
| `/api/auth/login` | POST | Public | None | N/A | Yes | Supabase | Yes | No |
| `/api/auth/reset-password` | POST | Supabase recovery session | Recovery user | N/A | Yes | Supabase | Yes | No |
| `/api/billing/checkout` | POST | Organization session | Owner/Admin | Yes | Yes | Stripe | Yes | No |
| `/api/billing/portal` | POST | Organization session | Owner/Admin | Yes | Yes | Stripe | Yes | No |
| `/api/billing/webhook` | POST | Stripe signature | Provider event | Derived from event | Yes | Stripe | Yes | No |
| `/api/command-center` | GET | User session | Workspace viewer | Yes | No | None | Yes | No |
| `/api/evidence/:id/download` | GET | User session | Global or stakeholder/buyer access | Yes | No | Supabase Storage | Yes | No |
| `/api/export` | GET | User session | Export permission enforced by builder/query path | Yes | No | XLSX | Yes | No |
| `/api/import` | POST | Organization session | Owner/Admin or manage-workspace permission | Yes | Yes | XLSX/jobs | Yes | No |
| `/api/invitations/:token/accept` | POST | Invitation token plus identity rules | Invite recipient | Token-bound | Yes | Jobs/email | Yes | No |
| `/api/invitations/:token/complete` | POST | Invitation token | Invite recipient/account setup | Token-bound | Yes | Supabase/email | Yes | No |
| `/api/invitations/:token` | GET | Invitation token | Invite recipient | Token-bound | No | None | Yes | No |
| `/api/invitations` | POST | Organization session | Owner/Admin in service | Yes | Yes | Jobs/email | Yes | No |
| `/api/notifications` | GET, POST | User session | Current user | Yes | POST | None | Yes | No |
| `/api/onboarding/master-data-template/:entity` | GET | Public | None | N/A, static template | No | CSV | Yes | No |
| `/api/onboarding/master-data` | POST | Organization session | Owner/Admin or manage-workspace permission | Yes | Yes | None | Yes | No |
| `/api/onboarding/sample-data` | POST | User session | Active workspace user | Yes | Yes | None | Yes | No |
| `/api/onboarding/workspace` | POST | Supabase identity in service | User without workspace | New tenant | Yes | Supabase/DB | Yes | No |
| `/api/organizations/switch` | POST | Supabase identity in service | Active target membership | Yes | Yes | None | Yes | No |
| `/api/pending-approvals` | GET | User session | Current approver | Yes | No | None | No direct test | No |
| `/api/phase-change-request` | POST | User session | Saving-card manager | Yes | Yes | None | Yes | No |
| `/api/pilot-leads` | POST | Public | None | N/A | Yes | DB | Yes | No |
| `/api/saving-cards/:id/alternative-materials/:alternativeId` | PUT, DELETE | User session | Saving-card manager | Yes | Yes | None | Yes | No |
| `/api/saving-cards/:id/alternative-materials` | POST | User session | Saving-card manager | Yes | Yes | None | Yes | No |
| `/api/saving-cards/:id/alternative-suppliers/:alternativeId` | PUT, DELETE | User session | Saving-card manager | Yes | Yes | None | Yes | No |
| `/api/saving-cards/:id/alternative-suppliers` | POST | User session | Saving-card manager | Yes | Yes | None | Yes | No |
| `/api/saving-cards/:id` | PUT, PATCH, POST | User session | Manager; finance lock restricted | Yes | Yes | None | Yes | No |
| `/api/saving-cards/:id/volume/actual` | POST, DELETE | User session | Saving-card access | Yes | Yes | None | No direct test | No |
| `/api/saving-cards/:id/volume/forecast` | POST, DELETE | User session | Saving-card access | Yes | Yes | None | No direct test | No |
| `/api/saving-cards/:id/volume/import` | POST | User session | Saving-card access | Yes | Yes | CSV | No direct test | No |
| `/api/saving-cards/:id/volume` | GET | User session | Saving-card access | Yes | No | None | No direct test | No |
| `/api/saving-cards` | GET, POST | User session | Viewer/manager by operation | Yes | POST | None | Yes | No |
| `/api/upload/evidence` | POST | User session | Global or stakeholder/buyer access | Yes | Yes | Supabase Storage | Yes | No |
| `/api/volume/portfolio` | GET | User session | Workspace viewer | Yes | No | None | No direct test | No |
| `/billing/recover` | POST | Organization session | Owner/Admin | Yes | Yes | Stripe | Yes | No |
| `/logout` | GET, POST | Supabase session | Authenticated user | N/A | Yes | Supabase | Yes | No |

No explicit DELETE saving-card API was found.

## C. Critical Component Inventory

| Product surface | Primary component(s) |
| --- | --- |
| App shell | `components/layout/app-shell.tsx`, `components/layout/app-shell-client.tsx`, `components/layout/notification-bell.tsx` |
| Dashboard | `components/dashboard/dashboard-client.tsx`, `components/dashboard/dashboard-primitives.tsx` |
| Saving-card form | `components/saving-cards/saving-card-form.tsx`, `components/saving-cards/creatable-master-data-field.tsx` |
| Saving-card detail | `components/saving-cards/detail-workspace.tsx`, `components/saving-cards/results-tab.tsx`, `components/saving-cards/approval-panel.tsx` |
| Evidence uploader | `components/saving-cards/evidence-uploader.tsx` |
| Kanban | `components/kanban/kanban-board.tsx` |
| Reports | `components/reports/executive-savings-summary.tsx` |
| Import/export | `components/reports/import-export-panel.tsx` |
| Billing card | `components/billing/workspace-billing-settings-card.tsx`, `components/billing/billing-recovery-form.tsx`, `components/billing/workspace-billing-summary.tsx` |
| Onboarding | `components/onboarding/workspace-onboarding-form.tsx`, `components/onboarding/first-value-launchpad.tsx`, `components/onboarding/workspace-setup-guide.tsx` |
| Admin Members | `components/admin/members-management.tsx` and member/invitation action controls |
| Workspace Settings | `components/admin/workspace-settings-form.tsx` |
| Pilot lead form | `components/pilot/pilot-lead-form.tsx` |

Additional critical presentation components include the saving-card table,
command-center client, open-actions list, timeline board/volume curve, invitation
flow, login/recovery forms, and admin jobs/health panels.

## D. Script Inventory

### Environment and Deployment

- `scripts/check-env.ts`: required local/runtime environment validation
- `scripts/check-prisma-env.mjs`: database URL validation and Supabase host warning
- `scripts/predeploy-check.ts`: deployment/provider separation and secret-shape checks
- `scripts/postdeploy-smoke.ts`: HTTP smoke checks against a deployed base URL
- `scripts/clean-next-artifacts.mjs`: removes Next.js build artifacts

### Seed and Demo

- `prisma/seed.ts`: general seed entry point
- `scripts/seed-utopiatrax-demo.ts`: resettable UtopiaTrax workspace, users,
  cards, approvals, evidence, billing, and optional provider identities/storage
- `scripts/utopiatrax-demo-contract.ts`: static and persisted demo requirements
- `scripts/validate-utopiatrax-demo.ts`: persisted UtopiaTrax health validation
- `scripts/export-utopiatrax-controller-workbook.ts`: demo workbook export

### Provider Validation

- `scripts/validate-stripe-provider.ts`: Stripe catalog and provider-flow exercise
- `scripts/validate-supabase-provider.ts`: Supabase JWT, auth/storage, and evidence
  path validation

### Worker

- `scripts/run-job-worker.ts`: worker loop, one-shot processing, and health check

## E. Test Inventory

There are 154 Vitest test files:

| Domain | Files | Evidence level |
| --- | ---: | --- |
| API handlers/contracts | 38 | Mock/in-process handler proof |
| App server pages/routes | 22 | Mock-render/import proof |
| Components | 25 | React/static/runtime harnesses, not browser |
| Libraries/domain logic | 30 | Unit proof |
| Integration | 4 | In-process mocked integration proof |
| Database schema/contracts | 7 | Schema/static proof |
| CI/release contracts | 5 | Script/config contract proof |
| Documentation | 18 | Text contract proof |
| Configuration | 1 | Static configuration proof |
| Performance | 1 | Query-shape/mock proof |
| Scripts | 2 | Script contract proof |
| Middleware | 1 | Mock routing proof |

Coverage is concentrated in saving-card APIs, import/evidence, workflow, billing,
auth guards, rate limiting, tenant-scope helpers, dashboard/Kanban components,
and documentation claims.

Material test gaps at inventory time:

- no Playwright or equivalent browser suite
- no real login/session browser bootstrap
- no browser console/network watchdog
- no browser route crawler
- no browser persona/RBAC matrix
- no explicit consolidated cross-tenant attack suite
- no explicit consolidated API fuzz suite
- no direct tests identified for pending approvals or volume route handlers
- no executed provider proof established by inventory
- no executed seeded database proof established by inventory

Accordingly, existing UI coverage is `NOT BROWSER-PROVEN`; provider-related unit
coverage is at most `MOCK-PROVEN ONLY` until provider scripts execute successfully.
