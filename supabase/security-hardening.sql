-- Security hardening from the Supabase Security Advisor run on 2026-07-04
-- (0 errors, 25 warnings). Run AFTER schema.sql + billing.sql in the SQL editor.
--
-- Safe for the live app:
--  * signup/join only call these RPCs with an active session (auth-sync.js
--    throws before calling them without one), so nothing runs as anon;
--  * functions referenced inside RLS policies (get_my_practice_id,
--    my_practice_has_access, practice_has_access, is_practice_admin) KEEP
--    their authenticated grant — RLS expressions execute as the querying
--    role, so revoking those would break board reads/writes.

-- ── 1. Pin search_path on trigger functions (4 warnings) ──────────────────
-- Prevents search-path hijacking; behavior unchanged (they only touch the
-- triggering row / pg_notify).
alter function public.update_updated_at_column()          set search_path = public;
alter function public.set_updated_at()                    set search_path = public;
alter function public.notify_board_state_change()         set search_path = public;
alter function public.set_practice_checklist_updated_at() set search_path = public;

-- ── 2. Remove signed-out (anon/PUBLIC) EXECUTE on SECURITY DEFINER RPCs ────
-- Postgres grants EXECUTE to PUBLIC by default; these should never be
-- callable without signing in. (billing.sql already did this for the two
-- *_has_access functions; repeated here so the file is complete on its own.)
revoke execute on function public.create_practice_with_admin(text, text)        from public, anon;
revoke execute on function public.create_unique_practice_invite_code(uuid)      from public, anon;
revoke execute on function public.get_my_practice_id()                          from public, anon;
revoke execute on function public.get_my_practice_invite_details()              from public, anon;
revoke execute on function public.get_server_now_iso()                          from public, anon;
revoke execute on function public.is_practice_admin(uuid)                       from public, anon;
revoke execute on function public.join_practice_with_invite_code(text, text)    from public, anon;
revoke execute on function public.rls_auto_enable()                             from public, anon;
revoke execute on function public.rotate_my_practice_invite_code()              from public, anon;
revoke execute on function public.my_practice_has_access()                      from public, anon;
revoke execute on function public.practice_has_access(uuid)                     from public, anon;

-- ── 3. Re-grant authenticated only where the app or RLS needs it ───────────
-- Called directly from auth-sync.js / standalone-flow.js:
grant execute on function public.create_practice_with_admin(text, text)     to authenticated;
grant execute on function public.join_practice_with_invite_code(text, text) to authenticated;
grant execute on function public.get_my_practice_invite_details()           to authenticated;
grant execute on function public.rotate_my_practice_invite_code()           to authenticated;
grant execute on function public.get_server_now_iso()                       to authenticated;
-- Referenced inside RLS policies (must stay executable by authenticated):
grant execute on function public.get_my_practice_id()                       to authenticated;
grant execute on function public.my_practice_has_access()                   to authenticated;
grant execute on function public.practice_has_access(uuid)                  to authenticated;
grant execute on function public.is_practice_admin(uuid)                    to authenticated;

-- Deliberately NOT re-granted to authenticated (internal-only; they still
-- work when called inside the SECURITY DEFINER functions above, which run
-- as the function owner):
--   create_unique_practice_invite_code(uuid)  — invite-code generator
--   rls_auto_enable()                         — event-trigger helper
-- The two "Signed-In Users Can Execute SECURITY DEFINER" advisor warnings
-- that remain for the RLS/app functions above are by design: they ARE the
-- app's RPC API and are all keyed on auth.uid().

-- ── 4. Leaked-password protection (1 warning) ──────────────────────────────
-- Deliberately NOT enabled (user decision 2026-07-04) — this advisor warning
-- is expected to persist. If ever wanted: Dashboard > Authentication >
-- Sign In / Providers > Passwords > "Leaked password protection".
