-- Migration 002: Username change tracking + Freemium fields
-- Run this in Supabase SQL Editor

-- Username change tracking
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_username_change timestamptz;

-- Freemium fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'individual', 'duo', 'family'));
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS energy_level integer DEFAULT 5;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_energy_refill timestamptz DEFAULT now();

-- RPC: change username with 7-day cooldown (server-side enforcement)
CREATE OR REPLACE FUNCTION public.change_username(new_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_profile record;
  cooldown_end timestamptz;
  days_left integer;
BEGIN
  SELECT * INTO current_profile
    FROM user_profiles WHERE id = auth.uid();

  IF current_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Validate format
  IF new_username IS NULL OR length(new_username) < 3 OR length(new_username) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username must be 3-20 characters');
  END IF;

  IF new_username !~ '^[a-z0-9]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only lowercase letters and numbers');
  END IF;

  -- 7-day cooldown check
  IF current_profile.last_username_change IS NOT NULL THEN
    cooldown_end := current_profile.last_username_change + interval '7 days';
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

  -- Unique check
  IF EXISTS (SELECT 1 FROM user_profiles WHERE username = new_username AND id != auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This username is already taken');
  END IF;

  -- Apply change
  UPDATE user_profiles
    SET username = new_username,
        last_username_change = now(),
        updated_at = now()
    WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'username', new_username);
END;
$$;

-- RPC: refill energy (called by client, server enforces rate)
CREATE OR REPLACE FUNCTION public.refill_energy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  elapsed_hours numeric;
  refill_amount integer;
  max_energy integer := 5;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE id = auth.uid();
  IF p IS NULL THEN
    RETURN jsonb_build_object('energy', 0);
  END IF;

  -- Premium users always have max energy
  IF p.subscription_tier != 'free' THEN
    IF p.energy_level != 999 THEN
      UPDATE user_profiles SET energy_level = 999 WHERE id = auth.uid();
    END IF;
    RETURN jsonb_build_object('energy', 999, 'is_premium', true);
  END IF;

  -- Free users: 1 energy per hour, max 5
  elapsed_hours := extract(epoch FROM (now() - p.last_energy_refill)) / 3600;
  refill_amount := floor(elapsed_hours);

  IF refill_amount > 0 AND p.energy_level < max_energy THEN
    UPDATE user_profiles
      SET energy_level = least(p.energy_level + refill_amount, max_energy),
          last_energy_refill = now()
      WHERE id = auth.uid();
    RETURN jsonb_build_object(
      'energy', least(p.energy_level + refill_amount, max_energy),
      'is_premium', false
    );
  END IF;

  RETURN jsonb_build_object('energy', p.energy_level, 'is_premium', false);
END;
$$;

-- RPC: consume energy (1 per card interaction)
CREATE OR REPLACE FUNCTION public.consume_energy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE id = auth.uid();
  IF p IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Premium users skip energy check
  IF p.subscription_tier != 'free' THEN
    RETURN jsonb_build_object('success', true, 'energy', 999, 'is_premium', true);
  END IF;

  IF p.energy_level <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No energy left', 'energy', 0);
  END IF;

  UPDATE user_profiles
    SET energy_level = energy_level - 1
    WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'energy', p.energy_level - 1);
END;
$$;
