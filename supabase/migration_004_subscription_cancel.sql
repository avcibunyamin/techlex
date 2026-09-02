-- Migration 004: Subscription cancellation at period end
-- Adds cancel_at_period_end and current_period_end to user_profiles

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Cancel subscription: marks for cancellation at period end, does NOT downgrade immediately
CREATE OR REPLACE FUNCTION cancel_subscription()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    -- Safety: if no period end set, default to 30 days from now
    v_period_end := NOW() + INTERVAL '30 days';
  END IF;

  UPDATE user_profiles
     SET cancel_at_period_end = true,
         current_period_end = v_period_end,
         updated_at = NOW()
   WHERE id = auth.uid();

  RETURN json_build_object(
    'success', true,
    'period_end', v_period_end
  );
END;
$$;

-- Resume subscription: reverses cancellation before period ends
CREATE OR REPLACE FUNCTION resume_subscription()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- Cron-friendly: downgrade expired subscriptions (run periodically)
-- This would be called by a Supabase Edge Function or pg_cron
CREATE OR REPLACE FUNCTION downgrade_expired_subscriptions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
