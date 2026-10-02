-- =====================================================================
--  Fáze 2: zprávy, reklamace, fotky prací, expirace kreditů, administrace
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001, 002 a 003.)
-- =====================================================================

-- Nový typ pohybu kreditů: propadnutí po 12 měsících
alter type ledger_kind add value if not exists 'expire';

insert into settings (key, value) values
  ('credit_lifetime_months', '12'),
  ('dispute_window_days',    '30')
on conflict (key) do nothing;

-- ---------- Pomocné ----------
create or replace function is_admin() returns bool
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Skryje e-maily a telefonní čísla (kontakt se předává až po výběru)
create or replace function mask_contacts(p_text text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(coalesce(p_text, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[kontakt skryt]', 'g'),
           '(\+?[0-9][ -]?){9,}', '[kontakt skryt] ', 'g')
$$;

-- =====================================================================
--  ZPRÁVY: vlákno = poptávka + řemeslník, který na ni nabízel
-- =====================================================================
create table messages (
  id           bigserial primary key,
  request_id   uuid not null references job_requests(id) on delete cascade,
  provider_id  uuid not null references provider_profiles(user_id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 3000),
  created_at   timestamptz not null default now()
);
create index on messages (request_id, provider_id, created_at);

alter table messages enable row level security;
create policy "ucastnici vlakna" on messages for select using (
  provider_id = auth.uid() or request_id in (select my_request_ids())
);

-- Pošle zprávu. Dokud zákazník nevybral, kontakty se automaticky skrývají.
create or replace function send_message(p_request_id uuid, p_provider_id uuid, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req job_requests;
  v_offer offers;
  v_body text;
  v_id bigint;
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;
  select * into v_req from job_requests where id = p_request_id;
  if not found then raise exception 'POPTAVKA_NEEXISTUJE'; end if;
  if v_uid <> v_req.customer_id and v_uid <> p_provider_id then raise exception 'NENI_VASE_VLAKNO'; end if;

  select * into v_offer from offers where request_id = p_request_id and provider_id = p_provider_id;
  if not found then raise exception 'NENI_VASE_VLAKNO'; end if;
  if v_offer.status = 'withdrawn' then raise exception 'VLAKNO_UZAVRENO'; end if;
  if v_offer.status = 'rejected' then raise exception 'VLAKNO_UZAVRENO'; end if;

  v_body := trim(coalesce(p_body, ''));
  if v_body = '' then raise exception 'PRAZDNA_ZPRAVA'; end if;
  if v_offer.status <> 'selected' then v_body := mask_contacts(v_body); end if;

  insert into messages (request_id, provider_id, sender_id, body)
  values (p_request_id, p_provider_id, v_uid, left(v_body, 3000))
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
--  REKLAMACE: vybraný řemeslník může do 30 dnů požádat o vrácení kreditů
--  (např. falešná poptávka, zákazník nereaguje). Rozhoduje admin.
-- =====================================================================
create type dispute_status as enum ('open', 'approved', 'rejected');

create table disputes (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null unique references offers(id) on delete cascade,
  provider_id  uuid not null references provider_profiles(user_id) on delete cascade,
  reason       text not null check (char_length(reason) between 10 and 2000),
  status       dispute_status not null default 'open',
  admin_note   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table disputes enable row level security;
create policy "vlastni reklamace" on disputes for select using (provider_id = auth.uid() or is_admin());

create or replace function open_dispute(p_offer_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_offer offers; v_id uuid;
begin
  select * into v_offer from offers where id = p_offer_id;
  if not found or v_offer.provider_id is distinct from auth.uid() then raise exception 'NABIDKA_NEEXISTUJE'; end if;
  if v_offer.status <> 'selected' then raise exception 'REKLAMACE_NELZE'; end if;
  if v_offer.decided_at < now() - make_interval(days => setting_int('dispute_window_days')) then
    raise exception 'REKLAMACE_PO_LHUTE';
  end if;
  if exists (select 1 from disputes where offer_id = p_offer_id) then raise exception 'REKLAMACE_UZ_EXISTUJE'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'REKLAMACE_KRATKY_DUVOD'; end if;

  insert into disputes (offer_id, provider_id, reason) values (p_offer_id, v_offer.provider_id, trim(p_reason))
  returning id into v_id;
  return v_id;
end $$;

-- Admin rozhodne. Při schválení se řemeslníkovi vrátí kredity za zakázku.
create or replace function resolve_dispute(p_dispute_id uuid, p_approve bool, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_d disputes; v_cost int;
begin
  if not is_admin() then raise exception 'JEN_ADMIN'; end if;
  select * into v_d from disputes where id = p_dispute_id for update;
  if not found then raise exception 'REKLAMACE_NEEXISTUJE'; end if;
  if v_d.status <> 'open' then raise exception 'REKLAMACE_VYRIZENA'; end if;

  update disputes
     set status = case when p_approve then 'approved'::dispute_status else 'rejected'::dispute_status end,
         admin_note = nullif(trim(p_note), ''), resolved_at = now()
   where id = p_dispute_id;

  if p_approve then
    select credits_cost into v_cost from offers where id = v_d.offer_id;
    insert into credit_ledger (provider_id, kind, amount, offer_id, note)
    values (v_d.provider_id, 'refund', v_cost, v_d.offer_id, 'Reklamace uznána – kredity vráceny');
  end if;
end $$;

-- Admin ručně přidá / ubere kredity (kladné číslo = přidat)
create or replace function admin_adjust_credits(p_provider uuid, p_amount int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'JEN_ADMIN'; end if;
  if p_amount = 0 then return; end if;
  if not exists (select 1 from provider_profiles where user_id = p_provider) then raise exception 'NEJSTE_REMESLNIK'; end if;
  if p_amount < 0 and credits_available(p_provider) + p_amount < 0 then raise exception 'NEDOSTATEK_KREDITU'; end if;
  insert into credit_ledger (provider_id, kind, amount, note)
  values (p_provider, 'adjust', p_amount, coalesce(nullif(trim(p_note), ''), 'Ruční úprava'));
end $$;

-- =====================================================================
--  EXPIRACE KREDITŮ (nejstarší kredity se spotřebují první)
--  Propadne jen ta část kreditů starších než 12 měsíců, která ještě nebyla utracena.
-- =====================================================================
create or replace function expire_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_cutoff timestamptz := now() - make_interval(months => setting_int('credit_lifetime_months'));
  v_old_in int; v_spent int; v_expired int; v_to_expire int; n int := 0;
begin
  for r in select user_id from provider_profiles loop
    perform 1 from provider_profiles where user_id = r.user_id for update;

    -- kredity připsané před hranicí (nákup, bonus, ruční přidání)
    select coalesce(sum(amount), 0) into v_old_in from credit_ledger
     where provider_id = r.user_id and created_at < v_cutoff
       and (kind in ('purchase', 'bonus') or (kind = 'adjust' and amount > 0));
    -- vše, co se kdy utratilo nebo ubralo (stržené zakázky, zablokované, ruční ubrání)
    select coalesce(-sum(amount), 0) into v_spent from credit_ledger
     where provider_id = r.user_id
       and (kind in ('hold', 'release', 'refund') or (kind = 'adjust' and amount < 0));
    select coalesce(-sum(amount), 0) into v_expired from credit_ledger
     where provider_id = r.user_id and kind::text = 'expire';

    v_to_expire := least(greatest(v_old_in - greatest(v_spent, 0) - v_expired, 0), credits_available(r.user_id));
    if v_to_expire > 0 then
      insert into credit_ledger (provider_id, kind, amount, note)
      values (r.user_id, 'expire'::text::ledger_kind, -v_to_expire, 'Kredity propadly (starší než 12 měsíců)');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- =====================================================================
--  FOTKY PRACÍ řemeslníka (veřejné, na profilu)
-- =====================================================================
create table provider_photos (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references provider_profiles(user_id) on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);
alter table provider_photos enable row level security;
create policy "verejne" on provider_photos for select using (true);
create policy "vlastni pridava" on provider_photos for insert with check (provider_id = auth.uid());
create policy "vlastni maze" on provider_photos for delete using (provider_id = auth.uid());

-- =====================================================================
--  Přístupy
-- =====================================================================
revoke execute on function expire_credits() from public, anon, authenticated;

-- Admin vidí všechno (pro čtení; zápisy jen přes funkce výše)
create policy "admin vidi" on profiles      for select using (is_admin());
create policy "admin vidi" on job_requests  for select using (is_admin());
create policy "admin vidi" on offers        for select using (is_admin());
create policy "admin vidi" on credit_ledger for select using (is_admin());
create policy "admin vidi" on payments      for select using (is_admin());
create policy "admin vidi" on messages      for select using (is_admin());

-- ==================== STORAGE (fotky prací) ====================
insert into storage.buckets (id, name, public)
values ('provider-photos', 'provider-photos', true)
on conflict (id) do nothing;

create policy "remeslnik nahrava sve fotky" on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "remeslnik maze sve fotky" on storage.objects for delete to authenticated
  using (bucket_id = 'provider-photos' and (storage.foldername(name))[1] = auth.uid()::text);
