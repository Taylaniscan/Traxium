# Codex Task Guardrails
Project: Procurement Savings Tracker

This file is the contributor-facing guidance for future Codex runs. It is not an MVP build brief anymore. Use it to preserve the repaired workflow, Kanban, dashboard, and release-safety contract.

## Canonical Workflow Contract

Saving cards follow one canonical lifecycle:

- New cards must start in `Idea`.
- Allowed non-cancelled progression is `Idea -> Validated -> Realised -> Achieved`.
- Any non-cancelled phase may move to `Cancelled` only with a cancellation reason.
- No skipping is allowed between non-cancelled phases.

Target-phase approval requirements:

- `Idea`: initial phase for new cards rather than a normal requested destination
- `Validated`: `Head of Global Procurement` and `Financial Controller`
- `Realised`: `Financial Controller`
- `Achieved`: `Financial Controller`
- `Cancelled`: requires a reason and follows the implemented phase-change approval path

Finance lock:

- Finance lock is only allowed for `Validated` savings.
- Locked fields remain:
  - baseline price
  - new price
  - annual volume
  - currency
  - impact dates

## Canonical Source Of Truth

When changing workflow behavior, the source of truth is:

- `lib/workflow.ts`: workflow rules and policy
- `lib/workflow/service.ts`: phase-change request and approval execution

Do not invent a second workflow matrix in routes, components, tests, or prompts.

## Guardrails For Mutations

- Do not bypass workflow by writing `phase` directly in saving-card create or update flows.
- Do not add a route or helper that can approve or mutate card phase outside the phase-change request approval path.
- Do not revive the legacy approval model as a parallel workflow.
- If a change affects dashboard or Kanban state, make cache invalidation expectations explicit through the existing workspace / portfolio cache helpers.

## Kanban Contract

- Kanban groups cards by persisted `savingCard.phase`.
- Pending phase requests are UI metadata, not actual phase movement.
- A pending request must not visually relocate the card into the destination column.
- Invalid move options such as `Idea -> Achieved` must not be offered.
- Cancellation actions must require a reason.
- Rejected or blocked moves must show visible feedback so the board does not feel broken.

## Dashboard And Reporting Contract

- Dashboard charts must render when valid underlying data exists.
- Partial malformed data should be normalized or ignored safely rather than collapsing the whole dashboard into an empty or error state.
- Dashboard aggregation ownership lives in `lib/dashboard/data.ts`.
- Command-center aggregation ownership lives in `lib/command-center/data.ts`.

## Module Ownership

- `lib/saving-cards/queries.ts`: saving-card and reference-data reads
- `lib/saving-cards/mutations.ts`: saving-card and related write paths
- `lib/workspace/readiness.ts`: workspace-readiness reads
- `lib/workspace/portfolio-surface-cache.ts`: dashboard/readiness cache invalidation
- `lib/data.ts`: compatibility facade only

If you add new behavior, attach it to the owning domain module instead of expanding `lib/data.ts` back into a mixed layer.

## Test Expectations

Tests must enforce intended product behavior, not legacy drift.

Required guardrails:

- workflow tests must reject direct phase bypasses and skipped transitions
- approval tests must follow the canonical approver matrix
- Kanban tests must protect persisted-phase grouping and pending-request rendering
- dashboard tests must protect real chart rendering paths, not only mock wrappers
- release tests must protect dashboard and Kanban as deploy-critical surfaces

If behavior changes intentionally, update the docs and the tests together in the same change.

## Release-Critical Surfaces

Dashboard and Kanban are release-critical.

Any change that affects workflow, saving cards, caching, dashboard metrics, or Kanban rendering must keep these aligned:

- `docs/release-checklist.md`
- `docs/post-release-smoke-tests.md`
- `docs/runtime-baseline.md`
- the existing CI smoke / release contract tests

## Closeout Note

The repaired system is now anchored on one workflow contract, one approval model, persisted-truth Kanban semantics, and explicit release/runtime protection for dashboard and Kanban. Future contributors and Codex runs must not reintroduce direct phase mutation, parallel approval logic, pending-as-moved rendering, or stale-data assumptions after workflow and saving-card mutations.
