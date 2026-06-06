# Traxium Paid-Pilot Trust Pack

## Purpose

Traxium's trust package summarizes how workspace data, saving cards, evidence files, billing, user access, import, and export are handled during a guided paid pilot.

It is written for US manufacturing and industrial SME buyers, including CFOs, Controllers, Procurement Leads, Finance Reviewers, and IT/security reviewers. It is a product and technical boundary document, not a certification report, legal opinion, data processing agreement, or guarantee.

## Root-Cause Note

Traxium already had strong implementation-level material: tenant-isolation tests, an API hardening matrix, private evidence-storage controls, signed-download tests, Stripe and Supabase validation guides, controller-export safeguards, audit events, and paid-pilot support copy.

The buyer package was underassembled:

- The existing trust draft was short and implementation-heavy.
- A CFO or IT reviewer could not see one clear list of data stored and not stored.
- Payment-data boundaries, offboarding, evidence-export limits, backup assumptions, and provider-proof status were spread across separate engineering documents.
- Support targets existed in commercial documents but not in a standalone support contract.
- There was no public buyer-readable trust page.
- There was no automated guardrail against accidental enterprise or compliance overclaims.

This package joins those facts without changing the underlying security model or claiming that local tests equal preview or production proof.

## What Traxium Stores

Depending on the pilot scope and features used, Traxium stores:

- Workspace name, description, settings, and access state.
- Users, workspace memberships, membership roles, and business workflow roles.
- Buyers, suppliers, materials, categories, plants, and business units.
- Saving cards, business cases, commercial assumptions, classifications, dates, and calculated savings.
- Stakeholders, comments, alternative suppliers/materials, volume forecasts, and actual-volume rows.
- Phase-change requests, approvals, phase history, cancellation reasons, and finance-lock state.
- Evidence metadata such as file name, evidence type, file size, content type, uploader, upload date, and managed provider location.
- Evidence files in private provider storage when Supabase Storage is configured.
- Import outcomes, export-related audit/usage events where implemented, and controller-workbook data generated for the active workspace.
- Organization-scoped audit events for supported workflow, evidence, member, settings, billing, and administrative actions.
- Stripe customer/subscription identifiers and billing-state metadata needed to manage workspace access.
- Public paid-pilot lead details submitted through the `/pilot` form.

## What Traxium Does Not Store

Traxium does not store:

- Customer payment-card numbers, bank-account details, or Stripe payment-method data.
- Raw Stripe payment credentials.
- Supabase service-role keys or other provider secrets in customer-visible areas.
- Public evidence URLs.
- Signed evidence-download URLs as application records or export columns.
- ERP or MRP credentials.
- Accounting-system posting credentials.
- Buyer savings-tracker file attachments through the public paid-pilot request form.

Secrets remain server-side environment configuration and must not be included in logs, exports, screenshots, or buyer-facing responses.

## Workspace And Tenant Isolation

- Application data is scoped to the active workspace, represented internally by an organization identifier.
- Users require an active workspace membership before accessing workspace data.
- Server routes and service helpers resolve the active organization and include it in data queries and mutations.
- Membership and tenant checks are applied before workspace administration, billing, saving-card, import/export, and evidence actions.
- Cross-tenant query and mutation tests verify that records from another workspace are rejected.
- Evidence downloads require authentication, active-workspace ownership, and saving-card access before a signed provider link is created.
- Tenant isolation is implemented in application authorization and Prisma query constraints. It is not described as database row-level security unless separately implemented and proven.

## Roles And Permissions

Traxium separates workspace administration from business workflow responsibility.

- Workspace Owner/Admin roles manage workspace settings, members, invitations, and billing where allowed.
- Workspace Members do not receive billing-management access solely from membership.
- Procurement Lead, Category Owner, Buyer, Finance Reviewer, and related internal roles govern business ownership, approval responsibility, and saving-card access.
- Finance validation and finance-lock behavior are role-aware.
- Phase changes remain governed by the canonical phase-change request and approval flow.
- A role does not bypass the active workspace boundary.

Role assignments and the named finance reviewer should be agreed before live pilot data is entered.

## Evidence Security

- Evidence files are stored in a private Supabase Storage bucket when provider storage is configured.
- Traxium stores evidence metadata and a managed provider path, not a public file URL.
- Browser downloads go through the authenticated Traxium route `/api/evidence/{id}/download`.
- The app validates the configured bucket and the organization/saving-card namespace before signing.
- Signed storage links are created server-side and expire after 60 seconds.
- Cross-tenant access, path traversal, malformed paths, and bucket mismatch are rejected.
- Uploads enforce allowed file extensions and content types, non-empty files, a 25 MB per-file limit, a 10-file batch limit, usage quota, and distributed rate limiting.
- Evidence upload and download actions create organization-scoped audit events where the supported route completes successfully.
- Controller exports include evidence coverage metadata, not evidence URLs or storage paths.

Application tests prove these route and namespace controls. The private-bucket setting and anonymous/public denial must also be validated in each Supabase environment before buyer evidence is used there.

## Billing And Payments

- Stripe manages payment collection, payment methods, Checkout, and the customer billing portal.
- Traxium stores the Stripe customer/subscription identifiers and subscription status needed to map billing access to a workspace.
- Payment-card and bank-account details are not stored in Traxium.
- Workspace billing management is limited to authorized workspace roles.
- Billing recovery uses Stripe Checkout or the Stripe Customer Portal according to the workspace billing state.
- Preview must use Stripe test mode and production must use Stripe live mode. The deployment checks reject mixed or inappropriate provider modes.
- Local Stripe validation has created test-mode Checkout and Portal handoff objects. Webhook delivery and complete browser handoffs still require separate preview proof.

## Import And Export Boundaries

- Saving-card XLSX import validates every row before creating cards.
- Any row-validation failure creates no saving cards from that workbook.
- Valid saving-card rows are committed together in one database transaction.
- Relation matching and creation remain inside the active workspace.
- Operational imports create Proposed cards so workflow approvals are not bypassed.
- Export produces a controller-review XLSX workbook for the active workspace.
- Export includes portfolio, saving-card, finance-lock, classification, evidence-coverage, workflow, and reporting metadata.
- Export excludes signed URLs, storage paths, bucket names, provider IDs, auth tokens, service keys, and unrelated-tenant data.
- Import/export is not ERP synchronization, accounting posting, a public extraction API, or a custom data-warehouse feed.

## Logging And Auditability

Supported key actions can create organization-scoped audit events. Examples include:

- Evidence upload and download.
- Saving-card creation and updates.
- Phase-change requests, approvals, and workflow history.
- Finance-lock actions.
- Member invitations, role changes, and removals.
- Workspace settings changes.
- Import outcomes and selected billing/admin events where implemented.

Audit and observability payloads are sanitized. They must not contain provider secrets, auth tokens, full signed URLs, payment-method data, or sensitive file contents.

The Admin Activity surface displays supported organization-scoped audit events. Traxium does not currently promise a complete immutable security-information-and-event-management archive or an export of every historical technical log.

## Provider Validation Status

Traxium separates four kinds of proof:

1. Local application tests for route behavior, authorization, tenant scope, redaction, and business rules.
2. Guarded provider scripts for configured Supabase and Stripe environments.
3. Manual preview/browser proof.
4. Minimal controlled production smoke proof.

Current recorded status as of June 5, 2026:

- Local application security and trust tests cover tenant access, evidence paths, signed-link lifetime, quotas, rate limits, audit events, export redaction, billing permissions, and provider-mode guards.
- `npm run supabase:validate` recorded 8 passed checks, 0 failed checks, and 1 blocked Auth redirect allow-list check. The redirect allow-list still requires a dashboard or Management API review.
- Stripe test-mode Product/Price checks and guarded Checkout/Portal object creation passed locally.
- Stripe webhook-secret configuration and real webhook delivery remain unproven.
- A complete preview provider-flow checklist has not been recorded.
- A production provider smoke pass has not been recorded.

The authoritative proof record is [readiness-proof-log.md](/Users/atlas/Documents/Traxium/docs/readiness-proof-log.md). Local tests and provider scripts must not be presented as a production security certification.

## Support Expectations For Paid Pilots

- Support is provided during agreed business hours through the designated pilot support email and named pilot contact.
- Critical login, workspace-access, billing-access, or evidence-availability issues receive best-effort same-business-day attention.
- Normal workflow, reporting, import, export, master-data, and usability questions target a response within one business day.
- Product feedback and enhancement requests are reviewed during regular pilot check-ins.
- Provider outages may require coordination with Supabase, Stripe, Vercel, or another configured provider.
- Paid-pilot support is not 24/7 support and does not include an enterprise SLA unless separately agreed in writing.

The detailed boundary is in [support-expectations.md](/Users/atlas/Documents/Traxium/docs/support-expectations.md).

## Data Export And Offboarding

- A customer can export the controller-review workbook containing saving-card and portfolio data available through the Reports flow.
- The standard workbook does not include evidence-file binaries, a complete audit archive, deleted-record history, or provider-internal objects.
- Evidence-file collection or archive support may require a manual, separately agreed process depending on the configured storage provider and pilot scope.
- There is no self-service full-workspace archive or automated offboarding workflow.
- There is no self-service permanent-deletion workflow or published retention schedule in the current product.
- Any deletion request must be reviewed, scoped, and executed through an approved manual process. This trust pack is not a legal data-retention policy or DPA.

See [data-export-offboarding.md](/Users/atlas/Documents/Traxium/docs/data-export-offboarding.md) for the detailed checklist and limitations.

## Backup And Restore

- Traxium relies on the configured hosting and data providers for underlying database and object-storage capabilities.
- This repository does not independently prove the buyer environment's database backup schedule, point-in-time recovery, evidence-object recovery, or restoration success.
- Backup features vary by provider configuration and service plan and must be confirmed for the environment used by the pilot.
- Restore procedures and restore testing are manual pilot-stage operational work.
- Formal recovery point objective (RPO) or recovery time objective (RTO) commitments are not currently offered during paid pilots.

See [backup-restore-statement.md](/Users/atlas/Documents/Traxium/docs/backup-restore-statement.md).

## Known Paid-Pilot Exclusions

Traxium does not currently include or claim:

- SOC 2 certification.
- ISO 27001 certification.
- HIPAA compliance.
- An attorney-reviewed GDPR compliance determination or DPA.
- SSO/SAML.
- SCIM.
- ERP or MRP integrations.
- Accounting-system posting.
- Audited accounting recognition or guaranteed savings.
- Custom approval builders.
- Vendor risk scoring.
- Contract lifecycle management.
- A broad spend analytics suite.
- A custom buyer data warehouse or BI feed.
- 24/7 support.
- An enterprise SLA.
- Enterprise-wide security-review readiness beyond the documented paid-pilot controls and evidence.

## Buyer Review Checklist

Before starting a pilot, the buyer and Traxium should:

- [ ] Confirm the pilot workspace name, data owner, and intended data scope.
- [ ] Confirm every pilot user and workspace membership role.
- [ ] Name the Procurement Lead and Finance Reviewer.
- [ ] Confirm the authorized workspace and billing administrators.
- [ ] Prepare the current Excel savings tracker without unnecessary sensitive data.
- [ ] Identify representative supplier quote, price confirmation, calculation, or implementation evidence.
- [ ] Decide whether provider-backed evidence upload/download is in pilot scope.
- [ ] Agree the controller-export contents and any manual evidence-export expectation.
- [ ] Confirm the designated pilot support email, named contacts, and business-hours window.
- [ ] Review the current provider-proof record and any preview blockers.
- [ ] Confirm no ERP integration, accounting posting, SSO/SCIM, or custom approval builder is expected during the pilot.
- [ ] Agree the offboarding and deletion-request process before the pilot ends.

