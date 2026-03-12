# Codex Build Task
Project: Procurement Savings Tracker

You are a senior full-stack engineer.

Your task is to build a working MVP of the Procurement Savings Tracker application.

## Tech Stack
- Next.js 15
- TypeScript
- TailwindCSS
- shadcn/ui
- PostgreSQL
- Prisma ORM
- Recharts
- dnd-kit
- Excel import/export (xlsx)

## Core Feature
The system tracks procurement savings initiatives through lifecycle phases.

Phases:
Idea → Validated → Realised → Achieved → Cancelled

Each savings initiative is a "Saving Card".

---

## Core Screens

Login

Dashboard

Saving Cards List

Saving Card Detail

Saving Card Create/Edit

Kanban Board

Timeline (Gantt)

Reports

Admin Settings

---

## Dashboard Metrics

Savings by category

Savings vs target

Savings by buyer

Monthly savings trend

Savings forecast pipeline

Savings by business unit

Total pipeline savings

Total realised savings

Total achieved savings (calendar year)

---

## Kanban Board

Columns:
Idea
Validated
Realised
Achieved
Cancelled

Cards must be draggable.

Movement between columns must follow approval rules.

---

## Timeline View

Display savings initiatives as Gantt chart.

Each card should show:

Start date

End date

Impact period

Savings value over time

Filters:
Category
Buyer
Supplier
Business unit
Phase

---

## Saving Card Fields

title

description

saving type

phase

supplier

material

category

plant

business unit

buyer

baseline price

new price

annual volume

currency

fx rate

calculated savings

frequency (one-time, recurring, multi-year)

start date

end date

impact start date

impact end date

stakeholders

evidence files

finance lock flag

cancellation reason

---

## Evidence Upload

Allow files:

contracts

RFQ summaries

supplier quotes

supplier confirmations

---

## Calculation

Savings formula:

Savings = (Baseline price – New price) × Annual volume

System must convert currencies if needed.

---

## Data Input

Manual entry

Excel import

---

## Export

Excel export for reports.

---

## Database

Create models for:

users

suppliers

materials

categories

plants

business_units

saving_cards

saving_card_stakeholders

saving_card_evidence

saving_card_comments

approvals

phase_history

notifications

audit_logs

fx_rates

annual_targets

---

## Workflow Logic

Idea → requires Head of Global Procurement approval

Validated → requires:
Head of Global Procurement
Financial Controller

Realised → requires Financial Controller approval

Achieved → requires Financial Controller approval

Cancelled → requires reason

Finance can lock validated savings.

---

## Implementation Steps

1. Scaffold Next.js project
2. Setup Prisma schema
3. Setup PostgreSQL connection
4. Create seed data
5. Implement authentication
6. Build saving cards CRUD
7. Implement workflow approvals
8. Build dashboards
9. Implement Kanban board
10. Implement timeline page
11. Implement Excel import/export
12. Add email notification mock
13. Run and fix all errors

---

## Completion Criteria

The application should:

Run locally

Allow creating saving cards

Display dashboards

Show Kanban board

Show timeline

Export reports

Follow approval workflow