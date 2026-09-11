# Traxium Security One-Pager (Paid Pilot)

For the buyer's IT/security reviewer. This is a one-page summary of the paid-pilot security boundary. It is a product and technical boundary document, **not** a certification report, legal opinion, DPA, or guarantee. The authoritative detail is `../trust-pack.md`; the joint review is `../paid-pilot-security-review-checklist.md`.

## Tenant isolation
- All application data is scoped to the active workspace (internally, an organization identifier).
- Users require an active workspace membership before accessing any workspace data.
- Server routes and service helpers resolve the active organization and include it in queries and mutations; membership/tenant checks run before workspace admin, billing, saving-card, import/export, and evidence actions.
- Cross-tenant query and mutation tests verify that another workspace's records are rejected.
- Isolation is implemented in application authorization and Prisma query constraints. It is **not** described as database row-level security unless separately implemented and proven.

## Evidence storage and downloads
- Evidence files are stored in a **private** Supabase Storage bucket when provider storage is configured.
- Traxium stores evidence metadata and a managed provider path — **not** a public file URL.
- Browser downloads go through the authenticated app route `/api/evidence/{id}/download`; the app validates the bucket and the organization/saving-card namespace, then signs a link **server-side that expires after 60 seconds**.
- Cross-tenant access, path traversal, malformed paths, and bucket mismatch are rejected.
- Uploads enforce allowed file extensions/content types, non-empty files, a 25 MB per-file limit, a 10-file batch limit, usage quota, and rate limiting.
- The private-bucket setting and anonymous/public denial must be validated in each Supabase environment before buyer evidence is used there.

## Payment data
- Stripe manages payment collection, payment methods, Checkout, and the customer billing portal.
- Traxium stores only the Stripe customer/subscription identifiers and subscription status needed to map billing access to a workspace.
- Payment-card and bank-account details are **not** stored in Traxium.
- Preview uses Stripe test mode; production uses Stripe live mode; deployment checks reject mixed/inappropriate provider modes.

## Role model
- Workspace Owner/Admin roles manage settings, members, invitations, and billing where allowed; Members do not get billing access from membership alone.
- Business roles (Procurement Lead, Category Owner, Buyer, Procurement Analyst, Finance Reviewer) govern ownership, approval responsibility, and saving-card access.
- Finance validation and finance-lock behavior are role-aware; phase changes are governed by the canonical phase-change request and approval flow. A role does not bypass the workspace boundary.

## Auditability
- Supported actions create organization-scoped audit events (evidence upload/download, saving-card create/update, phase-change requests/approvals/history, finance locks, member/role changes, settings changes, import outcomes, and selected billing/admin events).
- Audit payloads are sanitized — no provider secrets, auth tokens, full signed URLs, payment data, or file contents.
- The Admin Activity surface shows supported audit events. Traxium does **not** promise a complete immutable SIEM archive or an export of every historical technical log.

## Export, data-out, and offboarding
- Controller-review XLSX export is available from Reports (portfolio, saving cards, classification, finance locks, evidence coverage, workflow/reporting metadata).
- Export **excludes** signed URLs, storage paths, bucket names, provider IDs, auth tokens, service keys, and unrelated-tenant data.
- The standard workbook does **not** include evidence-file binaries, a complete audit archive, or deleted-record history.
- There is **no** self-service full-workspace archive, automated offboarding workflow, self-service permanent-deletion workflow, or published retention schedule. Deletion is a reviewed, scoped, manual process agreed before the pilot ends.
- Backup/restore depends on the configured hosting/data providers; Traxium does not independently prove backup schedule, point-in-time recovery, or restoration, and offers **no** formal RPO/RTO during paid pilots.

## Support boundary
- Business-hours, email-based support through a designated pilot address with named Traxium and buyer contacts.
- Best-effort same-business-day attention for critical access/billing/evidence/export issues; one-business-day target for normal questions. These are operating targets, not guaranteed SLA commitments.
- Suspected cross-tenant access or secret exposure is escalated immediately and is never investigated with real unrelated customer data.
- **Not** 24/7 support; **no** enterprise SLA unless separately agreed in writing.

## Explicit non-claims
Traxium does not currently include or claim: SOC 2 certification, ISO 27001 certification, HIPAA compliance, an attorney-reviewed GDPR/DPA determination, SSO/SAML, SCIM, ERP/MRP integration, accounting-system posting, audited accounting recognition or guaranteed savings, custom approval builders, vendor risk scoring, contract lifecycle management, broad spend analytics, a custom BI/data-warehouse feed, 24/7 support, or an enterprise SLA.

## Proof status (be honest in review)
Local application security/trust tests cover tenant access, evidence paths, signed-link lifetime, quotas, rate limits, audit events, export redaction, and billing/provider-mode guards. Guarded Supabase and Stripe scripts exist. A complete preview provider-flow pass and a production smoke pass have not been recorded, and Stripe webhook delivery remains unproven. Local tests and provider scripts must not be presented as a production security certification. The authoritative proof record is `../readiness-proof-log.md`.
