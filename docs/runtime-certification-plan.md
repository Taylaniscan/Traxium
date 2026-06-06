# Traxium Runtime Certification Plan

## 1. Scope

This certification attempts to prove Traxium's public, authentication, onboarding,
procurement savings, workflow, evidence, reporting, administration, billing,
provider, worker, and UtopiaTrax demo behavior end to end.

The certification does not infer readiness from route existence, documentation,
unit tests, mocks, static rendering, or successful compilation. Each result must
identify the evidence actually obtained.

## 2. Environments Required

- Local development or production-mode Next.js application
- Test database with migrations applied
- Seeded UtopiaTrax and hostile second-tenant workspaces
- Browser runtime supported by Playwright or an equivalent real browser
- Supabase project and credentials for provider authentication/storage proof
- Stripe test-mode account, prices, webhook secret, and customer/subscription data
- Email delivery provider or an inspectable local provider substitute
- Background worker/job queue runtime

Missing infrastructure blocks only the dependent proof and must not be reported
as a pass.

## 3. Test Personas

1. Owner/Admin and Procurement Lead
2. Finance Reviewer
3. Category Owner
4. Buyer
5. Normal Member
6. Unauthenticated visitor
7. Authenticated user belonging only to a foreign workspace

Every authenticated persona requires a known user identity, workspace membership,
role, and repeatable login mechanism.

## 4. Test Workspaces

- **UtopiaTrax**: populated demo and primary certification tenant
- **EvilTenant / OtherWorkspace**: isolated hostile tenant used for cross-tenant
  read, write, download, relation, export, administration, and billing attacks
- **Fresh Workspace**: empty tenant used to prove onboarding and first value

## 5. Route Inventory

The repository inventory must enumerate all routes under `app/` and classify each
as public, authentication, protected application, administration, billing, API,
provider/webhook, or debug/internal. Dynamic routes and route groups must be
resolved to their effective URLs.

Primary browser routes expected for certification:

- `/`
- `/pilot` when implemented
- `/trust` when implemented
- `/login`
- `/forgot-password`
- `/dashboard`
- `/saving-cards`
- `/saving-cards/new`
- `/kanban`
- `/open-actions`
- `/command-center`
- `/timeline`
- `/reports`
- `/onboarding`
- `/admin/members`
- `/admin/settings`
- `/settings/billing`

## 6. API Inventory

Every route handler must be recorded with:

- HTTP methods
- authentication requirement
- required role or permission
- tenant-scoping mechanism
- mutation behavior
- provider dependencies
- existing automated test coverage
- executed runtime evidence

Special attention is required for saving cards, evidence, import/export, workflow,
approvals, invitations, members, workspace settings, billing, pilot leads,
password reset, webhooks, and internal/debug handlers.

## 7. Critical User Flows

- Public homepage and paid-pilot lead submission
- Login, authentication bootstrap, password reset, and logout
- Workspace switching
- Invitation creation, delivery job, acceptance, and role assignment
- Fresh-workspace onboarding and first saving-card creation
- Inline buyer, supplier, material, and category creation
- Saving-card create, edit, detail, validation, and cancellation
- Evidence upload, listing, authorization, download, and audit
- Phase requests, approval/rejection, history, and finance lock
- Dashboard, Kanban, Open Actions, Command Center, Timeline, and Reports
- Spreadsheet import and controller export
- Member administration and workspace settings
- Billing settings, recovery, checkout, portal, and webhook state updates
- UtopiaTrax demo population and all demo-critical pages
- Trust, security, support, provider-validation, worker, and job-health claims

## 8. Role Matrix

| Capability | Owner/Admin | Finance Reviewer | Category Owner | Buyer | Member | Unauthenticated |
| --- | --- | --- | --- | --- | --- | --- |
| View tenant procurement data | Expected | Expected | Expected, scoped if implemented | Expected, scoped if implemented | Expected, scoped if implemented | Denied |
| Create/edit saving cards | Expected | Policy-dependent | Expected | Expected | Policy-dependent | Denied |
| Approve workflow | Policy-dependent | Expected for finance gates | Policy-dependent | Denied unless explicit | Denied | Denied |
| Apply finance lock | Policy-dependent | Expected | Denied | Denied | Denied | Denied |
| Upload/download evidence | Expected | Expected | Expected, scoped if implemented | Expected, scoped if implemented | Policy-dependent | Denied |
| Import/export | Expected | Policy-dependent | Policy-dependent | Policy-dependent | Denied unless explicit | Denied |
| Invite/manage members | Expected | Denied | Denied | Denied | Denied | Denied |
| Change workspace settings | Expected | Denied | Denied | Denied | Denied | Denied |
| Manage billing | Expected | Denied | Denied | Denied | Denied | Denied |

Repository policy is authoritative only after it is identified and tested. Any
deviation that grants broader access requires explicit product justification.

## 9. Tenant Isolation Matrix

The foreign-workspace persona must attempt each operation against UtopiaTrax:

| Resource | Read | Create/link | Update | Delete/action | Download/export |
| --- | --- | --- | --- | --- | --- |
| Saving card | Required | Required | Required | Required where supported | N/A |
| Evidence | Metadata | Attach/link | Required where supported | Required where supported | Required |
| Dashboard/Reports | Required | N/A | N/A | N/A | Required |
| Command Center/Open Actions/Timeline | Required | N/A | N/A | Phase/approval action | N/A |
| Import relations | N/A | Required | N/A | N/A | N/A |
| Members | Required | Invite/add | Role update | Remove | N/A |
| Workspace settings | Required | N/A | Required | N/A | N/A |
| Billing | Required | Checkout/recovery | Portal/action | N/A | N/A |

Safe outcomes are `403` or non-enumerating `404`, with no names, identifiers,
metadata, storage paths, provider IDs, timing hints, or partial writes leaked.

## 10. Provider Dependency Matrix

| Provider | Dependent proof | Required evidence | Missing-credential status |
| --- | --- | --- | --- |
| Supabase Auth | Login, logout, reset, invite acceptance, session bootstrap | Real provider request and browser session behavior | BLOCKED BY CREDENTIALS |
| Supabase Storage | Evidence upload/download and private object enforcement | Real upload, signed access, public denial, foreign denial | BLOCKED BY CREDENTIALS |
| Stripe | Checkout, portal, recovery, webhook billing state | Stripe test-mode requests and signed webhook | BLOCKED BY CREDENTIALS |
| Email provider | Lead/invite/reset notification delivery | Provider acceptance or inspectable local delivery | BLOCKED BY CREDENTIALS |
| Database | All persistent product flows | Applied schema, seeded data, observed writes | BLOCKED BY ENVIRONMENT |
| Worker/queue | Notifications and asynchronous jobs | Enqueue, process, retry/idempotency, health check | BLOCKED BY ENVIRONMENT |

Provider mocks may establish application contracts but are reported as
`MOCK-PROVEN ONLY`, never provider proof.

## 11. Browser/Runtime Proof Requirements

A browser-proven route must:

- be visited in a real browser against a running app
- end at the intended URL or an explicitly documented redirect
- avoid unexpected `4xx`/`5xx` responses and failed requests
- produce no uncaught `console.error`, `pageerror`, unhandled rejection,
  hydration mismatch, or Next.js error overlay
- render non-blank content with an identifying heading/title
- expose expected primary actions and working client navigation

Failures must retain final URL, console output, failed request details, screenshot,
and trace/video when configured. Warning allowlists must be exact and documented.

## 12. Manual Proof Requirements

Manual inspection remains required for:

- visual hierarchy, clipping, overlap, contrast, and responsive layout
- buyer-facing terminology and credibility
- downloaded workbook opening in a standard spreadsheet application
- delivered email appearance and link correctness
- Stripe-hosted checkout/portal experience
- support and incident-response operational claims
- backup restoration, not merely backup creation
- accessibility behavior beyond automated checks

Manual items remain `NEEDS MANUAL PROOF` until observed and recorded.

## 13. Pass/Fail Rules

- **PASS**: Executed against the required runtime/provider with expected behavior
  and retained evidence.
- **FAIL**: Executed and observed to violate expected behavior.
- **PARTIAL**: Some required layers or cases passed, but material proof remains.
- **MOCK-PROVEN ONLY**: Passed only with mocked providers/data/runtime boundaries.
- **DOCUMENTED ONLY**: A claim or process exists only in documentation.
- **NOT BROWSER-PROVEN**: Static/integration evidence exists without browser proof.
- **BLOCKED BY CREDENTIALS**: Required provider credentials are unavailable.
- **BLOCKED BY ENVIRONMENT**: Required database, server, browser, worker, or network
  environment is unavailable or unusable.
- **NEEDS MANUAL PROOF**: Execution requires a human visual or operational check
  that has not been completed.

No status may be upgraded based on expected behavior. A test passing with mocked
data does not prove seeded data, browser behavior, provider behavior, or tenant
isolation. Unexpected console errors, request failures, dead controls, redirects,
empty demo-critical pages, privilege escalation, or tenant leakage are failures.

## 14. Blocker Definitions

- **P0 - blocks any demo**: build/start failure, broken login, route crash, broken
  saving-card creation, empty/broken UtopiaTrax, tenant/evidence leak, or absent
  demo-critical control.
- **P1 - blocks paid pilot**: unreliable import/export, broken invite/reset,
  provider flow not proven where required, leaked internals, false trust claim,
  RBAC defect, or billing recovery failure.
- **P2 - should fix soon**: weak empty state, confusing copy, secondary visual
  defect, or missing non-critical coverage.
- **P3 - can wait**: advanced polish or non-core enhancement.

Only proven P0/P1 defects are automatically fixed during this certification.
P2/P3 items are recorded without broad implementation changes.
