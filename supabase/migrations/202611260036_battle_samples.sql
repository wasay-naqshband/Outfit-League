-- Creating a battle writes {side}_sample for every look, but only A and B had
-- the column, so any 3- or 4-look poll failed.
alter table public.battles
 add column if not exists c_sample text check(c_sample is null or c_sample in ('navy','cream','rust','green','ivory')),
 add column if not exists d_sample text check(d_sample is null or d_sample in ('navy','cream','rust','green','ivory'));
notify pgrst, 'reload schema';
