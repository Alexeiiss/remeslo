-- =====================================================================
--  Profilová fotka řemeslníka
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–004.)
-- =====================================================================

alter table provider_profiles add column if not exists avatar_path text;

-- Řemeslník si nastaví (nebo smaže) profilovou fotku.
-- Soubor musí ležet v jeho vlastní složce úložiště provider-photos.
create or replace function set_my_avatar(p_path text)
returns text language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if auth.uid() is null then raise exception 'NEPRIHLASEN'; end if;
  if p_path is not null and split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'SPATNA_CESTA';
  end if;
  select avatar_path into v_old from provider_profiles where user_id = auth.uid();
  if not found then raise exception 'NEJSTE_REMESLNIK'; end if;
  update provider_profiles set avatar_path = p_path where user_id = auth.uid();
  return v_old;  -- stará fotka, aby ji web mohl smazat z úložiště
end $$;
