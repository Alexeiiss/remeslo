-- Úložiště fotek k poptávkám (Supabase Storage)
-- Cesta souboru: <id_poptávky>/<název_souboru>
insert into storage.buckets (id, name, public)
values ('request-photos', 'request-photos', false)
on conflict (id) do nothing;

-- Nahrávat smí jen zákazník do složky své poptávky
create policy "zakaznik nahrava fotky poptavky" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'request-photos'
    and ((storage.foldername(name))[1])::uuid in (select my_request_ids())
  );

-- Číst smí každý, kdo vidí danou poptávku (zákazník, řemeslníci v oboru)
create policy "fotky viditelnych poptavek" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-photos'
    and exists (select 1 from public.job_requests r
                 where r.id = ((storage.foldername(name))[1])::uuid)
  );
