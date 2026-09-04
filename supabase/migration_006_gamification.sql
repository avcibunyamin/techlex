-- Migration 006: Gamification System
-- XP, streaks, badges, leaderboard support

-- ============================
-- 1. ALTER user_profiles
-- ============================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_study_date DATE,
  ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'bronze'
    CHECK (league IN ('bronze', 'silver', 'gold', 'diamond'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_xp
  ON public.user_profiles(xp DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_league
  ON public.user_profiles(league);

-- ============================
-- 2. user_badges TABLE
-- ============================

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================
-- 3. update_streak RPC
-- ============================

CREATE OR REPLACE FUNCTION public.update_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile RECORD;
  v_today date := current_date;
  v_diff integer;
  v_new_streak integer;
  v_longest integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT streak, longest_streak, last_study_date, streak_freeze_count
  INTO v_profile
  FROM user_profiles
  WHERE id = v_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  IF v_profile.last_study_date = v_today THEN
    RETURN jsonb_build_object(
      'success', true,
      'streak', v_profile.streak,
      'longest_streak', v_profile.longest_streak,
      'already_studied', true
    );
  END IF;

  IF v_profile.last_study_date IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_diff := v_today - v_profile.last_study_date;
    IF v_diff = 1 THEN
      v_new_streak := v_profile.streak + 1;
    ELSIF v_diff = 2 AND v_profile.streak_freeze_count > 0 THEN
      v_new_streak := v_profile.streak + 1;
      UPDATE user_profiles
        SET streak_freeze_count = streak_freeze_count - 1
        WHERE id = v_user_id;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  v_longest := GREATEST(COALESCE(v_profile.longest_streak, 0), v_new_streak);

  UPDATE user_profiles
  SET streak = v_new_streak,
      longest_streak = v_longest,
      last_study_date = v_today,
      last_active_date = v_today,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'streak', v_new_streak,
    'longest_streak', v_longest,
    'already_studied', false
  );
END;
$$;

-- ============================
-- 4. Updated process_batch_swipes with XP
-- ============================

CREATE OR REPLACE FUNCTION process_batch_swipes(
  p_progress jsonb,
  p_swipe_count integer,
  p_energy_consumed integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_processed integer := 0;
  v_xp_gained integer;
  v_new_xp integer;
  v_new_league text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_progress)
  LOOP
    INSERT INTO user_progress (
      user_id, term_id, box, last_seen, next_review, times_correct, times_seen
    )
    VALUES (
      v_user_id,
      v_item->>'term_id',
      (v_item->>'box')::integer,
      (v_item->>'last_seen')::timestamptz,
      (v_item->>'next_review')::timestamptz,
      (v_item->>'times_correct')::integer,
      (v_item->>'times_seen')::integer
    )
    ON CONFLICT (user_id, term_id) DO UPDATE SET
      box = EXCLUDED.box,
      last_seen = EXCLUDED.last_seen,
      next_review = EXCLUDED.next_review,
      times_correct = EXCLUDED.times_correct,
      times_seen = EXCLUDED.times_seen;

    v_processed := v_processed + 1;
  END LOOP;

  v_xp_gained := p_swipe_count * 10;

  UPDATE user_profiles
  SET
    total_swipes = COALESCE(total_swipes, 0) + p_swipe_count,
    today_count  = COALESCE(today_count, 0)  + p_swipe_count,
    xp           = COALESCE(xp, 0) + v_xp_gained,
    updated_at   = now()
  WHERE id = v_user_id
  RETURNING xp INTO v_new_xp;

  v_new_league := CASE
    WHEN v_new_xp >= 50000 THEN 'diamond'
    WHEN v_new_xp >= 20000 THEN 'gold'
    WHEN v_new_xp >= 5000  THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE user_profiles
  SET league = v_new_league
  WHERE id = v_user_id AND league IS DISTINCT FROM v_new_league;

  IF p_energy_consumed > 0 THEN
    UPDATE user_profiles
    SET energy_level = GREATEST(COALESCE(energy_level, 30) - p_energy_consumed, 0)
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'swipe_count', p_swipe_count,
    'xp_gained', v_xp_gained,
    'total_xp', v_new_xp,
    'league', v_new_league
  );
END;
$$;

-- ============================
-- 5. Award badge RPC
-- ============================

CREATE OR REPLACE FUNCTION public.award_badge(p_badge_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_badges WHERE user_id = v_user_id AND badge_id = p_badge_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('success', true, 'already_earned', true);
  END IF;

  INSERT INTO user_badges (user_id, badge_id) VALUES (v_user_id, p_badge_id);

  RETURN jsonb_build_object('success', true, 'badge_id', p_badge_id, 'already_earned', false);
END;
$$;

-- ============================
-- 6. Leaderboard view (top 50 by XP)
-- ============================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_league text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      username,
      xp,
      streak,
      league,
      longest_streak
    FROM user_profiles
    WHERE username IS NOT NULL
      AND (p_league IS NULL OR league = p_league)
    ORDER BY xp DESC
    LIMIT 50
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
