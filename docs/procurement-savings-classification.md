# Procurement Savings Classification

## Root Cause Found

Traxium already had a credible savings formula and a free-text `savingType` field, plus a `Frequency` enum for one-time, recurring, and multi-year value. The free-text field mixed savings method, commercial lever, and impact language, so finance could not reliably filter or aggregate it. `Frequency` described value cadence but did not distinguish temporary impact or unknown recurrence.

Impact type and budget treatment did not exist in the application schema. Hard savings, cost avoidance, supplier switches, rebates, specification changes, freight, payment terms, and similar terms appeared in demo data, helper copy, or buyer documentation, but were not governed classifications. As a result, they could not be validated consistently, protected by finance lock, or reported in controller-friendly exports.

The existing free-text values are preserved in `legacySavingsMethod` during migration. The controlled `savingType` classification becomes the customer-facing field. Existing records receive the recommended defaults without discarding their original text.

Schema support is required for all four controlled fields. Customer-facing labels and descriptions are centralized in `lib/constants.ts`. Import needs label and alias mapping, while export and reports need customer-facing labels and classification breakdowns. UtopiaTrax needs explicit classification on every card so reporting looks intentional rather than inferred.

## A. Purpose

Traxium classifies savings so procurement and finance can separate:

- hard savings from cost avoidance
- recurring from one-time impact
- price changes from commercial, operational, or specification changes
- budget-impacting savings from non-budget forecast avoidance

Classification improves review quality and reporting consistency. It does not change the canonical phase workflow or the existing savings calculation.

## B. Required Customer-Facing Classification Fields

### 1. Savings Type

| Internal value | Customer-facing label |
| --- | --- |
| `PRICE_REDUCTION` | Price Reduction |
| `SUPPLIER_SWITCH` | Supplier Switch |
| `REBATE_CREDIT` | Rebate / Credit |
| `SPECIFICATION_CHANGE` | Specification Change |
| `VOLUME_CONSOLIDATION` | Volume Consolidation |
| `FREIGHT_LOGISTICS` | Freight / Logistics |
| `PAYMENT_TERMS` | Payment Terms |
| `PROCESS_TOLLING` | Process / Tolling |
| `COST_AVOIDANCE` | Cost Avoidance |
| `OTHER` | Other |

### 2. Impact Type

| Internal value | Customer-facing label |
| --- | --- |
| `HARD_SAVINGS` | Hard Savings |
| `COST_AVOIDANCE` | Cost Avoidance |
| `CASH_FLOW_IMPROVEMENT` | Cash Flow Improvement |
| `WORKING_CAPITAL_IMPACT` | Working Capital Impact |
| `RISK_CONTINUITY_BENEFIT` | Risk / Continuity Benefit |

### 3. Impact Recurrence

| Internal value | Customer-facing label |
| --- | --- |
| `RECURRING` | Recurring |
| `ONE_TIME` | One-Time |
| `TEMPORARY` | Temporary |
| `UNKNOWN` | Unknown |

### 4. Budget Impact

| Internal value | Customer-facing label |
| --- | --- |
| `BUDGET_IMPACT` | Budget Impact |
| `FORECAST_AVOIDANCE` | Forecast Avoidance |
| `NON_BUDGET_OPERATIONAL_BENEFIT` | Non-Budget Operational Benefit |
| `UNKNOWN` | Unknown |

## C. Field Rules

Defaults for existing and newly created cards are:

- savings type: `PRICE_REDUCTION`
- impact type: `HARD_SAVINGS`
- impact recurrence: `RECURRING`
- budget impact: `BUDGET_IMPACT`

The fields are required and schema-backed. Imports may omit them and receive the same defaults. Invalid enum values or unrecognized customer-facing labels fail validation.

When finance lock is active, all four classification fields are locked. Finance validation depends on both the amount and the nature of the claimed benefit.

The canonical formula is:

`Savings = (Effective Baseline - New Price) x Annual Volume`

For Cost Avoidance, Effective Baseline is the avoided Reference Price. For all
other impact types, Effective Baseline is the approved Baseline Price.

## D. What This Classification Does Not Do

It does not:

- replace the phase workflow
- replace finance validation
- create a second approval model
- calculate accounting recognition
- replace ERP actuals
- guarantee audited savings
- create PO-level spend analytics

## E. Reporting Expectations

Reports and exports allow finance to see:

- savings by savings type
- savings by impact type
- recurring versus one-time impact
- budget impact versus forecast avoidance
- customer-facing classification values on each saving-card row

Because the four fields are required with defaults, a missing-classification KPI is not necessary.
