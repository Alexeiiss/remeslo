-- =====================================================================
--  Řemeslo.cz (pracovní název) – databáze, fáze 1
--  Spustit v Supabase: SQL Editor → vložit → Run
--  Princip kreditů: při nabídce se kredity ZABLOKUJÍ (hold),
--  vybranému řemeslníkovi se STRHNOU (capture), ostatním se VRÁTÍ (release).
-- =====================================================================

-- ---------- Typy ----------
create type user_role      as enum ('customer', 'provider', 'admin');
create type request_status as enum ('open', 'assigned', 'expired', 'cancelled');
create type offer_status   as enum ('pending', 'selected', 'rejected', 'withdrawn');
create type job_size       as enum ('small', 'medium', 'large', 'xlarge');
create type payment_status as enum ('pending', 'paid', 'failed', 'cancelled');
create type ledger_kind    as enum ('purchase', 'bonus', 'hold', 'capture', 'release', 'refund', 'adjust');

-- ---------- Nastavení (ceník, limity) ----------
create table settings (
  key   text primary key,
  value jsonb not null
);
insert into settings (key, value) values
  ('max_offers_per_request', '4'),
  ('request_lifetime_days',  '30'),
  ('reminder_after_days',    '14'),
  ('signup_bonus_credits',   '200');

-- Kolik kreditů stojí ZÍSKANÁ zakázka podle velikosti (1 kredit = 1 Kč)
create table job_size_prices (
  size        job_size primary key,
  label       text not null,
  credits     int  not null check (credits > 0),
  sort_order  int  not null
);
insert into job_size_prices values
  ('small',  'Malá (do 5 000 Kč)',          50, 1),
  ('medium', 'Střední (5 000 – 50 000 Kč)', 150, 2),
  ('large',  'Velká (50 000 – 300 000 Kč)', 400, 3),
  ('xlarge', 'Velmi velká (nad 300 000 Kč)', 800, 4);

-- Balíčky kreditů k nákupu (cena v Kč vč. DPH, bonus v %)
create table credit_packages (
  code        text primary key,
  label       text not null,
  price_czk   int  not null check (price_czk > 0),
  credits     int  not null check (credits > 0),
  active      bool not null default true,
  sort_order  int  not null
);
insert into credit_packages values
  ('p500',  'Start',     500,  500, true, 1),
  ('p1500', 'Standard', 1500, 1650, true, 2),  -- +10 %
  ('p5000', 'Profi',    5000, 6000, true, 3);  -- +20 %

-- ---------- Číselníky ----------
create table categories (
  id         serial primary key,
  parent_id  int references categories(id),
  slug       text unique not null,
  name       text not null,
  sort_order int not null default 0
);

create table regions (
  id    serial primary key,
  slug  text unique not null,
  name  text not null
);

insert into regions (slug, name) values
  ('praha', 'Hlavní město Praha'), ('stredocesky', 'Středočeský kraj'),
  ('jihocesky', 'Jihočeský kraj'), ('plzensky', 'Plzeňský kraj'),
  ('karlovarsky', 'Karlovarský kraj'), ('ustecky', 'Ústecký kraj'),
  ('liberecky', 'Liberecký kraj'), ('kralovehradecky', 'Královéhradecký kraj'),
  ('pardubicky', 'Pardubický kraj'), ('vysocina', 'Kraj Vysočina'),
  ('jihomoravsky', 'Jihomoravský kraj'), ('olomoucky', 'Olomoucký kraj'),
  ('zlinsky', 'Zlínský kraj'), ('moravskoslezsky', 'Moravskoslezský kraj');

insert into categories (slug, name, sort_order) values
  ('elektrikar', 'Elektrikář', 1), ('instalater', 'Instalatér', 2),
  ('zednik', 'Zedník', 3), ('malir', 'Malíř a natěrač', 4),
  ('podlahar', 'Podlahář', 5), ('obkladac', 'Obkladač', 6),
  ('truhlar', 'Truhlář', 7), ('pokryvac', 'Pokrývač a klempíř', 8),
  ('sadrokarton', 'Sádrokartonář', 9), ('topenar', 'Topenář', 10),
  ('zahradnik', 'Zahradník', 11), ('ploty-terasy', 'Ploty a terasy', 12),
  ('hodinovy-manzel', 'Hodinový manžel', 13), ('fotovoltaika', 'Fotovoltaika', 14),
  ('stehovani', 'Stěhování', 15), ('uklid', 'Úklid', 16);

-- ---------- Uživatelé ----------
-- Řádek v profiles se vytvoří automaticky po registraci (trigger níže).
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'customer',
  full_name       text,
  email           text,
  phone           text,
  phone_verified  bool not null default false,
  created_at      timestamptz not null default now()
);

create table provider_profiles (
  user_id       uuid primary key references profiles(id) on delete cascade,
  company_name  text not null,
  ico           text check (ico is null or ico ~ '^[0-9]{8}$'),
  description   text,
  city          text,
  rating_avg    numeric(3,2),
  rating_count  int not null default 0,
  created_at    timestamptz not null default now()
);

create table provider_categories (
  provider_id  uuid references provider_profiles(user_id) on delete cascade,
  category_id  int  references categories(id) on delete cascade,
  primary key (provider_id, category_id)
);

create table provider_regions (
  provider_id  uuid references provider_profiles(user_id) on delete cascade,
  region_id    int  references regions(id) on delete cascade,
  primary key (provider_id, region_id)
);

-- ---------- Poptávky a nabídky ----------
create table job_requests (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references profiles(id) on delete cascade,
  category_id        int  not null references categories(id),
  region_id          int  not null references regions(id),
  city               text not null,
  title              text not null check (char_length(title) between 5 and 120),
  description        text not null check (char_length(description) between 20 and 5000),
  size               job_size not null,
  preferred_start    text,
  status             request_status not null default 'open',
  max_offers         int not null default 4,
  offers_count       int not null default 0,
  selected_offer_id  uuid,
  reminder_sent_at   timestamptz,
  expires_at         timestamptz not null default now() + interval '30 days',
  created_at         timestamptz not null default now(),
  closed_at          timestamptz
);
create index on job_requests (status, category_id, region_id);
create index on job_requests (customer_id);

create table request_photos (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references job_requests(id) on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

create table offers (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references job_requests(id) on delete cascade,
  provider_id   uuid not null references provider_profiles(user_id) on delete cascade,
  price_czk     int  not null check (price_czk > 0),
  start_date    date,
  message       text not null check (char_length(message) between 10 and 3000),
  credits_cost  int  not null,
  status        offer_status not null default 'pending',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  unique (request_id, provider_id)
);
create index on offers (provider_id, status);

alter table job_requests
  add constraint job_requests_selected_offer_fk
  foreign key (selected_offer_id) references offers(id);

-- ---------- Kredity a platby ----------
create table payments (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references provider_profiles(user_id),
  package_code  text not null references credit_packages(code),
  credits       int  not null,
  price_czk     int  not null,
  status        payment_status not null default 'pending',
  gateway       text not null default 'comgate',
  gateway_ref   text unique,          -- transId z Comgate
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

-- KNIHA POHYBŮ KREDITŮ. Nikdy se nemaže ani nepřepisuje.
-- amount = změna DOSTUPNÝCH kreditů:
--   purchase/bonus/release/refund  → kladné
--   hold                           → záporné (kredity zablokované v nabídce)
--   capture                        → 0 (zablokované kredity se definitivně spotřebují)
create table credit_ledger (
  id           bigserial primary key,
  provider_id  uuid not null references provider_profiles(user_id),
  kind         ledger_kind not null,
  amount       int not null,
  offer_id     uuid references offers(id),
  payment_id   uuid references payments(id),
  note         text,
  created_at   timestamptz not null default now()
);
create index on credit_ledger (provider_id, created_at desc);
-- Jedna platba = jedno připsání (ochrana proti dvojímu webhooku)
create unique index credit_ledger_one_purchase_per_payment
  on credit_ledger (payment_id) where kind = 'purchase';
-- Každá nabídka může být zablokována / stržena / vrácena jen jednou
create unique index credit_ledger_one_event_per_offer
  on credit_ledger (offer_id, kind) where offer_id is not null;

-- Přehled kreditů řemeslníka
create view provider_credit_balance with (security_invoker = true) as
select
  pp.user_id as provider_id,
  coalesce((select sum(amount) from credit_ledger l where l.provider_id = pp.user_id), 0)::int
    as available,
  coalesce((select sum(credits_cost) from offers o
            where o.provider_id = pp.user_id and o.status = 'pending'), 0)::int
    as held
from provider_profiles pp;

-- =====================================================================
--  Pomocné funkce
-- =====================================================================
create or replace function setting_int(p_key text) returns int
language sql stable as $$ select (value #>> '{}')::int from settings where key = p_key $$;

create or replace function credits_available(p_provider uuid) returns int
language sql stable as $$
  select coalesce(sum(amount), 0)::int from credit_ledger where provider_id = p_provider
$$;

-- Po registraci v Supabase Auth vytvoří profil
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
--  Akce volané z webu (supabase.rpc). Veškerá logika kreditů je TADY,
--  web nemůže kredity měnit napřímo.
-- =====================================================================

-- Úprava vlastního profilu (jméno, telefon)
create or replace function update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NEPRIHLASEN'; end if;
  update profiles
     set full_name = nullif(trim(p_full_name), ''),
         phone_verified = case when phone is distinct from p_phone then false else phone_verified end,
         phone = nullif(trim(p_phone), '')
   where id = auth.uid();
end $$;

-- Registrace / úprava řemeslnického profilu.
-- Při PRVNÍ registraci řemeslník dostane uvítací kredity.
create or replace function upsert_provider_profile(
  p_company_name text, p_ico text, p_description text, p_city text,
  p_category_ids int[], p_region_ids int[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_new bool;
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;
  if coalesce(trim(p_company_name), '') = '' then raise exception 'CHYBI_NAZEV'; end if;
  if coalesce(array_length(p_category_ids, 1), 0) = 0 then raise exception 'CHYBI_OBOR'; end if;
  if coalesce(array_length(p_region_ids, 1), 0) = 0 then raise exception 'CHYBI_KRAJ'; end if;

  v_is_new := not exists (select 1 from provider_profiles where user_id = v_uid);

  insert into provider_profiles (user_id, company_name, ico, description, city)
  values (v_uid, trim(p_company_name), nullif(trim(p_ico), ''), p_description, p_city)
  on conflict (user_id) do update
     set company_name = excluded.company_name, ico = excluded.ico,
         description = excluded.description, city = excluded.city;

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

-- Zákazník zadá poptávku
create or replace function create_request(
  p_category_id int, p_region_id int, p_city text, p_title text,
  p_description text, p_size job_size, p_preferred_start text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;
  if not exists (select 1 from profiles where id = v_uid and phone is not null) then
    raise exception 'CHYBI_TELEFON';
  end if;

  insert into job_requests (customer_id, category_id, region_id, city, title, description,
                            size, preferred_start, max_offers, expires_at)
  values (v_uid, p_category_id, p_region_id, trim(p_city), trim(p_title), trim(p_description),
          p_size, p_preferred_start, setting_int('max_offers_per_request'),
          now() + make_interval(days => setting_int('request_lifetime_days')))
  returning id into v_id;
  return v_id;
end $$;

-- Řemeslník pošle nabídku → kredity se ZABLOKUJÍ
create or replace function place_offer(
  p_request_id uuid, p_price_czk int, p_start_date date, p_message text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req job_requests;
  v_cost int;
  v_offer_id uuid;
begin
  if v_uid is null then raise exception 'NEPRIHLASEN'; end if;

  -- zamknout řemeslníka (ochrana proti dvěma nabídkám naráz s jedněmi kredity)
  perform 1 from provider_profiles where user_id = v_uid for update;
  if not found then raise exception 'NEJSTE_REMESLNIK'; end if;

  -- zamknout poptávku (ochrana proti 5. nabídce)
  select * into v_req from job_requests where id = p_request_id for update;
  if not found then raise exception 'POPTAVKA_NEEXISTUJE'; end if;
  if v_req.customer_id = v_uid then raise exception 'VLASTNI_POPTAVKA'; end if;
  if v_req.status <> 'open' or v_req.expires_at < now() then raise exception 'POPTAVKA_UZAVRENA'; end if;
  if not exists (select 1 from provider_categories
                 where provider_id = v_uid and category_id = v_req.category_id) then
    raise exception 'MIMO_VAS_OBOR';
  end if;
  if exists (select 1 from offers where request_id = p_request_id and provider_id = v_uid) then
    raise exception 'NABIDKA_UZ_EXISTUJE';
  end if;
  if v_req.offers_count >= v_req.max_offers then raise exception 'PLNY_POCET_NABIDEK'; end if;

  select credits into v_cost from job_size_prices where size = v_req.size;
  if credits_available(v_uid) < v_cost then raise exception 'NEDOSTATEK_KREDITU'; end if;

  insert into offers (request_id, provider_id, price_czk, start_date, message, credits_cost)
  values (p_request_id, v_uid, p_price_czk, p_start_date, trim(p_message), v_cost)
  returning id into v_offer_id;

  insert into credit_ledger (provider_id, kind, amount, offer_id, note)
  values (v_uid, 'hold', -v_cost, v_offer_id, 'Zablokováno za nabídku');

  update job_requests set offers_count = offers_count + 1 where id = p_request_id;
  return v_offer_id;
end $$;

-- Interní: vrátí kredity za čekající nabídku
create or replace function _release_offer(p_offer offers, p_new_status offer_status, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update offers set status = p_new_status, decided_at = now() where id = p_offer.id;
  insert into credit_ledger (provider_id, kind, amount, offer_id, note)
  values (p_offer.provider_id, 'release', p_offer.credits_cost, p_offer.id, p_note);
end $$;

-- Řemeslník stáhne nabídku (dokud zákazník nevybral) → kredity zpět
create or replace function withdraw_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_offer offers;
begin
  select * into v_offer from offers where id = p_offer_id for update;
  if not found or v_offer.provider_id <> auth.uid() then raise exception 'NABIDKA_NEEXISTUJE'; end if;
  if v_offer.status <> 'pending' then raise exception 'NABIDKU_NELZE_STAHNOUT'; end if;
  perform 1 from job_requests where id = v_offer.request_id for update;
  perform _release_offer(v_offer, 'withdrawn', 'Nabídka stažena');
  update job_requests set offers_count = offers_count - 1 where id = v_offer.request_id;
end $$;

-- ZÁKAZNÍK VYBERE ŘEMESLNÍKA
--  → vybranému se kredity strhnou, všem ostatním se vrátí. Vše v jedné transakci.
create or replace function select_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer offers;
  v_req job_requests;
  r offers;
begin
  select * into v_offer from offers where id = p_offer_id;
  if not found then raise exception 'NABIDKA_NEEXISTUJE'; end if;

  select * into v_req from job_requests where id = v_offer.request_id for update;
  if v_req.customer_id is distinct from auth.uid() then raise exception 'NENI_VASE_POPTAVKA'; end if;
  if v_req.status <> 'open' then raise exception 'POPTAVKA_UZAVRENA'; end if;

  select * into v_offer from offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then raise exception 'NABIDKA_NENI_AKTIVNI'; end if;

  -- 1) vybraný: strhnout
  update offers set status = 'selected', decided_at = now() where id = v_offer.id;
  insert into credit_ledger (provider_id, kind, amount, offer_id, note)
  values (v_offer.provider_id, 'capture', 0, v_offer.id, 'Zakázka získána – kredity strženy');

  -- 2) ostatní: vrátit
  for r in select * from offers
            where request_id = v_req.id and status = 'pending' and id <> v_offer.id
            for update
  loop
    perform _release_offer(r, 'rejected', 'Zákazník vybral jiného řemeslníka – kredity vráceny');
  end loop;

  update job_requests
     set status = 'assigned', selected_offer_id = v_offer.id, closed_at = now()
   where id = v_req.id;
end $$;

-- Zákazník zruší poptávku → všem se kredity vrátí
create or replace function cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_req job_requests; r offers;
begin
  select * into v_req from job_requests where id = p_request_id for update;
  if not found or v_req.customer_id <> auth.uid() then raise exception 'NENI_VASE_POPTAVKA'; end if;
  if v_req.status <> 'open' then raise exception 'POPTAVKA_UZAVRENA'; end if;

  for r in select * from offers where request_id = p_request_id and status = 'pending' for update
  loop
    perform _release_offer(r, 'rejected', 'Zákazník poptávku zrušil – kredity vráceny');
  end loop;
  update job_requests set status = 'cancelled', closed_at = now() where id = p_request_id;
end $$;

-- Denní úloha: propadlé poptávky → vrátit kredity. Vrací počet uzavřených poptávek.
create or replace function expire_requests()
returns int language plpgsql security definer set search_path = public as $$
declare v_req job_requests; r offers; n int := 0;
begin
  for v_req in select * from job_requests
                where status = 'open' and expires_at < now() for update skip locked
  loop
    for r in select * from offers where request_id = v_req.id and status = 'pending' for update
    loop
      perform _release_offer(r, 'rejected', 'Poptávka vypršela – kredity vráceny');
    end loop;
    update job_requests set status = 'expired', closed_at = now() where id = v_req.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Platební brána potvrdila platbu → připsat kredity (idempotentní, volá jen server)
create or replace function confirm_payment(p_payment_id uuid, p_gateway_ref text)
returns bool language plpgsql security definer set search_path = public as $$
declare v_pay payments;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found then raise exception 'PLATBA_NEEXISTUJE'; end if;
  if v_pay.status = 'paid' then return false; end if;   -- už připsáno
  update payments set status = 'paid', paid_at = now(),
         gateway_ref = coalesce(gateway_ref, p_gateway_ref)
   where id = p_payment_id;
  insert into credit_ledger (provider_id, kind, amount, payment_id, note)
  values (v_pay.provider_id, 'purchase', v_pay.credits, v_pay.id,
          'Nákup balíčku ' || v_pay.package_code);
  return true;
end $$;

-- Kontakty se ukážou až po výběru – a jen těm dvěma
create or replace function get_contacts(p_request_id uuid)
returns table (role text, name text, email text, phone text)
language plpgsql stable security definer set search_path = public as $$
declare v_req job_requests; v_provider uuid;
begin
  select * into v_req from job_requests where id = p_request_id;
  if not found or v_req.status <> 'assigned' then return; end if;
  select provider_id into v_provider from offers where id = v_req.selected_offer_id;
  if auth.uid() not in (v_req.customer_id, v_provider) then return; end if;

  return query
    select 'customer', p.full_name, p.email, p.phone from profiles p where p.id = v_req.customer_id
    union all
    select 'provider', coalesce(pp.company_name, p.full_name), p.email, p.phone
      from profiles p left join provider_profiles pp on pp.user_id = p.id
     where p.id = v_provider;
end $$;

-- Pouze serverové funkce nesmí volat běžní uživatelé
revoke execute on function confirm_payment(uuid, text) from public, anon, authenticated;
revoke execute on function expire_requests()           from public, anon, authenticated;
revoke execute on function _release_offer(offers, offer_status, text) from public, anon, authenticated;

-- =====================================================================
--  Řízení přístupu (Row Level Security)
--  Zápisy jdou výhradně přes funkce výše; tabulky jsou pro web jen ke čtení.
-- =====================================================================
alter table settings            enable row level security;
alter table job_size_prices     enable row level security;
alter table credit_packages     enable row level security;
alter table categories          enable row level security;
alter table regions             enable row level security;
alter table profiles            enable row level security;
alter table provider_profiles   enable row level security;
alter table provider_categories enable row level security;
alter table provider_regions    enable row level security;
alter table job_requests        enable row level security;
alter table request_photos      enable row level security;
alter table offers              enable row level security;
alter table payments            enable row level security;
alter table credit_ledger       enable row level security;

create policy "verejne" on settings            for select using (true);
create policy "verejne" on job_size_prices     for select using (true);
create policy "verejne" on credit_packages     for select using (active);
create policy "verejne" on categories          for select using (true);
create policy "verejne" on regions             for select using (true);
create policy "verejne" on provider_profiles   for select using (true);
create policy "verejne" on provider_categories for select using (true);
create policy "verejne" on provider_regions    for select using (true);

create policy "vlastni profil" on profiles for select using (id = auth.uid());

-- Poptávky: zákazník vidí své, řemeslník vidí otevřené ve svém oboru + ty, kde nabízel
create policy "zakaznik vidi sve" on job_requests for select
  using (customer_id = auth.uid());
create policy "remeslnik vidi otevrene v oboru" on job_requests for select
  using (status = 'open' and exists (
    select 1 from provider_categories pc
     where pc.provider_id = auth.uid() and pc.category_id = job_requests.category_id));
-- Pomocné funkce (security definer) zabrání nekonečné rekurzi mezi pravidly poptávek a nabídek
create or replace function my_request_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from job_requests where customer_id = auth.uid()
$$;
create or replace function my_offer_request_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select request_id from offers where provider_id = auth.uid()
$$;

create policy "remeslnik vidi kde nabizel" on job_requests for select
  using (id in (select my_offer_request_ids()));

create policy "fotky k viditelnym poptavkam" on request_photos for select
  using (exists (select 1 from job_requests r where r.id = request_photos.request_id));
create policy "zakaznik nahrava fotky" on request_photos for insert
  with check (exists (select 1 from job_requests r
                       where r.id = request_photos.request_id and r.customer_id = auth.uid()));

-- Nabídky: řemeslník vidí své, zákazník vidí nabídky na své poptávky
create policy "remeslnik vidi sve" on offers for select using (provider_id = auth.uid());
create policy "zakaznik vidi nabidky" on offers for select
  using (request_id in (select my_request_ids()));

create policy "vlastni platby"  on payments      for select using (provider_id = auth.uid());
create policy "vlastni pohyby"  on credit_ledger for select using (provider_id = auth.uid());
