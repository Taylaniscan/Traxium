# Backup And Restore Statement

## Purpose

This statement explains the current backup and restore boundary for Traxium paid pilots. It is intentionally cautious and does not promise disaster-recovery capabilities that have not been configured and tested for the buyer environment.

## Current Backup Responsibility By Provider

Traxium uses external providers for core infrastructure:

- PostgreSQL application data is hosted through the configured Supabase/PostgreSQL environment.
- Evidence objects are stored through the configured private Supabase Storage bucket.
- Application deployment is hosted through the configured deployment provider.
- Stripe maintains payment and subscription-provider records in Stripe.

The availability of provider backup, retention, point-in-time recovery, versioning, or restore features depends on the selected provider plan and environment configuration. This repository does not by itself prove that those features are enabled.

## Database Backup Assumptions

- Application tests validate schema, migrations, tenant scoping, and route behavior; they do not validate a production backup schedule.
- Database backup frequency, retention, and point-in-time recovery must be confirmed in the Supabase project or other PostgreSQL provider used for the pilot.
- Traxium does not currently run an independent application-managed database backup job from this repository.
- A database migration history is not a substitute for a data backup.

## Supabase Storage Considerations

- Evidence files are expected to live in a private bucket with managed workspace paths.
- Application tests prove path validation and signed-download behavior, not object backup or object version recovery.
- Evidence object retention, versioning, replication, and restore capability must be confirmed with the configured storage provider.
- There is no automated full evidence archive or application-managed duplicate evidence store.

## Restore Expectations

- A restore is a controlled operational action requiring confirmation of the affected environment, workspace scope, provider capability, and acceptable data-loss window.
- Restore execution may require provider dashboard or support access.
- Application smoke tests must be run after a restore before the workspace is returned to pilot use.
- Evidence and database restoration may need separate procedures.
- Restore must not overwrite unrelated workspaces or mix preview and production provider data.

## Pilot-Stage Limitations

- No automated disaster-recovery orchestration is implemented in this repository.
- No cross-region failover commitment is offered.
- No automated buyer-triggered restore is available.
- No formal recovery point objective (RPO) or recovery time objective (RTO) is offered during standard paid pilots.
- No restore-success history for preview or production is currently recorded in the readiness proof log.

## Manual Restore And Testing Status

As of June 5, 2026:

- Schema and migration validation are automated.
- Application route and tenant-isolation tests are automated.
- Provider configuration validators exist for Supabase and Stripe.
- A database restore drill has not been recorded.
- An evidence-object restore drill has not been recorded.
- A complete preview or production disaster-recovery exercise has not been recorded.

## Validation Required Before Broader Commercial Launch

Before offering broader recovery commitments:

- Confirm database backup and retention settings for each commercial environment.
- Confirm point-in-time recovery capability and access procedure.
- Confirm private evidence-object retention and recovery behavior.
- Document responsible operators and provider access controls.
- Run a controlled restore drill in a non-production environment.
- Verify tenant boundaries after restore.
- Verify evidence access, Auth, billing state, import/export, Dashboard, and Reports after restore.
- Record actual recovery timing and data-loss observations before proposing an RPO or RTO.

