-- =====================================================================
--  Hodnocení řemeslníků (fáze 2a)
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
-- =====================================================================

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique references job_requests(id) on delete cascade,
  provider_id  uuid not null references provider_profiles(user_id) on delete cascade,
  customer_id  uuid not null references profiles(id) on delete cascade,
  rating       int  not null check (rating between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 2000),
  reply        text check (reply is null or char_length(reply) <= 2000),
  created_at   timestamptz not null default now(),
  replied_at   timestamptz
);
create index on reviews (provider_id, created_at desc);

alter table reviews enable row level security;
create policy "hodnoceni jsou verejna" on reviews for select using (true);

-- Přepočet průměru u řemeslníka
create or replace function _refresh_provider_rating(p_provider uuid)
returns void language sql security definer set search_path = public as $$
  update provider_profiles pp
     set rating_avg   = s.avg_rating,
         rating_count = s.cnt
    from (select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
            from reviews where provider_id = p_provider) s
   where pp.user_id = p_provider;
$$;

-- Zákazník ohodnotí řemeslníka, kterého si vybral (jen jednou za poptávku)
create or replace function submit_review(p_request_id uuid, p_rating int, p_comment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req job_requests;
  v_provider uuid;
  v_id uuid;
begin
  select * into v_req from job_requests where id = p_request_id;
  if not found or v_req.customer_id is distinct from auth.uid() then raise exception 'NENI_VASE_POPTAVKA'; end if;
  if v_req.status <> 'assigned' then raise exception 'NELZE_HODNOTIT'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'SPATNE_HODNOCENI'; end if;
  if exists (select 1 from reviews where request_id = p_request_id) then raise exception 'UZ_HODNOCENO'; end if;

  select provider_id into v_provider from offers where id = v_req.selected_offer_id;

  insert into reviews (request_id, provider_id, customer_id, rating, comment)
  values (p_request_id, v_provider, v_req.customer_id, p_rating, nullif(trim(p_comment), ''))
  returning id into v_id;

  perform _refresh_provider_rating(v_provider);
  return v_id;
end $$;

-- Řemeslník jednou odpoví na hodnocení
create or replace function reply_review(p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rev reviews;
begin
  select * into v_rev from reviews where id = p_review_id for update;
  if not found or v_rev.provider_id is distinct from auth.uid() then raise exception 'NENI_VASE_HODNOCENI'; end if;
  if v_rev.reply is not null then raise exception 'UZ_ODPOVEZENO'; end if;
  if coalesce(trim(p_reply), '') = '' then raise exception 'PRAZDNA_ODPOVED'; end if;
  update reviews set reply = trim(p_reply), replied_at = now() where id = p_review_id;
end $$;

revoke execute on function _refresh_provider_rating(uuid) from public, anon, authenticated;
