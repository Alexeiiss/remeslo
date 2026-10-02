-- =====================================================================
--  Živá upozornění: web se dozví o novém upozornění okamžitě (Supabase Realtime)
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–008.)
-- =====================================================================

-- Zapne posílání změn tabulky upozornění do prohlížeče.
-- Každý uživatel dostane jen svoje řádky (platí pravidla přístupu RLS).
do $$
begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then
  null; -- už zapnuto
end $$;
