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
```

### 2. Configure Prisma for Supabase

Use the Supabase session pooler on port `5432` for local Prisma development.

- `DATABASE_URL`: application/runtime Prisma URL
- `DIRECT_URL`: migration URL; for local development keep it the same as `DATABASE_URL`
- Do not set `NODE_ENV` in `.env`; Next.js manages it automatically for `dev`, `build`, and `start`
- Optional direct host: only use `db.[PROJECT-REF].supabase.co:5432` if your local network can reliably reach it
- If you intentionally use the transaction pooler on `6543`, add `pgbouncer=true&connection_limit=1`
- Always include `sslmode=require&connect_timeout=30`

Local default:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30
DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30
```

### 3. Validate and run Prisma

```bash
npm run db:check
npx prisma generate
npx prisma migrate dev
```

### 4. Baseline an existing database

If the Supabase database already contains the current schema and data, do not run the baseline SQL again. Mark the committed init migration as already applied:

```bash
npm run db:check
npx prisma generate
npm run db:baseline
npx prisma migrate status
npx prisma migrate dev
```

This repo now uses:

- baseline migration: `20260323200000_init`
- first incremental migration after the baseline: `20260324204000_add_invitations`

The committed baseline intentionally matches the live pre-invitation schema. That lets an existing database baseline safely first, then apply the invitation migration normally.

Generic Prisma baseline command for a full current-schema snapshot:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

For this repo, do not replace the committed `20260323200000_init` with that full-schema snapshot unless you intentionally want to squash `20260324204000_add_invitations` into a new baseline.

To mark that baseline as applied on an existing database:

```bash
npx prisma migrate resolve --applied 20260323200000_init
```

After the baseline is resolved, new migrations should be created normally:

```bash
npx prisma migrate dev --name your_migration_name
```
