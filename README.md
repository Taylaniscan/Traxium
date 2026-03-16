# Traxium

**Traxium** is a procurement savings governance platform that helps procurement and finance teams manage savings initiatives from idea to realized value.

It replaces spreadsheet-based tracking with a structured system for initiative capture, workflow governance, approvals, reporting, and portfolio visibility.

## Why Traxium

Procurement teams often track savings in spreadsheets, emails, and presentations. That creates problems:

- no single source of truth
- weak approval governance
- limited finance visibility
- inconsistent reporting
- poor auditability
- slow portfolio decision-making

Traxium is built to solve that.

## Core capabilities

- Savings initiative tracking
- Approval workflow management
- Finance lock and validation process
- Command center and reporting views
- Kanban and timeline visibility
- Alternative supplier and material tracking
- Evidence upload support
- Import and export workflows
- Role-based access foundations
- Dashboard and portfolio analytics

## Product positioning

Traxium is designed for:

- Procurement leaders
- Category managers
- Buyers
- Finance stakeholders
- Business operations teams
- Mid-market and enterprise organizations that want better savings governance

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Next.js App Router + Route Handlers
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth / Platform services:** Supabase
- **Charts / Visualization:** Recharts
- **Drag and drop:** dnd-kit
- **Validation:** Zod
- **Deployment:** Vercel

## Project structure

```text
app/                  # App Router pages and API routes
components/           # UI and feature components
lib/                  # shared server/client logic
lib/supabase/         # Supabase helpers
prisma/               # Prisma schema and seed logic
public/               # static assets
middleware.ts         # session middleware