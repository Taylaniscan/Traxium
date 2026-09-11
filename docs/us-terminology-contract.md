# US Terminology Contract

## Purpose

Traxium uses US-native, SME-friendly buyer-facing language while preserving internal workflow compatibility. Product UI, reports, exports, demos, and public buyer docs should feel clear to US manufacturing procurement and finance teams without changing database enum values, API contracts, workflow order, or historical data.

## Customer-Facing Phase Labels

| Internal enum | Customer-facing label |
| --- | --- |
| `IDEA` | Proposed |
| `VALIDATED` | Finance Validated |
| `REALISED` | Implemented |
| `ACHIEVED` | Captured |
| `CANCELLED` | Canceled |

Option B is the final buyer-facing label set because it is clearer for US manufacturing finance/procurement buyers than closer technical labels such as Idea, Validated, Realized, and Achieved.

## Customer-Facing Role Labels

| Internal enum | Customer-facing label |
| --- | --- |
| `HEAD_OF_GLOBAL_PROCUREMENT` | Procurement Lead |
| `GLOBAL_CATEGORY_LEADER` | Category Owner |
| `TACTICAL_BUYER` | Buyer |
| `PROCUREMENT_ANALYST` | Procurement Analyst |
| `FINANCIAL_CONTROLLER` | Finance Reviewer |

## Rules

- UI must use customer-facing labels.
- Reports/export must use customer-facing labels.
- Demo docs must use customer-facing labels.
- Public homepage and paid-pilot docs must use customer-facing labels.
- Internal enum values may remain unchanged.
- Developer docs may mention internal enum values only when clearly technical.
- Do not change workflow semantics while changing labels.
- Do not alter the canonical phase order.
- Do not reintroduce direct phase mutation.

## Migration Policy

No database enum migration is required for this terminology hardening step unless a later decision intentionally changes storage semantics. Labels are presentation-layer mappings.
