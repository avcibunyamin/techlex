-- ============================================================
-- TechLex - Full Database Schema (Consolidated)
-- Run this ONCE in Supabase SQL Editor (fresh project)
-- ============================================================

-- ============================
-- 1. TABLES
-- ============================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  streak INTEGER DEFAULT 0,
  last_active_date DATE,
  daily_goal INTEGER DEFAULT 10,
  today_count INTEGER DEFAULT 0,
  selected_tags TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'tr',
  has_completed_onboarding BOOLEAN DEFAULT false,
  last_username_change TIMESTAMPTZ,
  subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'individual', 'duo', 'family')),
  energy_level INTEGER DEFAULT 30,
  last_energy_refill TIMESTAMPTZ DEFAULT now(),
  total_swipes INTEGER DEFAULT 0,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL,
  leitner_box SMALLINT DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 5),
  next_review_date TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  times_correct INTEGER DEFAULT 0,
  times_seen INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, term_id)
);

CREATE TABLE IF NOT EXISTS public.saved_terms (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, term_id)
);

-- ============================
-- 2. INDEXES
-- ============================

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON public.user_profiles(username) WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_progress_user
  ON public.user_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_review
  ON public.user_progress(user_id, next_review_date);

-- ============================
-- 3. ROW LEVEL SECURITY
-- ============================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved terms"
  ON public.saved_terms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================
-- 4. FUNCTIONS
-- ============================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, first_name, last_name, dob)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE
      WHEN NEW.raw_user_meta_data->>'dob' IS NOT NULL
        AND NEW.raw_user_meta_data->>'dob' != ''
      THEN (NEW.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Check username availability
CREATE OR REPLACE FUNCTION public.is_username_available(uname TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE username = uname
  );
END;
$$;

-- Change username with 7-day cooldown
CREATE OR REPLACE FUNCTION public.change_username(new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  current_profile RECORD;
  cooldown_end TIMESTAMPTZ;
  days_left INTEGER;
BEGIN
  SELECT * INTO current_profile FROM user_profiles WHERE id = auth.uid();

  IF current_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF new_username IS NULL OR length(new_username) < 3 OR length(new_username) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username must be 3-20 characters');
  END IF;

  IF new_username !~ '^[a-z0-9]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only lowercase letters and numbers');
  END IF;

  IF current_profile.last_username_change IS NOT NULL THEN
    cooldown_end := current_profile.last_username_change + INTERVAL '7 days';
    IF now() < cooldown_end THEN
      days_left := ceil(extract(epoch FROM cooldown_end - now()) / 86400);
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Username change cooldown active',
        'days_left', days_left,
        'cooldown_end', cooldown_end
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE username = new_username AND id != auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This username is already taken');
  END IF;

  UPDATE user_profiles
    SET username = new_username,
        last_username_change = now(),
        updated_at = now()
    WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'username', new_username);
END;
$$;

-- Leitner interval calculation
CREATE OR REPLACE FUNCTION public.leitner_interval(box_num SMALLINT)
RETURNS INTERVAL
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE box_num
    WHEN 1 THEN INTERVAL '0 seconds'
    WHEN 2 THEN INTERVAL '1 day'
    WHEN 3 THEN INTERVAL '3 days'
    WHEN 4 THEN INTERVAL '7 days'
    WHEN 5 THEN INTERVAL '14 days'
    ELSE INTERVAL '0 seconds'
  END;
$$;

-- Swipe right: "Biliyorum"
CREATE OR REPLACE FUNCTION public.swipe_right(p_term_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_progress (user_id, term_id, leitner_box, next_review_date, last_seen, times_correct, times_seen)
  VALUES (
    auth.uid(), p_term_id, 2,
    now() + public.leitner_interval(2::SMALLINT),
    now(), 1, 1
  )
  ON CONFLICT (user_id, term_id) DO UPDATE SET
    leitner_box = LEAST(user_progress.leitner_box + 1, 5),
    next_review_date = now() + public.leitner_interval(LEAST(user_progress.leitner_box + 1, 5)::SMALLINT),
    last_seen = now(),
    times_correct = user_progress.times_correct + 1,
    times_seen = user_progress.times_seen + 1;

  UPDATE public.user_profiles
  SET total_swipes = total_swipes + 1
  WHERE id = auth.uid();
END;
$$;

-- Swipe left: "Ogreniyorum"
CREATE OR REPLACE FUNCTION public.swipe_left(p_term_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_progress (user_id, term_id, leitner_box, next_review_date, last_seen, times_correct, times_seen)
  VALUES (
    auth.uid(), p_term_id, 1,
    now() + public.leitner_interval(1::SMALLINT),
    now(), 0, 1
  )
  ON CONFLICT (user_id, term_id) DO UPDATE SET
    leitner_box = 1,
    next_review_date = now() + public.leitner_interval(1::SMALLINT),
    last_seen = now(),
    times_seen = user_progress.times_seen + 1;

  UPDATE public.user_profiles
  SET total_swipes = total_swipes + 1
  WHERE id = auth.uid();
END;
$$;

-- Toggle save term
CREATE OR REPLACE FUNCTION public.toggle_save_term(p_term_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.saved_terms
    WHERE user_id = auth.uid() AND term_id = p_term_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.saved_terms
    WHERE user_id = auth.uid() AND term_id = p_term_id;
    RETURN FALSE;
  ELSE
    INSERT INTO public.saved_terms (user_id, term_id)
    VALUES (auth.uid(), p_term_id);
    RETURN TRUE;
  END IF;
END;
$$;

-- Consume energy (30 max, 5-min refill for free users)
CREATE OR REPLACE FUNCTION public.consume_energy()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
  v_energy INT;
  v_last_refill TIMESTAMPTZ;
  v_elapsed INTERVAL;
  v_refills INT;
  v_max_energy CONSTANT INT := 30;
  v_refill_seconds CONSTANT INT := 300;
BEGIN
  SELECT subscription_tier, energy_level, last_energy_refill
  INTO v_tier, v_energy, v_last_refill
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_tier != 'free' THEN
    RETURN json_build_object('success', true, 'energy', 999);
  END IF;

  v_elapsed := now() - COALESCE(v_last_refill, now());
  v_refills := EXTRACT(EPOCH FROM v_elapsed)::INT / v_refill_seconds;
  IF v_refills > 0 THEN
    v_energy := LEAST(v_energy + v_refills, v_max_energy);
  END IF;

  IF v_energy <= 0 THEN
    RETURN json_build_object('success', false, 'energy', 0);
  END IF;

  UPDATE public.user_profiles
  SET energy_level = v_energy - 1,
      last_energy_refill = CASE WHEN v_refills > 0 THEN now() ELSE last_energy_refill END
  WHERE id = auth.uid();

  RETURN json_build_object('success', true, 'energy', v_energy - 1);
END;
$$;

-- Refill energy
CREATE OR REPLACE FUNCTION public.refill_energy()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  p RECORD;
  elapsed_minutes NUMERIC;
  refill_amount INTEGER;
  max_energy INTEGER := 30;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE id = auth.uid();
  IF p IS NULL THEN
    RETURN jsonb_build_object('energy', 0);
  END IF;

  IF p.subscription_tier != 'free' THEN
    IF p.energy_level != 999 THEN
      UPDATE user_profiles SET energy_level = 999 WHERE id = auth.uid();
    END IF;
    RETURN jsonb_build_object('energy', 999, 'is_premium', true);
  END IF;

  elapsed_minutes := extract(epoch FROM (now() - p.last_energy_refill)) / 300;
  refill_amount := floor(elapsed_minutes);

  IF refill_amount > 0 AND p.energy_level < max_energy THEN
    UPDATE user_profiles
      SET energy_level = LEAST(p.energy_level + refill_amount, max_energy),
          last_energy_refill = now()
      WHERE id = auth.uid();
    RETURN jsonb_build_object(
      'energy', LEAST(p.energy_level + refill_amount, max_energy),
      'is_premium', false
    );
  END IF;

  RETURN jsonb_build_object('energy', p.energy_level, 'is_premium', false);
END;
$$;

-- Cancel subscription at period end
CREATE OR REPLACE FUNCTION public.cancel_subscription()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT subscription_tier, current_period_end
    INTO v_tier, v_period_end
    FROM user_profiles
   WHERE id = auth.uid();

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RETURN json_build_object('success', false, 'error', 'No active subscription');
  END IF;

  IF v_period_end IS NULL THEN
    v_period_end := NOW() + INTERVAL '30 days';
  END IF;

  UPDATE user_profiles
     SET cancel_at_period_end = true,
         current_period_end = v_period_end,
         updated_at = NOW()
   WHERE id = auth.uid();

  RETURN json_build_object('success', true, 'period_end', v_period_end);
END;
$$;

-- Resume subscription
CREATE OR REPLACE FUNCTION public.resume_subscription()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
  v_cancel BOOLEAN;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT subscription_tier, cancel_at_period_end, current_period_end
    INTO v_tier, v_cancel, v_period_end
    FROM user_profiles
   WHERE id = auth.uid();

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RETURN json_build_object('success', false, 'error', 'No active subscription');
  END IF;

  IF NOT v_cancel THEN
    RETURN json_build_object('success', false, 'error', 'Subscription is not cancelled');
  END IF;

  IF v_period_end IS NOT NULL AND v_period_end < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Subscription period has ended');
  END IF;

  UPDATE user_profiles
     SET cancel_at_period_end = false,
         updated_at = NOW()
   WHERE id = auth.uid();

  RETURN json_build_object('success', true);
END;
$$;

-- Cron: downgrade expired subscriptions
CREATE OR REPLACE FUNCTION public.downgrade_expired_subscriptions()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE user_profiles
     SET subscription_tier = 'free',
         cancel_at_period_end = false,
         updated_at = NOW()
   WHERE cancel_at_period_end = true
     AND current_period_end IS NOT NULL
     AND current_period_end < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
