-- =====================================================================
--  Přílohy k poptávce: kromě fotek i soubory (PDF, Excel, Word, výkresy…)
--  Spustit v Supabase: SQL Editor → New query → vložit → Run
--  (Předtím musí být spuštěné 001–006.)
-- =====================================================================

alter table request_photos add column if not exists file_name    text;
alter table request_photos add column if not exists content_type text;
alter table request_photos add column if not exists size_bytes   int;

-- Limit velikosti souboru v úložišti (10 MB)
update storage.buckets set file_size_limit = 10485760 where id = 'request-photos';

-- Kdy byli řemeslníci upozorněni na novou poptávku (ochrana proti opakovanému rozesílání)
alter table job_requests add column if not exists notified_at timestamptz;
