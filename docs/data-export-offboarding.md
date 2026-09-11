# Data Export And Offboarding

## Purpose

This document explains the current paid-pilot export and offboarding boundary. It is operational guidance, not a legal retention policy, DPA, or promise of automated deletion.

## What Can Be Exported From Traxium

The standard Reports export produces a controller-review XLSX workbook containing:

- Portfolio Summary.
- Saving Cards.
- Data Dictionary.
- Import Template.
- Evidence Summary metadata.
- Commercial assumptions and calculated savings.
- Customer-facing phase and classification labels.
- Buyer, supplier, material, category, plant, and business-unit context.
- Finance-lock and pending-approval status.
- Evidence count, status, types, and last-upload date.

The export is scoped to the authenticated active workspace.

## Saving-Card Export

- Canceled cards remain visible for governance but are excluded from active savings totals.
- The workbook documents its reporting basis and reconciliation difference.
- The export does not include unrelated-workspace data.
- The export does not include signed URLs, evidence storage paths, bucket names, tokens, provider secrets, Stripe object IDs, or raw internal JSON.
- The controller workbook is not ERP synchronization, accounting posting, audited accounting recognition, or a deleted-record archive.

## Evidence Export Limitations

- The standard XLSX contains evidence coverage metadata, not evidence-file binaries.
- There is no automated full evidence archive download in the current product.
- Evidence-file collection may require a manual, separately agreed process when Supabase Storage is configured.
- Any manual evidence export must preserve workspace scope and avoid public URLs or long-lived signed links.
- Evidence availability depends on the configured provider and successful provider-flow validation.

## Audit And History Export Limitations

- The controller workbook includes selected workflow and evidence context, not a full audit-log archive.
- There is no standard export of every admin activity, observability event, provider event, deleted record, or technical log.
- A specific history or audit request must be reviewed manually for scope, authorization, redaction, and feasibility.

## Manual Offboarding Support

Before the pilot ends:

1. Confirm the buyer's authorized data owner.
2. Generate and review the final controller workbook.
3. Agree whether evidence-file collection is required.
4. Record unresolved open actions and pending approvals.
5. Confirm which users should lose access and when.
6. Agree any manual deletion request and verification steps.
7. Record what was exported and what was not available.

There is no self-service full-workspace archive or one-click offboarding workflow.

## Data Deletion Request Handling

- Traxium does not currently expose self-service permanent workspace deletion.
- A deletion request must come from an authorized buyer contact and be reviewed against the workspace, provider objects, billing state, evidence files, and operational/legal obligations.
- Execution and verification require a controlled manual process.
- No universal retention period or deletion turnaround is promised by this document.
- Backup or provider-recovery copies may follow provider-specific behavior that must be confirmed separately.

## What Is Not Automated Yet

- Full evidence archive export.
- Complete audit/history archive export.
- Deleted-record archive export.
- Self-service workspace closure.
- Self-service permanent deletion.
- Automated provider-object cleanup across Supabase and Stripe.
- Automated deletion certificates.

## No Legal Or Compliance Overclaim

This document is not an attorney-reviewed privacy policy, retention schedule, DPA, GDPR determination, or regulatory deletion guarantee. Contractual and legal requirements must be reviewed separately before a pilot that requires them.

## Buyer Checklist Before Pilot End

- [ ] Confirm the authorized buyer data owner.
- [ ] Export and open the final controller workbook.
- [ ] Reconcile totals with Reports.
- [ ] Confirm whether evidence files need a manual archive.
- [ ] Confirm whether selected audit/history information is needed.
- [ ] Remove or schedule removal of pilot users.
- [ ] Close or update billing through the authorized Stripe flow.
- [ ] Document any deletion request and provider-specific limitations.
- [ ] Record outstanding product, provider, or support blockers.

