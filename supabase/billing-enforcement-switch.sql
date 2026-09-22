-- ===========================================================================
-- Billing enforcement kill switch
-- ---------------------------------------------------------------------------
-- Turns the paywall off without removing any billing code, so it can be turned
-- back on with a one-line UPDATE when RoomBoard starts charging.
--
-- Why this exists in SQL and not just in the API: 26 RLS policies gate writes
-- on practice_has_access(). Making /api/billing/status return hasAccess:true is
-- not enough on its own — Postgres would still refuse every board write, and the
-- clinic would see a board that silently fails to save.
--
-- Safe to run more than once.
--
-- To start enforcing billing again:
--   update public.billing_settings set enforced = true, updated_at = now();
-- and set BILLING_ENFORCED=true in the app environment (both sides must agree).
-- ===========================================================================

-- Single-row settings table. The `id boolean primary key check (id)` trick means
-- only one row can ever exist, so there is no ambiguity about which switch is live.
create table if not exists public.billing_settings (
  id boolean primary key default true check (id),
  enforced boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed the switch in the OFF position. `do nothing` so re-running this file
-- never silently flips enforcement back off after it has been turned on.
insert into public.billing_settings (id, enforced)
values (true, false)
on conflict (id) do nothing;

-- No policies are defined, so only service_role (which bypasses RLS) can read
-- this directly. billing_enforced() is security definer, so the gate can still
-- read it while signed-in users cannot see or change it.
alter table public.billing_settings enable row level security;

create or replace function public.billing_enforced()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Defaults to FALSE (not enforced) when the row or table is unreadable. The
  -- whole point of this switch is that nobody gets locked out of their board by
  -- a billing lookup, so an unreadable switch must not lock the clinic out.
  -- Turning enforcement on is always a deliberate act that writes the row.
  select coalesce((select enforced from public.billing_settings where id), false);
$$;

revoke execute on function public.billing_enforced() from anon;
revoke execute on function public.billing_enforced() from public;
grant execute on function public.billing_enforced() to authenticated;
grant execute on function public.billing_enforced() to service_role;

-- Recreate the shared billing gate with the switch in front of it. The paid
-- logic below is untouched and becomes live again the moment enforced = true.
create or replace function public.practice_has_access(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.billing_enforced()
    or exists (
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
