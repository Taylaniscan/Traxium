# Restore-Drill Runbook

This is a human checklist for periodically proving that the Supabase Postgres backup
can actually be restored and that a restored database still passes Traxium's data
contract. Run it on a schedule (at least quarterly) and record the outcome in the
results table at the bottom.

**Do not run this drill against the production project or production database.** The
drill always targets a disposable scratch project.

## Prerequisites

- Access to the Supabase organization that owns the production project.
- A local checkout of this repository with dependencies installed (`npm ci`).
- The production database password (or a service role with restore permissions).
- `npx`, `node`, and `psql` available locally.

## Steps

### 1. Capture the source backup

1. In the Supabase dashboard, open the **production** project → **Database** → **Backups**.
2. Note the most recent daily backup (or the PITR timestamp you intend to restore).
3. Record the backup timestamp you are restoring from for the results table.

### 2. Create a scratch project

1. Create a **new** Supabase project (e.g. `traxium-restore-drill-YYYYMMDD`) in the same
   region as production. This is the restore target and will be deleted at the end.
2. Wait for the project to finish provisioning.

### 3. Restore the backup into the scratch project

Use whichever path your Supabase plan supports:

- **Dashboard restore**: if the plan allows restoring a backup into another project,
  restore the captured backup directly into the scratch project.
- **Manual dump/restore** (works on any plan):
  1. Dump production (read-only):
     ```bash
     pg_dump "postgresql://postgres.[PROD-REF]:[PROD-PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres?sslmode=require" \
       --no-owner --no-privileges -Fc -f restore-drill.dump
     ```
  2. Restore into the scratch project:
     ```bash
     pg_restore --no-owner --no-privileges --clean --if-exists \
       -d "postgresql://postgres.[SCRATCH-REF]:[SCRATCH-PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres?sslmode=require" \
       restore-drill.dump
     ```
- Delete the local `restore-drill.dump` afterwards; it contains customer data.

### 4. Point a local env at the scratch project

1. Copy `.env.example` to `.env.restore-drill` (or back up your existing `.env`).
2. Set `APP_ENV=development`.
3. Point `DATABASE_URL` and `DIRECT_URL` at the **scratch** project's session pooler
   (port `5432`), exactly as described in the local-development section of
   [../README.md](../README.md). Keep `sslmode=require&connect_timeout=30`.
4. Confirm the URLs do **not** reference the production project ref.
5. Validate the wiring without mutating anything:
   ```bash
   npm run db:check
   npx prisma migrate status
   ```

### 5. Run the demo data contract against the restored database

```bash
npm run demo:utopiatrax:validate
```

- A passing run means the restored schema and the UtopiaTrax demo data still reconcile.
- If the restored database does not contain the UtopiaTrax demo workspace, seed it first
  with `npm run db:seed:utopiatrax`, then re-run the validator.
- Capture the validator's pass/fail summary for the results table.

### 6. Tear down

1. Delete the scratch Supabase project.
2. Delete `.env.restore-drill` and any local dump files.
3. Restore your original `.env` if you backed it up.

## Results

Record one row per drill. Keep the most recent at the top.

| Drill date | Backup timestamp restored | Duration (restore + validate) | Validator outcome | Operator | Notes |
| ---------- | ------------------------- | ----------------------------- | ----------------- | -------- | ----- |
| _YYYY-MM-DD_ | _backup ts_ | _e.g. 35m_ | _PASS / FAIL_ | _name_ | _issues, follow-ups_ |
