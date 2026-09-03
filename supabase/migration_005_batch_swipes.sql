-- Batch swipe processing: replaces per-swipe RPCs (swipe_right, swipe_left, consume_energy)
-- with a single call that handles N swipes at once.
--
-- Usage from client:
--   supabase.rpc('process_batch_swipes', {
--     p_progress: [{ term_id, box, last_seen, next_review, times_correct, times_seen }, ...],
--     p_swipe_count: 10,
--     p_energy_consumed: 10
--   })

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Upsert progress rows in bulk
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

  -- Update user profile stats atomically
  UPDATE user_profiles
  SET
    total_swipes = COALESCE(total_swipes, 0) + p_swipe_count,
    today_count  = COALESCE(today_count, 0)  + p_swipe_count,
    updated_at   = now()
  WHERE id = v_user_id;

  -- Deduct energy for free-tier users
  IF p_energy_consumed > 0 THEN
    UPDATE user_profiles
    SET energy_level = GREATEST(COALESCE(energy_level, 30) - p_energy_consumed, 0)
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'swipe_count', p_swipe_count
  );
END;
$$;
