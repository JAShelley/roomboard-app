-- ============================================================
-- RoomBoard billing — additive migration
-- Run this in the Supabase SQL editor AFTER schema.sql.
-- Safe to run more than once (uses IF NOT EXISTS / idempotent updates).
--
-- Billable unit = a practice (clinic). A practice gets a 14-day free
-- trial on signup; after that it must hold an active Stripe or App Store
-- subscription to keep board access.
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

revoke execute on function public.practice_has_access(uuid) from anon;
revoke execute on function public.practice_has_access(uuid) from public;
revoke execute on function public.my_practice_has_access() from anon;
revoke execute on function public.my_practice_has_access() from public;
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

-- 4. Apple StoreKit / App Store billing ----------------------------------
-- These tables let the iOS app and server treat Apple auto-renewable
-- subscriptions as a first-class billing source alongside Stripe. Raw signed
-- Apple payloads are intentionally service-role-only; authenticated users only
-- see the summarized subscription rows for their own practice.

create table if not exists public.app_store_products (
  product_id text primary key,
  plan text not null check (plan in ('base', 'advanced')),
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  app_account_token uuid null,
  original_transaction_id text not null unique,
  latest_transaction_id text null,
  web_order_line_item_id text null,
  product_id text not null references public.app_store_products (product_id),
  environment text not null default 'Production',
  storefront text null,
  status text not null default 'unknown',
  expires_at timestamptz null,
  grace_period_expires_at timestamptz null,
  revocation_date timestamptz null,
  auto_renew_status text null,
  is_in_billing_retry_period boolean not null default false,
  signed_transaction_jws text null,
  signed_renewal_info_jws text null,
  raw_transaction jsonb not null default '{}'::jsonb,
  raw_renewal_info jsonb not null default '{}'::jsonb,
  raw_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_store_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid null references public.app_store_subscriptions (id) on delete set null,
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  app_account_token uuid null,
  transaction_id text not null unique,
  original_transaction_id text not null,
  web_order_line_item_id text null,
  product_id text not null,
  environment text not null default 'Production',
  transaction_type text null,
  in_app_ownership_type text null,
  offer_type text null,
  offer_identifier text null,
  purchase_date timestamptz null,
  expires_at timestamptz null,
  revocation_date timestamptz null,
  revocation_reason text null,
  signed_transaction_jws text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_store_notification_events (
  id uuid primary key default gen_random_uuid(),
  notification_uuid text not null unique,
  notification_type text null,
  subtype text null,
  environment text null,
  app_apple_id text null,
  bundle_id text null,
  original_transaction_id text null,
  transaction_id text null,
  signed_payload text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz null,
  processing_error text null,
  received_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_store_products_active_idx
  on public.app_store_products (active, plan, billing_period);

create index if not exists app_store_subscriptions_practice_id_idx
  on public.app_store_subscriptions (practice_id);

create index if not exists app_store_subscriptions_user_id_idx
  on public.app_store_subscriptions (user_id);

create index if not exists app_store_subscriptions_product_id_idx
  on public.app_store_subscriptions (product_id);

create index if not exists app_store_subscriptions_access_idx
  on public.app_store_subscriptions (practice_id, status, expires_at, grace_period_expires_at)
  where revocation_date is null;

create index if not exists app_store_transactions_practice_id_idx
  on public.app_store_transactions (practice_id, received_at desc);

create index if not exists app_store_transactions_subscription_id_idx
  on public.app_store_transactions (subscription_id);

create index if not exists app_store_transactions_user_id_idx
  on public.app_store_transactions (user_id);

create index if not exists app_store_transactions_original_transaction_id_idx
  on public.app_store_transactions (original_transaction_id, received_at desc);

create index if not exists app_store_notification_events_original_transaction_id_idx
  on public.app_store_notification_events (original_transaction_id, received_at desc);

alter table public.app_store_products enable row level security;
alter table public.app_store_subscriptions enable row level security;
alter table public.app_store_transactions enable row level security;
alter table public.app_store_notification_events enable row level security;

grant select on public.app_store_products to anon, authenticated;

revoke all on public.app_store_subscriptions from anon, authenticated;
grant select (
  id,
  practice_id,
  product_id,
  environment,
  storefront,
  status,
  expires_at,
  grace_period_expires_at,
  revocation_date,
  auto_renew_status,
  is_in_billing_retry_period,
  created_at,
  updated_at
) on public.app_store_subscriptions to authenticated;

grant select, insert, update, delete on
  public.app_store_products,
  public.app_store_subscriptions,
  public.app_store_transactions,
  public.app_store_notification_events
to service_role;

drop policy if exists "Anyone can read active App Store products" on public.app_store_products;
create policy "Anyone can read active App Store products"
  on public.app_store_products
  for select
  to anon, authenticated
  using (active is true);

drop policy if exists "Practice members can view App Store subscriptions" on public.app_store_subscriptions;
create policy "Practice members can view App Store subscriptions"
  on public.app_store_subscriptions
  for select
  to authenticated
  using (practice_id = public.get_my_practice_id());

drop policy if exists "No client access to App Store transactions" on public.app_store_transactions;
create policy "No client access to App Store transactions"
  on public.app_store_transactions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No client access to App Store notification events" on public.app_store_notification_events;
create policy "No client access to App Store notification events"
  on public.app_store_notification_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

insert into public.app_store_products (product_id, plan, billing_period, display_name)
values
  ('Base_monthly_v2', 'base', 'monthly', 'Base monthly'),
  ('Base_Annual', 'base', 'annual', 'Base annual'),
  ('Advanced_monthly', 'advanced', 'monthly', 'Advanced monthly'),
  ('Advanced_annual', 'advanced', 'annual', 'Advanced annual')
on conflict (product_id) do update
  set plan = excluded.plan,
      billing_period = excluded.billing_period,
      display_name = excluded.display_name,
      active = true,
      updated_at = timezone('utc', now());

create or replace function public.app_store_subscription_has_access(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.app_store_subscriptions s
     where s.practice_id = p_practice_id
       and s.revocation_date is null
       and lower(coalesce(s.status, '')) not in ('expired', 'revoked', 'refunded')
       and (
            s.expires_at > now()
         or s.grace_period_expires_at > now()
       )
  );
$$;

revoke execute on function public.app_store_subscription_has_access(uuid) from anon;
revoke execute on function public.app_store_subscription_has_access(uuid) from authenticated;
revoke execute on function public.app_store_subscription_has_access(uuid) from public;
grant execute on function public.app_store_subscription_has_access(uuid) to service_role;

-- Recreate the shared billing gate so Apple subscriptions unlock the same
-- live-board RLS paths as Stripe subscriptions.
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
         or public.app_store_subscription_has_access(p.id)
       )
  );
$$;

revoke execute on function public.practice_has_access(uuid) from anon;
revoke execute on function public.practice_has_access(uuid) from public;
grant execute on function public.practice_has_access(uuid) to authenticated;

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
