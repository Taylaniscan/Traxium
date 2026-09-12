# Controller-Ready Import And Export Contract

## Purpose

Import and export let a US manufacturing SME move from an Excel procurement savings tracker into Traxium and produce a controller-review workbook for finance review.

The first-pilot promise is controlled migration and review, not ERP synchronization, accounting posting, or a custom data warehouse.

## Root-Cause Note

Traxium already supported XLSX saving-card import, CSV/XLSX master-data import, row validation before the saving-card write loop, tenant-scoped relation resolution, and an XLSX export with summary and saving-card sheets.

The workflow was not yet sales-ready for four reasons:

1. Saving-card validation was all-at-once, but persistence opened a separate transaction for each row. A database failure after earlier rows committed could leave a partial import even though validation had passed.
2. Row failures were bundled into one message per row. The response did not consistently identify the field, invalid value, and suggested correction in a controller-friendly structure.
3. The workbook had only `Report Summary` and `Savings` sheets. It lacked a data dictionary, import template, evidence summary, explicit reconciliation checks, and several controller-review fields such as plant, business case, last update, cancellation reason, pending approval, and last phase change.
4. UtopiaTrax had enough portfolio data to make a credible workbook, but tests proved mocked sheet construction rather than a parsed multi-sheet workbook with reconciled totals.

The safe scope for Gap 8 is an atomic saving-card import and a structured controller workbook. It does not add ERP connectors, public extraction APIs, custom buyer layouts, or accounting-recognition logic.

## Import Promise

Saving-card import must:

- Accept `.xlsx` workbooks.
- Validate every row before creating any saving card.
- Return row-level errors with row number, field, invalid value, message, and a suggested fix where possible.
- Create no saving cards when any row fails validation.
- Commit all saving-card rows in one database transaction so a persistence failure also rolls back the entire import.
- Resolve or safely create buyer, supplier, material, category, plant, and business-unit names inside the active workspace.
- Reject cross-tenant relation identifiers and never link to another workspace.
- Reject invalid dates, numbers, currencies, classifications, and phase labels.
- Detect duplicate saving-card titles inside the workbook.
- Keep the canonical workflow intact. Operational imports create cards in `Proposed`; later phases require the normal phase-change approval workflow.
- Audit successful and failed saving-card import outcomes without recording workbook contents or secrets.

Master-data import supports buyers, suppliers, materials, and categories from CSV or XLSX. Plant and business-unit setup may continue through onboarding, manual setup, or inline first-card creation until their bulk-import workflow is implemented.

## Export Promise

The controller-review XLSX workbook contains:

1. `Portfolio Summary`
2. `Saving Cards`
3. `Data Dictionary`
4. `Import Template`
5. `Evidence Summary`

The workbook uses customer-facing labels, basic finance-friendly formatting, frozen/filterable headers where supported, and widths suitable for normal review.

## Portfolio Summary

The summary includes:

- Workspace name
- Export timestamp
- Reporting currency
- Reporting basis
- Portfolio and active card counts
- Proposed, Finance Validated, Implemented, Captured, and Canceled counts and values
- Total active forecast/pipeline value
- Finance-locked card count and value
- Cards with evidence
- Cards missing evidence
- Evidence coverage percentage
- Validated, implemented, or captured cards missing evidence
- Category totals
- Buyer/owner totals
- Last portfolio update
- Saving Cards row total
- Reconciliation difference

Canceled cards remain visible for governance but are excluded from active portfolio savings. The workbook states this basis explicitly.

## Saving Cards

The saving-card register includes:

- Saving Card Title
- Phase
- Savings Type
- Impact Type
- Impact Recurrence
- Budget Impact
- Buyer / Owner
- Supplier
- Alternative Supplier
- Material
- Alternative Material
- Category
- Plant
- Business Unit
- Baseline Price
- New Price
- Reference Price
- Annual Volume
- Volume Unit
- Currency
- Calculated Savings (Local)
- Savings EUR / reporting currency
- Savings USD
- Current Fiscal Year Value (USD)
- Impact-Start Fiscal Year Value (Local)
- Annualized Run-Rate (Local)
- Annualized Run-Rate (USD)
- Impact Start Date
- Impact End Date
- Finance Lock Status
- Evidence Count
- Evidence Status
- Evidence Types
- Last Evidence Upload Date
- Pending Approval Status
- Last Phase Change Date
- Last Updated
- Cancellation Reason
- Business Case / Notes

Fallback relation names are used when an alternative supplier or material was entered manually.

## Data Dictionary

The data dictionary defines every exported column, customer-facing phase labels, finance-lock meaning, evidence-status meaning, reporting basis, and the core savings formula:

`(Effective Baseline - New Price) × Annual Volume`

Effective Baseline is Reference Price for Cost Avoidance and Baseline Price for
all other impact types.

It also states that workbook values do not constitute audited accounting recognition, GAAP treatment, ERP actual matching, or finance-system posting.

## Import Template

The import template contains:

- Required and optional columns
- One manufacturing example row
- Accepted currency and classification values
- `Proposed` as the operational import phase
- Guidance that all rows are validated and committed together

Required fields are Title, Supplier, Material, Category, Plant, Business Unit, Buyer, Baseline Price, New Price, Annual Volume, Currency, Start Date, and End Date. Reference Price is conditionally required for Cost Avoidance.

## Evidence Summary

The evidence sheet contains coverage metadata only:

- Saving Card Title
- Phase
- Evidence Count
- Evidence Status
- Evidence Types
- Last Evidence Upload Date
- Finance Lock Status

It never contains evidence URLs, signed URLs, provider paths, buckets, or file-access tokens.

## Explicit Exclusions

Traxium does not claim:

- ERP or MRP synchronization
- Accounting-system posting
- Audited financial recognition
- GAAP treatment
- Custom workbook layouts per buyer
- Public API extraction
- Data warehouse or custom BI feeds
- Historical deleted-record archive export

## Security Rules

Import and export use the authenticated active organization.

The workbook and import responses must not include:

- Signed URLs
- Supabase storage paths or bucket names
- Provider customer, subscription, or object IDs
- Auth tokens
- Service keys
- Internal secret values
- Data from unrelated tenants

## Proof Expectations

Readiness requires:

- Unit tests for workbook modeling and reconciliation
- API tests for all-or-nothing import and XLSX sheets
- Row-level error tests
- Tenant-isolation tests
- UtopiaTrax export tests
- Programmatic parsing of a generated workbook
- Manual browser and workbook review before preview or production status is claimed

## Manual Proof Checklist

1. Log in as the UtopiaTrax Procurement Lead.
2. Open `/reports`.
3. Download the controller-review workbook.
4. Open the workbook locally.
5. Confirm `Portfolio Summary` exists.
6. Confirm `Saving Cards` exists.
7. Confirm `Data Dictionary` exists.
8. Confirm `Import Template` exists.
9. Confirm `Evidence Summary` exists.
10. Reconcile active savings and phase totals with `/reports` and `/dashboard`.
11. Confirm evidence count/status and finance-lock columns.
12. Search the workbook for `signedUrl`, `storagePath`, `storageBucket`, `token`, and provider IDs.
13. Import a valid workbook and confirm the success count.
14. Import a workbook with at least three row errors.
15. Confirm row, field, invalid value, message, and suggested fix are visible.
16. Confirm the UI says no saving cards were imported.
17. Confirm no rows from the invalid workbook exist.
18. Simulate or test a persistence failure and confirm the transaction rolls back all rows.
19. Export again and confirm the new valid rows appear.
20. Record the workbook filename, screenshots, and environment.
