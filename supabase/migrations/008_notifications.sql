-- =====================================================================
--  Upozornění na webu (zvoneček): nové nabídky, zprávy, výběr, hodnocení…
--  Vznikají automaticky triggery v databázi – nic se nemůže „zapomenout“.
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–007.)
-- =====================================================================

create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null,      -- new_offer, new_message, selected, closed, review, new_request, dispute
  request_id  uuid references job_requests(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index on notifications (user_id, read_at, created_at desc);
create index on notifications (user_id, request_id) where read_at is null;

alter table notifications enable row level security;
create policy "vlastni upozorneni" on notifications for select using (user_id = auth.uid());

create or replace function _notify(p_user uuid, p_kind text, p_request uuid, p_text text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, request_id, text) values (p_user, p_kind, p_request, p_text);
$$;

-- Nová nabídka → zákazník
create or replace function trg_offer_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req job_requests; v_name text;
begin
  select * into v_req from job_requests where id = new.request_id;
  select company_name into v_name from provider_profiles where user_id = new.provider_id;
  perform _notify(v_req.customer_id, 'new_offer', new.request_id,
    'Nová nabídka od ' || coalesce(v_name, 'řemeslníka') || ' na „' || v_req.title || '“');
  return new;
end $$;
create trigger offers_notify_insert after insert on offers for each row execute function trg_offer_insert();

-- Změna stavu nabídky → řemeslník
create or replace function trg_offer_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.status is distinct from old.status and old.status = 'pending' then
    select title into v_title from job_requests where id = new.request_id;
    if new.status = 'selected' then
      perform _notify(new.provider_id, 'selected', new.request_id, 'Zákazník si vás vybral: „' || v_title || '“. Kontakt máte u poptávky.');
    elsif new.status = 'rejected' then
      perform _notify(new.provider_id, 'closed', new.request_id, 'Poptávka „' || v_title || '“ je uzavřená, kredity vám byly vráceny.');
    end if;
  end if;
  return new;
end $$;
create trigger offers_notify_update after update on offers for each row execute function trg_offer_update();

-- Nová zpráva → druhá strana
create or replace function trg_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req job_requests; v_to uuid;
begin
  select * into v_req from job_requests where id = new.request_id;
  v_to := case when new.sender_id = v_req.customer_id then new.provider_id else v_req.customer_id end;
  perform _notify(v_to, 'new_message', new.request_id, 'Nová zpráva k poptávce „' || v_req.title || '“');
  return new;
end $$;
create trigger messages_notify after insert on messages for each row execute function trg_message_insert();

-- Nové hodnocení → řemeslník
create or replace function trg_review_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from job_requests where id = new.request_id;
  perform _notify(new.provider_id, 'review', new.request_id,
    'Nové hodnocení ' || repeat('★', new.rating) || ' za „' || v_title || '“');
  return new;
end $$;
create trigger reviews_notify after insert on reviews for each row execute function trg_review_insert();

-- Vyřízená reklamace → řemeslník
create or replace function trg_dispute_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req uuid;
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    select request_id into v_req from offers where id = new.offer_id;
    perform _notify(new.provider_id, 'dispute', v_req,
      case when new.status = 'approved' then 'Reklamace uznána, kredity vráceny.' else 'Reklamace byla zamítnuta.' end);
  end if;
  return new;
end $$;
create trigger disputes_notify after update on disputes for each row execute function trg_dispute_update();

-- Nová poptávka → řemeslníci se stejným oborem a krajem
create or replace function trg_request_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, request_id, text)
  select pc.provider_id, 'new_request', new.id, 'Nová poptávka ve vašem oboru: „' || new.title || '“ (' || new.city || ')'
    from provider_categories pc
    join provider_regions pr on pr.provider_id = pc.provider_id and pr.region_id = new.region_id
   where pc.category_id = new.category_id and pc.provider_id <> new.customer_id;
  return new;
end $$;
create trigger requests_notify after insert on job_requests for each row execute function trg_request_insert();

-- Přečtení: všechna upozornění k jedné poptávce / úplně všechna
create or replace function mark_request_seen(p_request_id uuid)
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now()
   where user_id = auth.uid() and request_id = p_request_id and read_at is null;
$$;
create or replace function mark_all_seen()
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

revoke execute on function _notify(uuid, text, uuid, text) from public, anon, authenticated;
