-- =====================================================================
--  IČO z ARES: adresa sídla a jedno IČO = jeden řemeslnický účet
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–005.)
-- =====================================================================

alter table provider_profiles add column if not exists address text;

-- Jedno IČO smí mít jen jeden účet (brání opakovanému čerpání uvítacích kreditů).
-- Pokud už v databázi duplicitní IČO jsou (testovací účty), index se nevytvoří
-- a vypíše se upozornění – kontrola ve funkci níže ale platí i tak.
do $$
begin
  create unique index if not exists provider_profiles_ico_unique on provider_profiles (ico) where ico is not null;
exception when unique_violation then
  raise notice 'V databázi jsou duplicitní IČO, unikátní index nebyl vytvořen.';
end $$;

drop function if exists upsert_provider_profile(text, text, text, text, int[], int[]);

create or replace function upsert_provider_profile(
  p_company_name text, p_ico text, p_description text, p_city text,
  p_category_ids int[], p_region_ids int[], p_address text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_new bool;
  v_ico text := nullif(regexp_replace(coalesce(p_ico, ''), '\s', '', 'g'), '');
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;
  if coalesce(trim(p_company_name), '') = '' then raise exception 'CHYBI_NAZEV'; end if;
  if coalesce(array_length(p_category_ids, 1), 0) = 0 then raise exception 'CHYBI_OBOR'; end if;
  if coalesce(array_length(p_region_ids, 1), 0) = 0 then raise exception 'CHYBI_KRAJ'; end if;
  if v_ico is not null and exists (select 1 from provider_profiles where ico = v_ico and user_id <> v_uid) then
    raise exception 'ICO_UZ_REGISTROVANO';
  end if;

  v_is_new := not exists (select 1 from provider_profiles where user_id = v_uid);

  insert into provider_profiles (user_id, company_name, ico, description, city, address)
  values (v_uid, trim(p_company_name), v_ico, p_description, p_city, nullif(trim(p_address), ''))
  on conflict (user_id) do update
     set company_name = excluded.company_name, ico = excluded.ico,
         description = excluded.description, city = excluded.city, address = excluded.address;

  update profiles set role = 'provider' where id = v_uid and role = 'customer';

  delete from provider_categories where provider_id = v_uid;
  insert into provider_categories select v_uid, unnest(p_category_ids);
  delete from provider_regions where provider_id = v_uid;
  insert into provider_regions select v_uid, unnest(p_region_ids);

  if v_is_new and setting_int('signup_bonus_credits') > 0 then
    insert into credit_ledger (provider_id, kind, amount, note)
    values (v_uid, 'bonus', setting_int('signup_bonus_credits'), 'Uvítací kredity');
  end if;
end $$;
