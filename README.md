# Traxium

Traxium is a procurement savings governance platform for procurement and finance teams. It centralizes initiatives, approvals, supporting evidence, and portfolio reporting in one auditable workflow.

## Why Traxium exists

Most companies still track procurement savings in spreadsheets, email threads, and presentation decks. That creates the same problems again and again:

- no single source of truth
- weak approval discipline
- finance does not fully trust the numbers
- supporting evidence is scattered
- reporting takes too much manual work
- portfolio visibility is poor

Traxium is built to solve that.

## What Traxium does

Traxium helps teams:

- create and manage savings cards
- assign buyers and stakeholders
- track sourcing initiatives through lifecycle phases
- compare alternative suppliers and materials
- upload and access supporting evidence
- manage approvals and phase changes
- monitor open actions
- review portfolio performance in dashboards, kanban, and reports
- keep a more structured record of savings decisions

## Ideal users

Traxium is designed for:

- procurement leaders
- category managers
- tactical buyers
- financial controllers
- business operations teams
- industrial and manufacturing organizations with recurring savings targets

## Current product scope

Current modules in the application include:

- Dashboard
- Saving Cards
- Kanban
- Timeline
- Command Center
- Open Actions
- Reports
- Admin / reference data
- Evidence upload and secure download
- Approval and phase workflow support

## Product status

Traxium is currently in the stage of evolving from a strong internal MVP into a hardened multi-tenant B2B SaaS product.

Current engineering priorities:

- authentication consistency
- private file storage
- API hardening
- tenant isolation
- role-based access control
- SaaS-ready onboarding and admin controls

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Supabase
- Tailwind CSS
- Zod
- Vercel

## Architecture overview

Traxium currently uses:

- **Next.js App Router** for the product UI and server routes
- **Prisma** for application data modeling and database access
- **Supabase Auth** for authentication
- **Supabase Storage** for evidence files
- **Vercel** for deployment

### Current architecture direction

The product is being hardened toward:

- secure file handling with private buckets and signed download flows
- cleaner API authorization
- stronger operational reliability
- workspace-based multi-tenancy
- role-based access control for real customer environments

## Evidence storage model

Traxium uses a private evidence storage flow.

Current approach:

- evidence files are uploaded through application routes
- files are stored in a private Supabase Storage bucket
- the database stores storage metadata, not public file URLs
- downloads are served through secure signed-link routes

This improves privacy and makes the product more suitable for real customer use.

## Local development

### 1. Install dependencies

```bash
npm install