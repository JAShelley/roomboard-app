-- ============================================================
-- RoomBoard — dashboard-created tables (now tracked in source)
-- Run this in the Supabase SQL editor AFTER schema.sql and billing.sql.
-- Safe to run more than once (IF NOT EXISTS / idempotent).
--
-- These three tables were originally created ad-hoc in the Supabase
-- dashboard and had no definition in the repo. This file captures their
-- live structure (columns, keys, RLS, policies, triggers) so the schema
-- is reproducible from source. It matches what is currently deployed —
-- running it against the existing database is a no-op.
--
-- Access patterns (all covered by the primary keys below, so no extra
-- lookup indexes are needed):
--   practice_checklist         keyed by practice_id            (PK)
--   practice_default_settings  keyed by practice_id            (PK)
--   user_settings              keyed by (practice_id, user_id) (PK)
-- ============================================================

-- 1. practice_checklist ---------------------------------------------------
create table if not exists public.practice_checklist (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. practice_default_settings --------------------------------------------
create table if not exists public.practice_default_settings (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 3. user_settings --------------------------------------------------------
create table if not exists public.user_settings (
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (practice_id, user_id)
);

-- Supports cleanup/cascade lookups by user across practices.
create index if not exists user_settings_user_id_idx
  on public.user_settings (user_id);

-- Explicit Data API grants for projects where new public tables are not
-- automatically exposed. RLS policies below still enforce row-level access.
grant select, insert, update, delete on public.practice_checklist to authenticated;
grant select, insert, update, delete on public.practice_checklist to service_role;
grant select, insert, update, delete on public.practice_default_settings to authenticated;
grant select, insert, update, delete on public.practice_default_settings to service_role;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_settings to service_role;

-- ---- Row level security -------------------------------------------------
alter table public.practice_checklist enable row level security;
alter table public.practice_default_settings enable row level security;
alter table public.user_settings enable row level security;

-- practice_checklist: gated by trial/subscription access (see billing.sql,
-- which also (re)defines these policies — kept here so the table is
-- self-contained when this file is run on a fresh database).
drop policy if exists "Practice members can read checklist" on public.practice_checklist;
create policy "Practice members can read checklist"
  on public.practice_checklist for select to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice members can insert checklist" on public.practice_checklist;
create policy "Practice members can insert checklist"
  on public.practice_checklist for insert to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can update checklist" on public.practice_checklist;
create policy "Practice members can update checklist"
  on public.practice_checklist for update to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

-- practice_default_settings: clinic-wide defaults, admin-managed (setup data).
drop policy if exists "Practice members can view practice default settings" on public.practice_default_settings;
create policy "Practice members can view practice default settings"
  on public.practice_default_settings for select to authenticated
  using (practice_id = public.get_my_practice_id());

drop policy if exists "Practice admins can insert practice default settings" on public.practice_default_settings;
create policy "Practice admins can insert practice default settings"
  on public.practice_default_settings for insert to authenticated
  with check (public.is_practice_admin(practice_id));

drop policy if exists "Practice admins can update practice default settings" on public.practice_default_settings;
create policy "Practice admins can update practice default settings"
  on public.practice_default_settings for update to authenticated
  using (public.is_practice_admin(practice_id))
  with check (public.is_practice_admin(practice_id));

-- user_settings: each user manages only their own row in their own practice.
drop policy if exists "Users can view their own practice settings" on public.user_settings;
create policy "Users can view their own practice settings"
  on public.user_settings for select to authenticated
  using (user_id = auth.uid() and practice_id = public.get_my_practice_id());

drop policy if exists "Users can insert their own practice settings" on public.user_settings;
create policy "Users can insert their own practice settings"
  on public.user_settings for insert to authenticated
  with check (user_id = auth.uid() and practice_id = public.get_my_practice_id());

drop policy if exists "Users can update their own practice settings" on public.user_settings;
create policy "Users can update their own practice settings"
  on public.user_settings for update to authenticated
  using (user_id = auth.uid() and practice_id = public.get_my_practice_id())
  with check (user_id = auth.uid() and practice_id = public.get_my_practice_id());

-- ---- updated_at triggers (reuses public.update_updated_at_column from schema.sql) ----
-- Matches the live trigger name so re-running replaces it rather than adding a duplicate.
drop trigger if exists trg_practice_checklist_updated_at on public.practice_checklist;
create trigger trg_practice_checklist_updated_at
before update on public.practice_checklist
for each row execute function public.update_updated_at_column();

drop trigger if exists practice_default_settings_set_updated_at on public.practice_default_settings;
create trigger practice_default_settings_set_updated_at
before update on public.practice_default_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.update_updated_at_column();

comment on table public.practice_checklist is
  'Per-practice shared board checklist items (jsonb). Gated by trial/subscription access.';
comment on table public.practice_default_settings is
  'Clinic-wide default board settings applied to new users; admin-managed.';
comment on table public.user_settings is
  'Per-user, per-practice board preference overrides.';
