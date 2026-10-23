-- Migration 010: Account self-deletion
-- Allows authenticated users to delete their own account.
-- All user data is cleaned up via ON DELETE CASCADE foreign keys.
-- The RPC uses SECURITY DEFINER to access auth.users with elevated privileges.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Delete from auth.users; CASCADE handles user_profiles, user_progress,
  -- user_badges, saved_terms, processed_swipe_events
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
