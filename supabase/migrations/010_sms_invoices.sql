-- =====================================================================
--  SMS ověření telefonu + faktury (Fakturoid)
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–009.)
-- =====================================================================

-- ---------- Faktury k nákupům kreditů ----------
alter table payments add column if not exists invoice_id     bigint;
alter table payments add column if not exists invoice_number text;
alter table payments add column if not exists invoice_url    text;

-- ---------- SMS ověření telefonu ----------
-- 0 = poptávku jde zadat i s neověřeným telefonem (výchozí, dokud není nastavená SMS brána)
-- 1 = poptávku jde zadat jen s ověřeným telefonem
insert into settings (key, value) values ('require_phone_verification', '0')
on conflict (key) do nothing;

-- Po ověření SMS kódem (Supabase Auth) zapíše ověření do profilu.
-- Ověřený je jen telefon, který se shoduje s číslem potvrzeným v Supabase Auth.
create or replace function verify_my_phone()
returns bool language plpgsql security definer set search_path = public, auth as $$
declare v_auth_phone text; v_confirmed timestamptz; v_profile_phone text;
begin
  if auth.uid() is null then raise exception 'NEPRIHLASEN'; end if;
  select phone, phone_confirmed_at into v_auth_phone, v_confirmed from auth.users where id = auth.uid();
  select phone into v_profile_phone from profiles where id = auth.uid();
  if v_confirmed is null or v_auth_phone is null then return false; end if;
  -- porovnat jen číslice (Auth ukládá „420777…“, profil „+420 777 …“)
  if right(regexp_replace(coalesce(v_profile_phone, ''), '\D', '', 'g'), 9)
     <> right(regexp_replace(v_auth_phone, '\D', '', 'g'), 9) then
    -- profil má jiné číslo → převezmeme ověřené číslo z Auth
    update profiles set phone = '+' || regexp_replace(v_auth_phone, '\D', '', 'g') where id = auth.uid();
  end if;
  update profiles set phone_verified = true where id = auth.uid();
  return true;
end $$;

-- Zadání poptávky – nově s kontrolou ověřeného telefonu (pokud je zapnutá)
create or replace function create_request(
  p_category_id int, p_region_id int, p_city text, p_title text,
  p_description text, p_size job_size, p_preferred_start text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_profile profiles;
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;
  select * into v_profile from profiles where id = v_uid;
  if v_profile.phone is null then raise exception 'CHYBI_TELEFON'; end if;
  if setting_int('require_phone_verification') = 1 and not v_profile.phone_verified then
    raise exception 'TELEFON_NEOVEREN';
  end if;

  insert into job_requests (customer_id, category_id, region_id, city, title, description,
                            size, preferred_start, max_offers, expires_at)
  values (v_uid, p_category_id, p_region_id, trim(p_city), trim(p_title), trim(p_description),
          p_size, p_preferred_start, setting_int('max_offers_per_request'),
          now() + make_interval(days => setting_int('request_lifetime_days')))
  returning id into v_id;
  return v_id;
end $$;
