-- ============================================================
-- Migration 003: Leitner System, Saved Terms, Level System
-- ============================================================

-- 1. saved_terms tablosu (Many-to-Many, minimal footprint)
CREATE TABLE IF NOT EXISTS public.saved_terms (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, term_id)
);

ALTER TABLE public.saved_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved terms"
  ON public.saved_terms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. user_progress tablosu (Leitner tracking, cloud sync)
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL,
  leitner_box SMALLINT DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 5),
  next_review_date TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  times_correct INT DEFAULT 0,
  times_seen INT DEFAULT 0,
  PRIMARY KEY (user_id, term_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. profiles tablosuna total_swipes ekleme
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS total_swipes INT DEFAULT 0;

-- 4. Leitner interval hesaplama fonksiyonu
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

-- 5. Sağa kaydırma: "Biliyorum" RPC
CREATE OR REPLACE FUNCTION public.swipe_right(p_term_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_box SMALLINT;
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

-- 6. Sola kaydırma: "Öğreniyorum" RPC
CREATE OR REPLACE FUNCTION public.swipe_left(p_term_id TEXT)
RETURNS void
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

-- 7. Kaydetme: saved_terms toggle RPC
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

-- 8. Enerji sistemi: 30 max, 5 dakikada 1 refill
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
  v_refill_seconds CONSTANT INT := 300; -- 5 dakika
BEGIN
  SELECT subscription_tier, energy_level, last_energy_refill
  INTO v_tier, v_energy, v_last_refill
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_tier != 'free' THEN
    RETURN json_build_object('success', true, 'energy', 999);
  END IF;

  -- Refill hesapla
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
