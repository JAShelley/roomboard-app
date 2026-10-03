-- RoomBoard stats sweeper
-- ===========================================================================
-- Server-side backstop for stopwatch statistics: closes room/cleaning stat
-- sessions that have been left open. Clients normally close their own (with a
-- localStorage retry outbox in auth-sync.js), but the common leak is
-- CROSS-CLIENT: device A opens the session, device B marks the room clean, and
-- device B has no session id to close because the board merges fields
-- independently and the id syncs last-writer-wins. Device A's row then stays
-- open forever, accruing duration, and poisons every average in Stats.
--
-- Measured on prod 2026-10-03 before this was installed:
--   cleaning_sessions  median 4.1 min, p90 63 min, max 12,915 min (9 DAYS)
--                      63 of 979 rows (6.4%) over two hours
--   room_sessions      median 57 min,  p90 115 min, max 20,885 min (14.5 days)
--                      14 of 993 rows (1.4%) over four hours
--
-- Thresholds are deliberately different:
--   room     48h — must clear legitimate overnight hospitalisation.
--   cleaning  4h — a clean has a 4-minute median and a 63-minute p90, so a
--                  4h row is already impossible. The original 48h here let a
--                  stuck clean accrue two days before anything noticed.
--
-- Durations are CAPPED rather than computed, because the true duration of an
-- abandoned row is unknowable and a multi-day value poisons the mean.
--
-- Requires pg_cron (available on hosted Supabase). Safe to run more than once.
-- ===========================================================================

create extension if not exists pg_cron;

create or replace function public.close_stale_stat_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.room_sessions
     set ended_at = started_at + interval '1 hour',
         duration_ms = 60 * 60 * 1000
   where ended_at is null
     and started_at < now() - interval '48 hours';

  update public.cleaning_sessions
     set ended_at = started_at + interval '30 minutes',
         duration_ms = 30 * 60 * 1000
   where ended_at is null
     and started_at < now() - interval '4 hours';
$$;

-- Only the cron scheduler should run this; don't expose it through the API.
revoke execute on function public.close_stale_stat_sessions() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'close-stale-stat-sessions') then
    perform cron.unschedule('close-stale-stat-sessions');
  end if;
end$$;

select cron.schedule(
  'close-stale-stat-sessions',
  '27 * * * *',
  $$select public.close_stale_stat_sessions()$$
);

-- Close anything already stale right now, rather than waiting for the next tick.
select public.close_stale_stat_sessions();
