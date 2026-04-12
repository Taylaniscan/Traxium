# PROJECT RULES
Project: Procurement Savings Tracker

Purpose:
This application tracks procurement savings initiatives and replaces Excel-based tracking with a structured workflow and dashboards.

General Development Rules
- Write clean, readable, modular TypeScript code.
- Prefer simple solutions over overengineering.
- Ensure the app is easy to maintain.
- Use clear naming conventions for variables and functions.
- Avoid unnecessary dependencies.

Technology Stack
Frontend:
- Next.js
- React
- TypeScript
- TailwindCSS
- shadcn/ui

Backend:
- Node.js
- PostgreSQL
- Prisma ORM

Libraries
- Recharts (dashboards)
- dnd-kit or similar (Kanban board)
- Gantt timeline library
- xlsx (Excel import/export)
- Zod (validation)

Architecture Principles
- Clean architecture
- Separation of concerns
- Modular services
- Reusable UI components

Core Business Logic

Savings formula:
Savings = (Baseline Price - New Price) × Annual Volume

Baseline price:
Last purchasing order price.

Currencies:
EUR and USD with FX conversion.

Savings phases:
- Idea
- Validated
- Realised
- Achieved
- Cancelled

Approval Workflow

Canonical lifecycle:
- New saving cards must start in `Idea`.
- Allowed non-cancelled progression is `Idea -> Validated -> Realised -> Achieved`.
- Any non-cancelled phase may move to `Cancelled` only with a cancellation reason.
- No phase skipping is allowed.

Target-phase approvals:
- `Idea`: initial phase for new cards rather than a normal requested destination
- `Validated`: Head of Global Procurement + Financial Controller
- `Realised`: Financial Controller
- `Achieved`: Financial Controller
- `Cancelled`: requires a reason and follows the implemented phase-change approval path

Workflow guardrail:
- Saving-card create and edit flows must not bypass workflow by writing phase directly.
- The active approval path is the phase-change request approval model. Do not reintroduce a parallel legacy approval flow.

Finance Lock
Finance can lock the record only when the saving card is in `Validated`.

Locked fields:
- baseline price
- new price
- annual volume
- currency
- impact dates

Kanban Truth Rules
- Kanban groups cards by persisted `savingCard.phase`.
- Pending phase requests are rendered as metadata, not as already moved cards.
- Invalid transitions must not be offered as move options.
- Rejected or blocked moves must show visible feedback instead of looking like drag-and-drop silently failed.

UX Rules
The application must be extremely easy to use.

Design principles:
- minimal clicks
- clear saving card interface
- intuitive Kanban board
- readable dashboards

Performance
- Use server-side queries where possible.
- Avoid heavy client-side calculations.

Testing
- Validate forms using Zod.
- Ensure calculations are correct.
- Tests must enforce intended product behavior, not historical drift.
- Workflow tests must reject direct phase bypasses and non-sequential jumps.
- Kanban tests must protect persisted-phase grouping and pending-request rendering.
- Dashboard and Kanban are release-critical and must keep focused runtime regression coverage.

Engineering Ownership
- Canonical workflow rules live in `lib/workflow.ts`.
- Workflow request and approval orchestration lives in `lib/workflow/service.ts`.
- Saving-card reads live in `lib/saving-cards/queries.ts`.
- Saving-card writes live in `lib/saving-cards/mutations.ts`.
- Dashboard aggregation lives in `lib/dashboard/data.ts`.
- Workspace readiness and portfolio-surface cache invalidation live in `lib/workspace/*`.
- `lib/data.ts` is a compatibility facade, not the primary ownership layer.

Coding Behavior for Codex
When implementing features:
1. Create working code first.
2. Run the project.
3. Fix errors automatically.
4. Improve architecture only after it works.

Closeout Note
Historical drift was repaired across workflow rules, Kanban semantics, dashboard runtime safety, release smoke, and cache invalidation. What is now canonical is the sequential workflow in `lib/workflow.ts`, phase-change-request approvals in `lib/workflow/service.ts`, persisted-truth Kanban behavior, and release validation of dashboard plus Kanban. Contributors must not reintroduce direct phase writes, skipped transitions, pending-as-moved rendering, or a second approval source of truth.
