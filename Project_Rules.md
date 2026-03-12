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

Idea phase:
Requires approval from Head of Global Procurement.

Validated phase:
Requires approval from:
- Head of Global Procurement
- Financial Controller

Realised phase:
Requires approval from Financial Controller.

Achieved phase:
Requires approval from Financial Controller.

Finance Lock
When savings are validated, Finance can lock the record.

Locked fields:
- baseline price
- new price
- annual volume
- currency
- impact dates

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

Coding Behavior for Codex
When implementing features:
1. Create working code first.
2. Run the project.
3. Fix errors automatically.
4. Improve architecture only after it works.