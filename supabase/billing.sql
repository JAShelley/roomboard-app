-- ============================================================
-- RoomBoard billing — additive migration
-- Run this in the Supabase SQL editor AFTER schema.sql.
-- Safe to run more than once (uses IF NOT EXISTS / idempotent updates).
--
-- Billable unit = a practice (clinic). A practice gets a 14-day free
-- trial on signup; after that it must hold an active Stripe subscription
-- to keep board access.
-- ============================================================

-- 1. Subscription columns on practices ------------------------------------
alter table public.practices
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists plan text,
  add column if not exists has_payment_method boolean not null default false,
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists current_period_end timestamptz;

-- Stripe statuses we may see: trialing, active, past_due, canceled,
-- incomplete, incomplete_expired, unpaid, paused, none.

create index if not exists practices_stripe_customer_id_idx
  on public.practices (stripe_customer_id);

-- 2. Backfill any practices that predate this migration -------------------
-- (the column default only applies to NEW rows, so seed existing ones).
update public.practices
   set trial_ends_at = coalesce(trial_ends_at, now() + interval '14 days'),
       subscription_status = coalesce(subscription_status, 'trialing')
 where trial_ends_at is null
    or subscription_status is null;

-- 3. Access helper --------------------------------------------------------
-- A practice has board access if it is actively subscribed (or in a
-- short past_due grace handled by Stripe) OR still inside its free trial
-- WITH a Stripe customer, subscription, and saved payment method on file
-- (card required to start trial).
-- SECURITY DEFINER so the function runs as its owner (postgres) and can read
-- stripe_customer_id even though the authenticated role has no SELECT on that column.
create or replace function public.practice_has_access(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.practices p
     where p.id = p_practice_id
       and (
            p.subscription_status in ('active', 'past_due')
         or (p.subscription_status = 'trialing'
             and p.trial_ends_at > now()
             and p.stripe_customer_id is not null
             and p.stripe_subscription_id is not null
             and p.has_payment_method is true)
       )
  );
$$;

-- Convenience: the calling user's own practice access (for RLS / client use).
create or replace function public.my_practice_has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.practice_has_access(public.get_my_practice_id());
$$;

grant execute on function public.practice_has_access(uuid) to authenticated;
grant execute on function public.my_practice_has_access() to authenticated;

-- Keep Stripe identifiers server-side. The browser only needs public billing
-- status fields; API routes use the service-role key for customer/subscription
-- lookups.
revoke select on public.practices from anon;
revoke select on public.practices from authenticated;
grant select (
  id,
  name,
  created_at,
  invite_code,
  subscription_status,
  plan,
  trial_ends_at,
  current_period_end,
  phone,
  location,
  specialty
) on public.practices to authenticated;
grant select, update on public.practices to service_role;

grant select, insert, update, delete on
  public.practice_board_state,
  public.room_sessions,
  public.cleaning_sessions,
  public.room_board_entries,
  public.quick_notes
to authenticated;

grant select, insert, update, delete on
  public.practice_board_state,
  public.room_sessions,
  public.cleaning_sessions,
  public.room_board_entries,
  public.quick_notes
to service_role;

-- Gate live board data behind trial/subscription access. Clinic setup, login,
-- profiles, and billing status remain available so an expired clinic can renew.
drop policy if exists "Practice members can view board state in their practice" on public.practice_board_state;
create policy "Practice members can view board state in their practice"
  on public.practice_board_state
  for select
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice members can insert board state in their practice" on public.practice_board_state;
create policy "Practice members can insert board state in their practice"
  on public.practice_board_state
  for insert
  to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can update board state in their practice" on public.practice_board_state;
create policy "Practice members can update board state in their practice"
  on public.practice_board_state
  for update
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can view room sessions in their practice" on public.room_sessions;
create policy "Practice members can view room sessions in their practice"
  on public.room_sessions
  for select
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice members can insert room sessions in their practice" on public.room_sessions;
create policy "Practice members can insert room sessions in their practice"
  on public.room_sessions
  for insert
  to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can update room sessions in their practice" on public.room_sessions;
create policy "Practice members can update room sessions in their practice"
  on public.room_sessions
  for update
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can view cleaning sessions in their practice" on public.cleaning_sessions;
create policy "Practice members can view cleaning sessions in their practice"
  on public.cleaning_sessions
  for select
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice members can insert cleaning sessions in their practice" on public.cleaning_sessions;
create policy "Practice members can insert cleaning sessions in their practice"
  on public.cleaning_sessions
  for insert
  to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice members can update cleaning sessions in their practice" on public.cleaning_sessions;
create policy "Practice members can update cleaning sessions in their practice"
  on public.cleaning_sessions
  for update
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

-- Gate per-room board data (runtime, not setup).
drop policy if exists "Practice members can view room board entries in their practice" on public.room_board_entries;
create policy "Practice members can view room board entries in their practice"
  on public.room_board_entries
  for select
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice admins can insert room board entries in their practice" on public.room_board_entries;
create policy "Practice admins can insert room board entries in their practice"
  on public.room_board_entries
  for insert
  to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice admins can update room board entries in their practice" on public.room_board_entries;
create policy "Practice admins can update room board entries in their practice"
  on public.room_board_entries
  for update
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice admins can delete room board entries in their practice" on public.room_board_entries;
create policy "Practice admins can delete room board entries in their practice"
  on public.room_board_entries
  for delete
  to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

-- Gate quick notes (runtime board notes, not setup data).
drop policy if exists "Practice members can view quick notes in their practice" on public.quick_notes;
create policy "Practice members can view quick notes in their practice"
  on public.quick_notes for select to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

drop policy if exists "Practice admins can insert quick notes in their practice" on public.quick_notes;
create policy "Practice admins can insert quick notes in their practice"
  on public.quick_notes for insert to authenticated
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice admins can update quick notes in their practice" on public.quick_notes;
create policy "Practice admins can update quick notes in their practice"
  on public.quick_notes for update to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access())
  with check (practice_id = public.get_my_practice_id() and public.practice_has_access(practice_id));

drop policy if exists "Practice admins can delete quick notes in their practice" on public.quick_notes;
create policy "Practice admins can delete quick notes in their practice"
  on public.quick_notes for delete to authenticated
  using (practice_id = public.get_my_practice_id() and public.my_practice_has_access());

-- Gate practice_checklist (runtime, not setup data).
create table if not exists public.practice_checklist (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.practice_checklist enable row level security;

grant select, insert, update, delete on public.practice_checklist to authenticated;
grant select, insert, update, delete on public.practice_checklist to service_role;

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
