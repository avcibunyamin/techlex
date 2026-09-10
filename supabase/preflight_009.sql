-- Read-only checks to run before migration_009_secure_sync.sql.
-- Expected result: one row for each check, all with status = 'ok'.

SELECT
  'progress_columns' AS check_name,
  CASE
    WHEN count(*) FILTER (WHERE column_name IN ('box', 'leitner_box')) = 1
     AND count(*) FILTER (WHERE column_name IN ('next_review', 'next_review_date')) = 1
      THEN 'ok'
    ELSE 'manual_review_required'
  END AS status,
  string_agg(column_name, ', ' ORDER BY column_name) AS details
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_progress'
  AND column_name IN ('box', 'leitner_box', 'next_review', 'next_review_date');

SELECT
  'required_tables' AS check_name,
  CASE WHEN count(*) = 3 THEN 'ok' ELSE 'manual_review_required' END AS status,
  string_agg(table_name, ', ' ORDER BY table_name) AS details
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'user_progress', 'saved_terms');

SELECT
  'orphan_progress' AS check_name,
  CASE WHEN count(*) = 0 THEN 'ok' ELSE 'manual_review_required' END AS status,
  count(*)::text AS details
FROM public.user_progress progress
LEFT JOIN public.user_profiles profile ON profile.id = progress.user_id
WHERE profile.id IS NULL;

SELECT
  'invalid_profile_values' AS check_name,
  CASE WHEN count(*) = 0 THEN 'ok' ELSE 'manual_review_required' END AS status,
  count(*)::text AS details
FROM public.user_profiles
WHERE subscription_tier IS NULL
   OR subscription_tier NOT IN ('free', 'individual', 'duo', 'family')
   OR energy_level IS NULL
   OR energy_level < 0
   OR daily_goal IS NULL
   OR daily_goal < 1;
