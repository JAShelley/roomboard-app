-- ============================================================
-- RoomBoard billing — card-up-front trial migration
-- Run this in the Supabase SQL editor AFTER billing.sql.
-- Idempotent: safe to run more than once.
--
-- Moves from a free, card-less 14-day trial to a CARD-UP-FRONT trial:
-- a practice only gets board access once it has a real Stripe subscription
-- (i.e. it went through Checkout and a card is on file). The trial itself is
-- run by Stripe (trial_period_days), which auto-charges the chosen plan when
-- the trial ends. New practices start with no trial until Checkout completes.
-- ============================================================

-- 1. New practices start in a pre-checkout state (no card, no access). The DB
--    default trial is removed; Stripe grants and tracks the real trial via the
--    billing webhook (subscription_status -> 'trialing', trial_ends_at synced).
alter table public.practices
  alter column subscription_status set default 'incomplete',
  alter column trial_ends_at drop default;

-- 2. Access now requires a real Stripe subscription for the trial branch.
--    Mirrors computeAccess() in app/api/billing/_lib.ts.
create or replace function public.practice_has_access(p_practice_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.practices p
     where p.id = p_practice_id
       and (
            p.subscription_status in ('active', 'past_due')
         or (
              p.subscription_status = 'trialing'
              and p.stripe_subscription_id is not null
              and p.trial_ends_at > now()
            )
       )
  );
$$;

-- my_practice_has_access() and the RLS policies from billing.sql call
-- practice_has_access(), so they pick up the new rule automatically. No policy
-- changes are needed here.

-- 3. NOTE: existing practices keep whatever subscription_status they already
--    have. Any clinics you want to grandfather into free access should be left
--    at 'active' (they already pass the access check above). Card-less rows
--    still on the old default 'trialing' WITHOUT a stripe_subscription_id will
--    now be asked to add a card via Checkout — intended for the new model.
