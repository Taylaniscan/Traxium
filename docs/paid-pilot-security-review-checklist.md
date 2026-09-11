# Paid-Pilot Security Review Checklist

## Purpose

Use this checklist with the buyer's CFO, Procurement Lead, Finance Reviewer, data owner, and IT/security reviewer before live pilot data is entered.

## Buyer Company Information

- Company:
- Manufacturing or industrial segment:
- Employee range:
- Pilot sponsor:
- Buyer data owner:
- IT/security contact:
- Procurement owner:
- Finance reviewer:

## Pilot Workspace

- Workspace name:
- Deployment environment:
- Intended pilot start/end dates:
- Approved data scope:
- Data that must not be entered:
- UtopiaTrax demo completed:

## Workspace Users

For each user, record name, work email, workspace membership role, business role, and approval responsibility.

- [ ] Owner/Admin list confirmed.
- [ ] Standard Member list confirmed.
- [ ] Shared credentials are prohibited.
- [ ] User-removal process is agreed.

## Roles And Approvals

- [ ] Procurement Lead identified.
- [ ] Finance Reviewer identified.
- [ ] Category Owners/Buyers identified.
- [ ] Billing administrator identified.
- [ ] Phase-change approval rules reviewed.
- [ ] Finance-lock authority reviewed.

## Evidence Types Expected

- [ ] Supplier quote or RFQ response.
- [ ] Price confirmation.
- [ ] Contract or purchase order.
- [ ] Invoice or actual proof.
- [ ] Calculation workbook.
- [ ] Technical or customer approval.
- [ ] Rebate agreement or tolling rate card.
- [ ] Evidence that must remain outside the pilot is documented.

## Evidence Provider Review

- [ ] Configured bucket exists and is private.
- [ ] Public/anonymous evidence access is denied.
- [ ] Managed workspace/saving-card path is confirmed.
- [ ] Authenticated signed download is tested.
- [ ] 60-second signed-link lifetime is confirmed.
- [ ] Cross-workspace evidence denial is tested with controlled data.
- [ ] Upload limits, file policy, quota, and rate limits are understood.
- [ ] Provider proof is recorded without signed URLs or secrets.

## Import And Export Expectations

- [ ] Current Excel savings tracker is prepared.
- [ ] Required relation names and commercial assumptions are available.
- [ ] All-or-nothing import behavior is understood.
- [ ] Controller-review workbook sheets are agreed.
- [ ] Evidence files are understood to be separate from workbook metadata.
- [ ] No ERP integration or accounting posting is expected.
- [ ] Final export/offboarding owner is identified.

## Billing Owner

- [ ] Authorized workspace billing owner is identified.
- [ ] Stripe test/live mode matches the environment.
- [ ] Payment details are understood to remain in Stripe.
- [ ] Checkout/Portal proof status is reviewed.
- [ ] Webhook proof status and any blocker are reviewed.

## Support Contact

- Designated pilot support email:
- Named Traxium pilot contact:
- Named buyer contact:
- Agreed business-hours window:
- Critical escalation route:

- [ ] Same-business-day best-effort critical target reviewed.
- [ ] One-business-day normal response target reviewed.
- [ ] No 24/7 support or enterprise SLA is expected.

## Provider Validation Proof

- Supabase validator date/result:
- Auth redirect allow-list review:
- Stripe validator date/result:
- Stripe webhook delivery proof:
- Worker health proof:
- Preview browser proof:
- Production smoke proof:

- [ ] Local tests are not being presented as production proof.
- [ ] Blocked provider checks are explicitly recorded.

## Backup, Restore, And Offboarding

- [ ] Provider backup settings have been reviewed for the pilot environment.
- [ ] No formal RPO/RTO commitment is expected.
- [ ] Evidence archive limitations are understood.
- [ ] Final controller export process is agreed.
- [ ] Manual deletion-request process is understood.
- [ ] No automated full archive or self-service deletion is expected.

## Known Exclusions Acknowledged

- [ ] No SOC 2 or ISO 27001 certification claim.
- [ ] No SSO/SAML or SCIM.
- [ ] No ERP/MRP integration.
- [ ] No accounting-system posting.
- [ ] No custom approval builder.
- [ ] No vendor risk scoring.
- [ ] No contract lifecycle management.
- [ ] No broad spend analytics suite.
- [ ] No audited accounting recognition or guaranteed savings.
- [ ] No 24/7 support or enterprise SLA.

## Go / No-Go Before Pilot Start

Go only when:

- [ ] Workspace users and roles are approved.
- [ ] Data and evidence scope are approved.
- [ ] Provider blockers are accepted or resolved.
- [ ] Import/export expectations are agreed.
- [ ] Billing and support owners are named.
- [ ] Offboarding expectations are agreed.
- [ ] Known exclusions are acknowledged.

Decision:

- [ ] Go.
- [ ] Go with documented limitations.
- [ ] No-go until blockers are resolved.

Decision owner:

Date:

Open blockers:
