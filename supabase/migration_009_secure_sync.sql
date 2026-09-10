-- ============================================================
-- Migration 009: canonical progress schema + secure sync boundary
--
-- Deploy this migration before shipping the client that calls
-- process_swipe_events() and sync_user_preferences().
-- ============================================================

BEGIN;

-- Canonical progress columns are `box` and `next_review`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name = 'leitner_box'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name = 'box'
  ) THEN
    ALTER TABLE public.user_progress RENAME COLUMN leitner_box TO box;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name = 'next_review_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name = 'next_review'
  ) THEN
    ALTER TABLE public.user_progress RENAME COLUMN next_review_date TO next_review;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name IN ('leitner_box', 'next_review_date')
  ) THEN
    RAISE EXCEPTION
      'Ambiguous user_progress schema: both legacy and canonical columns exist. Resolve them before migration 009.';
  END IF;
END;
$$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS league TEXT NOT NULL DEFAULT 'bronze';

UPDATE public.user_profiles
SET subscription_tier = COALESCE(subscription_tier, 'free'),
    energy_level = COALESCE(energy_level, 30),
    daily_goal = COALESCE(daily_goal, 30),
    timezone = CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_timezone_names zone WHERE zone.name = user_profiles.timezone
      ) THEN timezone
      ELSE 'UTC'
    END;

ALTER TABLE public.user_profiles
  ALTER COLUMN daily_goal SET DEFAULT 30,
  ALTER COLUMN daily_goal SET NOT NULL,
  ALTER COLUMN subscription_tier SET NOT NULL,
  ALTER COLUMN energy_level SET NOT NULL,
  ALTER COLUMN timezone SET DEFAULT 'UTC',
  ALTER COLUMN timezone SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.processed_swipe_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_swipe_events_cleanup
  ON public.processed_swipe_events(processed_at);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_swipe_events ENABLE ROW LEVEL SECURITY;

-- Remove every historical policy on these tables so the effective policy set is
-- deterministic regardless of which legacy setup path was used.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_profiles',
        'user_progress',
        'saved_terms',
        'user_badges',
        'processed_swipe_events'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved terms"
  ON public.saved_terms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

-- RLS protects rows; grants below protect sensitive columns from direct writes.
REVOKE ALL ON TABLE public.user_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_progress FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_badges FROM anon, authenticated;
REVOKE ALL ON TABLE public.processed_swipe_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.saved_terms FROM anon, authenticated;

GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT SELECT ON TABLE public.user_progress TO authenticated;
GRANT SELECT ON TABLE public.user_badges TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_terms TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;
GRANT ALL ON TABLE public.user_progress TO service_role;
GRANT ALL ON TABLE public.user_badges TO service_role;
GRANT ALL ON TABLE public.saved_terms TO service_role;
GRANT ALL ON TABLE public.processed_swipe_events TO service_role;

CREATE OR REPLACE FUNCTION public.sync_user_preferences(
  p_daily_goal INTEGER,
  p_selected_tags TEXT[],
  p_language TEXT,
  p_has_completed_onboarding BOOLEAN,
  p_timezone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_timezone TEXT := COALESCE(NULLIF(p_timezone, ''), 'UTC');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_daily_goal NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_daily_goal');
  END IF;

  IF p_language NOT IN ('tr', 'en', 'de', 'fr', 'es', 'ar', 'ja', 'ko', 'ru', 'pt') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_language');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'UTC';
  END IF;

  UPDATE public.user_profiles
  SET daily_goal = p_daily_goal,
      selected_tags = COALESCE(p_selected_tags, '{}'),
      language = p_language,
      has_completed_onboarding = p_has_completed_onboarding,
      timezone = v_timezone,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_swipe_events(p_events JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.user_profiles%ROWTYPE;
  v_event JSONB;
  v_event_id TEXT;
  v_term_id TEXT;
  v_action TEXT;
  v_inserted INTEGER;
  v_accepted INTEGER := 0;
  v_duplicates INTEGER := 0;
  v_rejected INTEGER := 0;
  v_refills INTEGER := 0;
  v_energy INTEGER;
  v_today DATE;
  v_streak INTEGER;
  v_longest INTEGER;
  v_today_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_events) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_batch');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_today := (now() AT TIME ZONE COALESCE(v_profile.timezone, 'UTC'))::date;
  v_energy := COALESCE(v_profile.energy_level, 30);

  IF v_profile.subscription_tier = 'free' THEN
    v_refills := GREATEST(
      floor(extract(epoch FROM (now() - COALESCE(v_profile.last_energy_refill, now()))) / 300)::integer,
      0
    );
    v_energy := LEAST(v_energy + v_refills, 30);
  ELSE
    v_energy := 999;
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    v_event_id := v_event->>'event_id';
    v_term_id := v_event->>'term_id';
    v_action := v_event->>'action';

    IF v_event_id IS NULL OR length(v_event_id) NOT BETWEEN 8 AND 160
       OR v_term_id IS NULL OR length(v_term_id) NOT BETWEEN 1 AND 160
       OR v_action IS NULL OR v_action NOT IN ('right', 'left') THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.processed_swipe_events(user_id, event_id)
    VALUES (v_user_id, v_event_id)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 0 THEN
      v_duplicates := v_duplicates + 1;
      CONTINUE;
    END IF;

    IF v_profile.subscription_tier = 'free' AND v_energy <= 0 THEN
      DELETE FROM public.processed_swipe_events
      WHERE user_id = v_user_id AND event_id = v_event_id;
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    IF v_action = 'right' THEN
      INSERT INTO public.user_progress (
        user_id, term_id, box, next_review, last_seen, times_correct, times_seen
      ) VALUES (
        v_user_id, v_term_id, 2,
        now() + public.leitner_interval(2::smallint), now(), 1, 1
      )
      ON CONFLICT (user_id, term_id) DO UPDATE SET
        box = LEAST(public.user_progress.box + 1, 5),
        next_review = now() + public.leitner_interval(
          LEAST(public.user_progress.box + 1, 5)::smallint
        ),
        last_seen = now(),
        times_correct = public.user_progress.times_correct + 1,
        times_seen = public.user_progress.times_seen + 1;
    ELSE
      INSERT INTO public.user_progress (
        user_id, term_id, box, next_review, last_seen, times_correct, times_seen
      ) VALUES (
        v_user_id, v_term_id, 1, now(), now(), 0, 1
      )
      ON CONFLICT (user_id, term_id) DO UPDATE SET
        box = 1,
        next_review = now(),
        last_seen = now(),
        times_seen = public.user_progress.times_seen + 1;
    END IF;

    v_accepted := v_accepted + 1;
    IF v_profile.subscription_tier = 'free' THEN
      v_energy := v_energy - 1;
    END IF;
  END LOOP;

  IF v_profile.last_active_date = v_today THEN
    v_streak := COALESCE(v_profile.streak, 0);
    v_today_count := COALESCE(v_profile.today_count, 0) + v_accepted;
  ELSIF v_profile.last_active_date = v_today - 1 THEN
    v_streak := COALESCE(v_profile.streak, 0) + CASE WHEN v_accepted > 0 THEN 1 ELSE 0 END;
    v_today_count := v_accepted;
  ELSE
    v_streak := CASE WHEN v_accepted > 0 THEN 1 ELSE COALESCE(v_profile.streak, 0) END;
    v_today_count := v_accepted;
  END IF;

  v_longest := GREATEST(COALESCE(v_profile.longest_streak, 0), v_streak);

  UPDATE public.user_profiles
  SET total_swipes = COALESCE(total_swipes, 0) + v_accepted,
      today_count = v_today_count,
      xp = COALESCE(xp, 0) + (v_accepted * 10),
      streak = v_streak,
      longest_streak = v_longest,
      last_active_date = CASE WHEN v_accepted > 0 THEN v_today ELSE last_active_date END,
      energy_level = v_energy,
      last_energy_refill = CASE
        WHEN subscription_tier <> 'free' THEN last_energy_refill
        WHEN v_refills > 0 THEN COALESCE(last_energy_refill, now()) + (v_refills * interval '5 minutes')
        ELSE last_energy_refill
      END,
      league = CASE
        WHEN COALESCE(xp, 0) + (v_accepted * 10) >= 50000 THEN 'diamond'
        WHEN COALESCE(xp, 0) + (v_accepted * 10) >= 20000 THEN 'gold'
        WHEN COALESCE(xp, 0) + (v_accepted * 10) >= 5000 THEN 'silver'
        ELSE 'bronze'
      END,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'accepted', v_accepted,
    'duplicates', v_duplicates,
    'rejected', v_rejected,
    'energy', v_energy,
    'streak', v_streak,
    'longest_streak', v_longest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_preferences(INTEGER, TEXT[], TEXT, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_swipe_events(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_user_preferences(INTEGER, TEXT[], TEXT, BOOLEAN, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_swipe_events(JSONB)
  TO authenticated, service_role;

-- Legacy write paths are intentionally disabled for app roles. The conditional
-- form also supports installations that skipped one of the historical files.
DO $$
DECLARE
  function_name TEXT;
  function_ref REGPROCEDURE;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.swipe_right(text)',
    'public.swipe_left(text)',
    'public.process_batch_swipes(jsonb,integer,integer)',
    'public.award_badge(text)',
    'public.update_streak()',
    'public.downgrade_expired_subscriptions()'
  ]
  LOOP
    function_ref := to_regprocedure(function_name);
    IF function_ref IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        function_ref
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.downgrade_expired_subscriptions()
  TO service_role;

COMMIT;
