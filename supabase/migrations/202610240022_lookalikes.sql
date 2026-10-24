-- Cheaper lookalikes found for a try-on, cached so repeat views are free.
alter table public.try_on_jobs add column lookalikes jsonb;
