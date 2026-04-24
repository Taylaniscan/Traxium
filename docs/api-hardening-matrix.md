# API Hardening Matrix

This matrix reflects the current `app/api/**` implementation as of 2026-03-27. It documents protections that are actually enforced in code today, not aspirational controls.

## Route Matrix

| Route Family | Methods | Auth Required | Role Check | Validation | Tenant / Data Scope Check | Error Shape Standardized | Audit Log | Rate Limited | Quota Controlled | Overall Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/api/auth/bootstrap` | `POST` | Yes | No | N/A | Current authenticated user only | Yes | No | No | No | Strong | Repairs first-login workspace context and returns `{ error, code }` on auth denial. |
| `/api/auth/change-password` | `POST` | Yes | No | Yes | Current authenticated session only | Yes | No | Yes | No | Strong | Requires the current password, validates the next password locally, and uses the authenticated Supabase session for the final mutation. |
| `/api/auth/forgot-password` | `POST` | No | No | Yes | Public, IP-scoped only | Yes | No | Yes | No | Strong | Distributed, fail-closed limiter on IP; async email queue path stays controlled. |
| `/api/auth/reset-password` | `POST` | Reset session required | No | Yes | Supabase reset session only | Yes | No | Yes | No | Strong | Distributed, fail-closed limiter on IP before password mutation. |
| `/api/onboarding/workspace` | `POST` | Yes | No | Yes | Current authenticated user only | Yes | No | No | No | Strong | Idempotent service-layer provisioning path with explicit `code` values on onboarding/auth failure. |
| `/api/onboarding/sample-data` | `POST` | Yes | No | N/A | Active organization only | Yes | No | No | No | Good | Tenant-scoped sample data load plus analytics/observability events. |
| `/api/invitations` | `POST` | Yes | Yes | Yes | Active organization + invitation management checks | Yes | Yes | Yes | Yes | Strong | Service layer revokes prior pending invites, writes audit, tracks analytics, enforces quota, and is distributed-rate-limited. |
| `/api/invitations/[token]` | `GET` | No | No | Yes | Token-bound invitation lookup and invitation status checks | Yes | No | No | No | Strong | Returns invitation metadata on expired/revoked states so the invite screen can render the correct branch. |
| `/api/invitations/[token]/accept` | `POST` | Yes | No | Yes | Token + signed-in email + organization membership upsert | Yes | No | No | No | Good | Tenant-safe and idempotent; analytics emitted after acceptance, but no audit event is currently written. |
| `/api/invitations/[token]/complete` | `POST` | No | No | Yes | Token + invitation email ownership + organization membership creation | Yes | No | No | No | Good | New-user account setup path is validated and tenant-scoped; analytics/audit are not both present yet. |
| `/api/organizations/switch` | `POST` | Yes | No | Yes | Membership-bound active organization switch only | Yes | No | No | No | Strong | No explicit rate limit today; access is constrained by the authenticated membership graph. |
| `/api/admin/members` | `GET` | Yes | Yes | N/A | Active organization only | Yes | No | No | No | Strong | Returns only active-organization members and pending invites. |
| `/api/admin/members/[membershipId]/role` | `PATCH` | Yes | Yes | Yes | Active organization membership only | Yes | Yes | Yes | No | Strong | Last-owner protection and cross-tenant role mutation checks live in the service layer. |
| `/api/admin/members/[membershipId]` | `DELETE` | Yes | Yes | Yes | Active organization membership only | Yes | Yes | Yes | No | Strong | Last-owner removal is blocked; mutation is now distributed-rate-limited. |
| `/api/admin/invitations/[invitationId]` | `DELETE` | Yes | Yes | Yes | Active organization invitation only | Yes | Yes | Yes | No | Strong | Revoke path is tenant-scoped, audited, and rate-limited. |
| `/api/admin/invitations/[invitationId]/resend` | `POST` | Yes | Yes | Yes | Active organization invitation only | Yes | Yes | Yes | No | Strong | Resend path preserves tenant isolation, async delivery, audit logging, and distributed throttling. |
| `/api/admin/settings` | `GET`, `PATCH` | Yes | Yes | `PATCH`: Yes | Active organization only | Yes | `PATCH`: Yes | `PATCH`: Yes | No | Strong | GET is read-only; PATCH writes audit, keeps tenant scoping, and is now throttled. |
| `/api/admin/audit` | `GET` | Yes | Yes | N/A | Active organization only | Yes | No | No | No | Strong | Read endpoint over tenant-scoped audit events; no write-side audit because the route is read-only. |
| `/api/admin/insights` | `GET` | Yes | Yes | N/A | Active organization only | Yes | No | No | No | Strong | Tenant-scoped metrics only; no rate limit today because it is already auth + role constrained and read-only. |
| `/api/admin/jobs` | `GET` | Yes | Yes | Partial | Active organization only | Yes | No | No | No | Good | Query parsing is simple and safe; payloads are sanitized before returning. |
| `/api/admin/jobs/[jobId]/retry` | `POST` | Yes | Yes | Partial | Active organization only | Yes | No | Yes | No | Good | Retry path is tenant-scoped and rate-limited; explicit audit logging is not currently written. |
| `/api/saving-cards` | `GET`, `POST` | Yes | No | `POST`: Yes | Active organization only | Yes | `POST`: Yes | `POST`: Yes | `POST`: Yes | Strong | Create path writes audit via service layer, enforces saving-card quota, and is throttled by org + user. |
| `/api/saving-cards/[id]` | `PUT`, `PATCH`, `POST` | Yes | Action-dependent | Yes | Active organization only | Yes | Yes | `PUT`/`POST`: Yes | No | Strong | `PUT` updates card data without allowing direct phase mutation, `POST` handles finance-lock actions, and `PATCH` intentionally rejects direct phase mutation. |
| `/api/saving-cards/[id]/volume/import` | `POST` | Yes | No | Yes | Active organization card only | Yes | No | Yes | No | Good | Tenant-safe CSV / XLSX import with distributed throttling; no audit event is written today. |
| `/api/phase-change-request` | `POST` | Yes | No | Yes | Active organization saving card only | Yes | Yes | No | No | Good | Canonical phase-change entry point. Workflow service enforces tenant scope, sequential transitions, required approvers, and workflow audit trail. |
| `/api/approve-phase-change` | `POST` | Yes | Yes | Yes | Active organization request only | Yes | Yes | No | No | Good | Canonical approval path. Approval permission checks and final phase mutation are enforced in workflow service logic. |
| `/api/pending-approvals` | `GET` | Yes | No | N/A | Active organization + current approver only | Yes | No | No | No | Strong | Read-only, tenant-scoped approval queue. |
| `/api/command-center` | `GET` | Yes | No | Yes | Active organization only | Yes | No | No | No | Strong | Filter parsing rejects duplicate query parameters and invalid filter shapes. |
| `/api/import` | `POST` | Yes | Yes | Yes | Active organization only | Yes | Yes | Yes | Yes | Strong | XLSX import validates every normalized row, enforces quota, and writes audit indirectly through create flow. |
| `/api/export` | `GET` | Yes | No | N/A | Active organization only | Yes | No | Yes | No | Good | Read-only XLSX export is now distributed-rate-limited to reduce scraping and burst export abuse. |
| `/api/upload/evidence` | `POST` | Yes | Partial | Yes | Active organization + saving-card access rules | Yes | Yes | Yes | Yes | Strong | File metadata, extension, content type, and quota are enforced before storage write. |
| `/api/evidence/[id]/download` | `GET` | Yes | Partial | Yes | Active organization + saving-card access rules | Yes | Yes | No | No | Strong | Signed URL only after tenant and managed-storage validation. |
| `/api/billing/checkout` | `POST` | Yes | Membership required | Yes | Active organization billing customer + plan catalog | Yes | No | No | No | Good | Server-side plan / price validation and tenant-bound Stripe session creation. |
| `/api/billing/portal` | `POST` | Yes | Membership required | N/A | Active organization billing customer only | Yes | No | No | No | Good | Tenant-bound Stripe portal session creation. |
| `/api/billing/webhook` | `POST` | Stripe signature | N/A | Signature + event parsing | Idempotent Stripe event storage + organization-scoped sync | Yes | Webhook event log | N/A | No | Strong | Signature verification is mandatory; duplicate event ids are safely ignored. |

## Protection Notes

### App-layer controls

- Auth guards are enforced in route handlers and service-layer helpers such as `requireOrganization`, `requirePermission`, `requireUser`, and invitation/account setup flows.
- Tenant isolation is primarily enforced by Prisma `where` clauses, organization-aware service helpers, and invitation / membership graph checks.
- Validation is handled through `zod` or explicit request-shape checks at the route boundary.
- Distributed throttling is now implemented in the app layer through the shared `RateLimitBucket` PostgreSQL store.

### Infrastructure-level controls

- CDN / WAF style coarse IP throttling is not represented here; this matrix only covers protections inside the app codebase.
- Browser hardening headers are configured in `next.config.ts`, not per-route handlers.
- Supabase Auth, storage signed URLs, and Stripe webhook signatures provide external-provider enforcement in addition to app logic.

### Current hardening gaps that remain

- Read-heavy admin endpoints such as insights, audit, and jobs list rely on auth + RBAC + tenant scoping today, but do not add an additional app-layer rate limit.
- Invitation acceptance and invite-account setup flows emit analytics and observability events but do not currently write a dedicated audit event.
- Job retry mutations are tenant-scoped and rate-limited, but do not currently append a first-class audit log entry.
