-- Migration: Add profile fields to user_profiles
-- Run this in Supabase SQL Editor

-- New columns
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dob date;

-- Unique index on username (partial — allows nulls for legacy rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON public.user_profiles(username) WHERE username IS NOT NULL;

-- RPC: check username availability (callable without auth via anon key)
CREATE OR REPLACE FUNCTION public.is_username_available(uname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE username = uname
  );
END;
$$;

-- Update trigger: populate profile from auth signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, first_name, last_name, dob)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    CASE
      WHEN new.raw_user_meta_data->>'dob' IS NOT NULL
        AND new.raw_user_meta_data->>'dob' != ''
      THEN (new.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
