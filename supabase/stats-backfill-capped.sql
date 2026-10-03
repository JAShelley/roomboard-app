-- One-time cleanup of stopwatch durations poisoned before the sweeper existed
-- ===========================================================================
-- RUN supabase/stats-sweeper.sql FIRST. This only repairs history; the sweeper
-- is what stops it happening again.
--
-- These rows were closed (or adopted) long after the real event ended, so their
-- stored duration is the wall-clock gap, not the actual room or clean time —
-- up to 14.5 days. They drag every average in the Stats dashboard.
--
-- This caps them to the same values the sweeper would have written, i.e. "what
-- this row would say if the sweeper had been running all along". It does NOT
-- delete anything, and it leaves ended_at alone so the event still appears on
-- the right day.
--
-- STEP 1 — preview. Run this alone first and look at the counts.
-- ===========================================================================

select 'cleaning_sessions' as table_name,
       count(*) filter (where duration_ms > 4 * 60 * 60 * 1000)  as rows_to_cap,
       count(*)                                                   as rows_total,
       round(max(duration_ms) / 60000.0)                          as current_max_minutes
  from public.cleaning_sessions
 where ended_at is not null
union all
select 'room_sessions',
       count(*) filter (where duration_ms > 48 * 60 * 60 * 1000),
       count(*),
       round(max(duration_ms) / 60000.0)
  from public.room_sessions
 where ended_at is not null;

-- ===========================================================================
-- STEP 2 — apply. Run this only once you are happy with the preview above.
-- Uncomment the two statements and run them.
-- ===========================================================================

-- update public.cleaning_sessions
--    set duration_ms = 30 * 60 * 1000
--  where ended_at is not null
--    and duration_ms > 4 * 60 * 60 * 1000;

-- update public.room_sessions
--    set duration_ms = 60 * 60 * 1000
--  where ended_at is not null
--    and duration_ms > 48 * 60 * 60 * 1000;
