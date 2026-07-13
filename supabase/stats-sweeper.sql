-- RoomBoard stats sweeper
-- Server-side backstop for stopwatch statistics: closes room/cleaning stat
-- sessions that have been open for more than 48 hours. Clients normally close
-- their own sessions (with a localStorage retry outbox in auth-sync.js), but a
-- device that dies mid-session and never comes back would leave the row open
-- forever and show up as an orphan in the stopwatch diagnostics panel.
--
-- The 48h threshold stays clear of legitimate overnight hospitalizations.
-- Durations are capped (1h room / 30min cleaning) because the real duration is
-- unknowable for an abandoned row and a multi-day value would poison averages.
--
-- Requires pg_cron (available on hosted Supabase; run this in the SQL editor).

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
     and started_at < now() - interval '48 hours';
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
