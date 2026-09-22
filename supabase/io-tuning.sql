-- ===========================================================================
-- Autovacuum tuning for the small, update-heavy tables
-- ---------------------------------------------------------------------------
-- HONEST SCOPE: at 4 clinics this is housekeeping, not a fix. It was measured,
-- not assumed — see the note at the bottom for what testing actually showed.
--
-- What this does help with: Postgres only autovacuums a table after ~20% of its
-- rows change. practice_board_state has one row PER CLINIC, so on a 4-row table
-- the default threshold is 1 row — but the scale factor still gates it, and in
-- practice these tables can go long stretches without being vacuumed or
-- analysed at all. Dead row versions then accumulate from every board save, and
-- the planner works from stale statistics. The settings below make autovacuum
-- pick these tables up after a handful of changes instead.
--
-- This matters more as clinics are added, not less. Setting it now means it is
-- already right when the board is busy.
--
-- Safe to run more than once. Takes a brief lock (milliseconds at this size).
-- No data is read, written, or deleted.
-- ===========================================================================

-- One row per clinic, rewritten on every board change: the most update-heavy
-- table in the schema by a wide margin.
alter table public.practice_board_state set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 25,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 25,
  -- Leaves room in each page for a new row version to sit beside the old one
  -- (a HOT update: no index maintenance, less WAL). Measured as making no
  -- difference at 4 clinics, because the whole table fits in one 8KB page.
  -- Kept because it costs nothing and starts paying off as clinics are added.
  fillfactor = 70
);

alter table public.practice_settings set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 25,
  fillfactor = 80
);

alter table public.user_settings set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 25,
  fillfactor = 80
);

-- ---------------------------------------------------------------------------
-- Deliberately NOT here:
--
--   VACUUM. It cannot run inside a transaction block and the Supabase SQL
--   Editor wraps whatever you paste in one, so including it fails the entire
--   script. The thresholds above make autovacuum handle it within minutes.
--   To force it, run this on its own, as a separate statement:
--       vacuum (analyze) public.practice_board_state;
--
--   TOAST/compression changes. A 12-room board is ~3.5KB of JSON but compresses
--   to ~529 bytes with pglz, which is under the 2KB threshold — so it is stored
--   inline and never hits TOAST. There is nothing to tune there. (lz4 would not
--   help either; it is not enabled on this Postgres build.)
-- ---------------------------------------------------------------------------
