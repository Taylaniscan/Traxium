# Global English Terminology Contract

## Purpose

Traxium uses clear English for SME procurement and finance teams worldwide while preserving internal workflow compatibility. Product UI, reports, exports, demos, and public buyer docs must use the same labels without changing database enum values, API contracts, workflow order, or historical data. English display language is independent of workspace locale, time zone, currency, and measurement preference.

## Customer-Facing Phase Labels

| Internal enum | Customer-facing label |
| --- | --- |
| `IDEA` | Proposed |
| `VALIDATED` | Finance Validated |
| `REALISED` | Implemented |
| `ACHIEVED` | Captured |
| `CANCELLED` | Canceled |

These are the buyer-facing labels. The internal enum values remain unchanged.

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
