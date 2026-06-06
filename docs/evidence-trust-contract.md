# Evidence Trust Contract

## Purpose

Evidence exists so procurement savings are not just spreadsheet claims. It gives finance and leadership a controlled record of supplier quotes, agreements, price confirmations, invoices, calculations, and implementation proof attached to the saving card they support.

Traxium uses evidence to improve review quality. It does not treat the presence of a file as automatic accounting recognition or guaranteed savings capture.

## Root-Cause Note

Before Gap 7, the route and storage controls were technically strong: uploads and downloads required authentication, saving-card access was tenant-scoped, files used a managed private namespace, download links were signed for 60 seconds, and upload quota, rate limits, file policy, and audit writes existed.

Buyer-facing proof was weaker. Saving cards did not classify evidence by business purpose, reports and exports did not show evidence coverage, the UI did not consistently explain private storage or signed downloads, evidence audit records were not consistently organization-scoped for admin visibility, and UtopiaTrax used generic text attachments. Supabase provider settings also remained separate proof that could not be inferred from local tests.

## Evidence Examples

- Supplier quote or RFQ response
- Supplier price confirmation
- Contract / purchase order
- Invoice / actual purchase proof
- Calculation workbook
- Technical approval note
- Customer approval note
- Rebate agreement
- Tolling rate card
- Negotiation summary

## What Evidence Proves

Evidence can support:

- Baseline price
- New price
- Annual volume assumption
- Implementation timing
- Supplier selection
- Finance validation
- Realized or captured status

## What Evidence Does Not Prove

Evidence does not automatically mean:

- Audited accounting recognition
- ERP actual matching
- GAAP treatment
- External audit signoff
- Guaranteed savings capture

## Storage And Security Contract

- Evidence files are stored in private provider storage.
- Traxium stores evidence metadata and managed provider paths, not public URLs.
- The browser uses authenticated app download routes.
- Downloads require active workspace membership and saving-card access.
- Storage URLs are signed server-side and expire after 60 seconds.
- Storage bucket and organization/saving-card namespaces are validated before signing.
- Path traversal, bucket mismatch, and cross-tenant access are rejected.
- Uploads are rate-limited, quota-checked, file-type checked, content-type checked, batch-limited, and size-limited.
- Upload and download actions are written as organization-scoped audit events.
- Signed URLs, provider service keys, storage paths, and tokens must not be printed in logs or exported.

## Buyer-Facing Proof Expectations

The product should show:

- Whether each saving card has evidence
- Evidence count
- Evidence type
- File name, upload date, and uploader where available
- Missing-evidence warning for finance-validated, implemented, or captured cards
- Evidence-recommended guidance for proposed cards
- Portfolio evidence coverage
- Evidence count, status, types, and last-upload date in controller export
- Evidence upload/download activity in workspace Admin Activity
- Plain-language private-storage and signed-download explanations

Evidence remains optional for first-card creation. A missing file is a warning, not a second approval model or a silent phase mutation.

## Provider Proof

Local tests prove the application route, tenant, path, bucket, signing TTL, quota, rate-limit, and audit contract. Preview or production Supabase configuration is separate proof.

Before a paid pilot, validate the configured bucket is private, service-role signing works, anonymous/public reads fail, and the Auth redirect allow-list is correct. Record that proof in [supabase-provider-validation.md](/Users/atlas/Documents/Traxium/docs/supabase-provider-validation.md) and [readiness-proof-log.md](/Users/atlas/Documents/Traxium/docs/readiness-proof-log.md).

## No Overclaims

Traxium must not claim SOC 2 certification, 24/7 support, SSO/SAML, ERP integration, custom approval builders, vendor risk scoring, contract lifecycle management, spend analytics, or audited financial recognition unless those capabilities exist and are validated.

## Manual Browser And Provider Checklist

1. Log in as Procurement Lead.
2. Open UtopiaTrax.
3. Open the showcase saving card with evidence.
4. Confirm the Evidence tab shows count, types, examples, uploader, and signed-download guidance.
5. Upload a harmless test file to a test card.
6. Confirm client-side file validations.
7. Confirm upload success.
8. Confirm the evidence list updates.
9. Download through `/api/evidence/{id}/download`.
10. Confirm no public storage URL appears in the UI.
11. Log in as Finance Reviewer and confirm authorized access.
12. Log in as an unrelated workspace user and confirm evidence is inaccessible.
13. Open `/reports`.
14. Confirm Evidence Coverage appears.
15. Export the workbook.
16. Confirm the export includes evidence count/status/types but no URL, storage path, or token.
17. Open `/admin/settings` and confirm evidence upload/download activity when present.
18. Run `npm run supabase:validate` when credentials exist.
19. Confirm the bucket is private in the Supabase dashboard.
20. Record screenshots and results in the readiness proof log.
