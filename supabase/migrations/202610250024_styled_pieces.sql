-- AI Stylist: the outfit's title and pieces, so the result can offer Shop the look.
alter table public.try_on_jobs add column styled jsonb;
