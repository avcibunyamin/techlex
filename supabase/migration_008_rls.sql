-- ============================================================
-- Migration 008: Row Level Security (RLS) Policies
-- Supabase SQL Editor'de çalıştırın
-- Idempotent: tekrar çalıştırılabilir (DROP IF EXISTS + CREATE)
-- ============================================================

-- SUPERSEDED: Do not deploy this file. Row-level ownership alone does not stop
-- a user from updating protected columns on their own profile. Use
-- migration_009_secure_sync.sql, which combines RLS with table grants and
-- narrowly scoped SECURITY DEFINER functions.

DO $$
BEGIN
  RAISE EXCEPTION 'migration_008_rls.sql is superseded; run migration_009_secure_sync.sql instead';
END;
$$;

-- 1. Enable RLS on all user-data tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_terms   ENABLE ROW LEVEL SECURITY;

-- 2. user_profiles policies (PK = id, matches auth.uid())
DROP POLICY IF EXISTS "Users can view own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON public.user_profiles;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. user_progress policies (FK = user_id)
DROP POLICY IF EXISTS "Users can manage own progress" ON public.user_progress;

CREATE POLICY "Users can manage own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. saved_terms policies (FK = user_id)
DROP POLICY IF EXISTS "Users can manage own saved terms" ON public.saved_terms;

CREATE POLICY "Users can manage own saved terms"
  ON public.saved_terms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
