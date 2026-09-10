# TechLex Supabase migrations

The canonical progress columns are `box` and `next_review`. The application must
never write protected profile or progress fields directly; authenticated clients
use the narrowly scoped RPC functions instead.

## Fresh project

Run these files in order:

1. `000_full_schema.sql`
2. `migration_006_gamification.sql`
3. `migration_007_server_time.sql`
4. `migration_009_secure_sync.sql`

Files `schema.sql`, `migration_profiles.sql`, `migration_002_premium.sql`,
`migration_003_leitner_level.sql`, `migration_004_subscription_cancel.sql`,
`migration_005_batch_swipes.sql`, `fix_and_migrate.sql`, and
`migration_008_rls.sql` are retained only as historical migrations. Do not run
them on a fresh project.

## Existing project

1. Take a database backup.
2. Run `preflight_009.sql` and resolve every `manual_review_required` result.
3. Run `migration_009_secure_sync.sql` in a staging project.
4. Verify login, a 10-card batch, energy, streak, and a duplicate batch retry.
5. Deploy the migration to production before releasing the migration-aware app.

Migration 009 renames legacy `leitner_box`/`next_review_date` columns only when
the canonical equivalents do not already exist. If both forms exist, it aborts
the transaction for manual review instead of guessing which data to keep.

## Security boundary

- Authenticated users can read only their own profile and progress rows.
- Direct writes to profile, progress, badge, and processed-event tables are
  revoked from authenticated clients.
- `sync_user_preferences` changes only non-authoritative preferences.
- `process_swipe_events` calculates progress, XP, streak, and energy on the
  server and deduplicates event IDs.
- Subscription entitlements remain server-managed and are not accepted from
  this RPC. A billing webhook can update them in the subscription sprint.
