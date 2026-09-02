-- Pratik Kelime - Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up the database

-- User profiles (extends Supabase auth.users)
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text,
  first_name text,
  last_name text,
  dob date,
  streak integer default 0,
  last_active_date date,
  daily_goal integer default 10,
  today_count integer default 0,
  selected_tags text[] default '{}',
  language text default 'tr',
  has_completed_onboarding boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User progress per term (Leitner spaced repetition)
create table if not exists public.user_progress (
  user_id uuid references auth.users(id) on delete cascade,
  term_id text not null,
  box integer default 1 check (box between 1 and 5),
  last_seen timestamptz default now(),
  next_review timestamptz default now(),
  times_correct integer default 0,
  times_seen integer default 0,
  starred boolean default false,
  primary key (user_id, term_id)
);

-- Indexes
create unique index if not exists idx_user_profiles_username
  on public.user_profiles(username) where username is not null;
create index if not exists idx_user_progress_user on public.user_progress(user_id);
create index if not exists idx_user_progress_starred on public.user_progress(user_id) where starred = true;
create index if not exists idx_user_progress_review on public.user_progress(user_id, next_review);

-- Row Level Security
alter table public.user_profiles enable row level security;
alter table public.user_progress enable row level security;

-- Policies: users can only access their own data
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "Users can view own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete own progress"
  on public.user_progress for delete
  using (auth.uid() = user_id);

-- RPC: check username availability (callable without auth)
create or replace function public.is_username_available(uname text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return not exists (
    select 1 from public.user_profiles where username = uname
  );
end;
$$;

-- Auto-create profile on signup (reads metadata from auth.signUp)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, username, first_name, last_name, dob)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    case
      when new.raw_user_meta_data->>'dob' is not null
        and new.raw_user_meta_data->>'dob' != ''
      then (new.raw_user_meta_data->>'dob')::date
      else null
    end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
