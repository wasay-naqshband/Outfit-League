-- Milestone 2: private try-ons and server-authoritative credits.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.credit_wallets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  available integer not null default 3 check (available >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);
create table public.private_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('person','garment','result')),
  path text not null unique,
  byte_size integer not null check (byte_size between 1 and 8388608),
  content_type text not null check (content_type = 'image/jpeg'),
  created_at timestamptz not null default now(),
  unique(id, owner_id),
  check (path = owner_id::text || '/' || id::text || '.jpg')
);
create table public.try_on_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  person_asset_id uuid not null unique,
  garment_asset_id uuid not null unique,
  result_asset_id uuid,
  status text not null default 'pending' check (status in ('pending','submitting','queued','processing','completed','failed')),
  provider text not null default 'fashn',
  provider_id text,
  error_code text,
  consent_version text not null check (consent_version = 'tryon-v1'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  unique(owner_id, idempotency_key),
  unique(id, owner_id),
  foreign key(person_asset_id, owner_id) references public.private_assets(id, owner_id),
  foreign key(garment_asset_id, owner_id) references public.private_assets(id, owner_id),
  foreign key(result_asset_id, owner_id) references public.private_assets(id, owner_id),
  check ((status = 'completed') = (result_asset_id is not null))
);
create table public.upload_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.private_assets(id) on delete set null,
  created_at timestamptz not null default now()
);
create index upload_requests_limit on public.upload_requests(owner_id,created_at);
alter table public.upload_requests enable row level security;
revoke all on public.upload_requests from public,anon,authenticated;
grant all on public.upload_requests to service_role;
create unique index one_active_tryon_per_user on public.try_on_jobs(owner_id)
where status in ('pending','submitting','queued','processing');
create index jobs_reconcile on public.try_on_jobs(status, expires_at);
create index assets_owner_created on public.private_assets(owner_id, created_at);
create table public.looks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null unique,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(job_id, owner_id) references public.try_on_jobs(id, owner_id) on delete cascade
);
create index looks_owner_created on public.looks(owner_id, created_at desc);
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.try_on_jobs(id) on delete set null,
  kind text not null check(kind in ('grant','reserve','consume','refund')),
  amount integer not null,
  created_at timestamptz not null default now(),
  check ((kind='grant' and amount=3) or (kind='reserve' and amount=-1) or (kind='consume' and amount=0) or (kind='refund' and amount=1))
);
create unique index one_welcome_grant on public.credit_transactions(owner_id) where kind='grant';
create unique index one_credit_transition on public.credit_transactions(job_id, kind) where job_id is not null;

alter table public.profiles enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.private_assets enable row level security;
alter table public.try_on_jobs enable row level security;
alter table public.looks enable row level security;
alter table public.credit_transactions enable row level security;
create policy own_profile on public.profiles for select to authenticated using (id=auth.uid());
create policy own_wallet on public.credit_wallets for select to authenticated using (owner_id=auth.uid());
create policy own_assets on public.private_assets for select to authenticated using (owner_id=auth.uid());
create policy own_jobs on public.try_on_jobs for select to authenticated using (owner_id=auth.uid());
create policy own_looks on public.looks for select to authenticated using (owner_id=auth.uid());
create policy save_own_look on public.looks for update to authenticated using (owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy own_credit_log on public.credit_transactions for select to authenticated using (owner_id=auth.uid());
revoke all on public.profiles,public.credit_wallets,public.private_assets,public.try_on_jobs,public.looks,public.credit_transactions from anon,authenticated;
grant select on public.profiles,public.credit_wallets,public.private_assets,public.try_on_jobs,public.looks,public.credit_transactions to authenticated;
grant update(saved) on public.looks to authenticated;
grant all on public.profiles,public.credit_wallets,public.private_assets,public.try_on_jobs,public.looks,public.credit_transactions to service_role;

create function public.initialize_account(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id) values(p_owner) on conflict do nothing;
  insert into public.credit_wallets(owner_id) values(p_owner) on conflict do nothing;
  insert into public.credit_transactions(owner_id,kind,amount) values(p_owner,'grant',3) on conflict do nothing;
end $$;
create function public.on_account_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform public.initialize_account(new.id); return new; end $$;
create trigger outfit_league_account_created after insert on auth.users
for each row execute function public.on_account_created();
do $$ declare u record; begin
  for u in select id from auth.users loop perform public.initialize_account(u.id); end loop;
end $$;

create function public.reserve_tryon(p_owner uuid,p_key uuid,p_person uuid,p_garment uuid,p_consent text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs; w public.credit_wallets; n integer;
begin
  perform public.initialize_account(p_owner);
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into j from public.try_on_jobs where owner_id=p_owner and idempotency_key=p_key;
  if found then
    if j.person_asset_id<>p_person or j.garment_asset_id<>p_garment then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('job',to_jsonb(j),'created',false);
  end if;
  if p_consent is distinct from 'tryon-v1' then raise exception 'CONSENT_REQUIRED'; end if;
  if not exists(select 1 from public.private_assets where id=p_person and owner_id=p_owner and kind='person')
  or not exists(select 1 from public.private_assets where id=p_garment and owner_id=p_owner and kind='garment')
  then raise exception 'INVALID_ASSETS'; end if;
  if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  if w.available<1 then raise exception 'NO_CREDITS'; end if;
  insert into public.try_on_jobs(owner_id,idempotency_key,person_asset_id,garment_asset_id,consent_version)
  values(p_owner,p_key,p_person,p_garment,p_consent) returning * into j;
  update public.credit_wallets set available=available-1,reserved=reserved+1,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,job_id,kind,amount) values(p_owner,j.id,'reserve',-1);
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end $$;
create function public.register_tryon_upload(p_owner uuid,p_id uuid,p_kind text,p_size integer)
returns public.private_assets language plpgsql security definer set search_path='' as $$
declare a public.private_assets; n integer;
begin
  if p_kind not in ('person','garment') or p_size not between 1 and 8388608 then raise exception 'INVALID_REQUEST'; end if;
  perform public.initialize_account(p_owner);
  perform 1 from public.credit_wallets where owner_id=p_owner for update;
  select count(*) into n from public.upload_requests where owner_id=p_owner and created_at>now()-interval '1 hour';
  if n>=24 then raise exception 'RATE_LIMIT'; end if;
  insert into public.private_assets(id,owner_id,kind,path,byte_size,content_type)
  values(p_id,p_owner,p_kind,p_owner::text||'/'||p_id::text||'.jpg',p_size,'image/jpeg') returning * into a;
  insert into public.upload_requests(owner_id,asset_id) values(p_owner,p_id);
  return a;
end $$;
create function public.claim_tryon(p_job uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.try_on_jobs set status='submitting',updated_at=now() where id=p_job and status='pending' and expires_at>now();
  return found;
end $$;
create function public.attach_prediction(p_job uuid,p_prediction text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.try_on_jobs set provider_id=p_prediction,status='queued',updated_at=now() where id=p_job and status='submitting';
end $$;
create function public.finish_tryon(p_job uuid,p_result uuid default null,p_error text default null)
returns public.try_on_jobs language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs;
begin
  select * into j from public.try_on_jobs where id=p_job for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.status in ('completed','failed') then return j; end if;
  if p_result is not null then
    if p_error is not null or not exists(select 1 from public.private_assets where id=p_result and owner_id=j.owner_id and kind='result') then raise exception 'INVALID_RESULT'; end if;
    update public.try_on_jobs set status='completed',result_asset_id=p_result,updated_at=now() where id=p_job returning * into j;
    insert into public.looks(owner_id,job_id) values(j.owner_id,j.id);
    update public.credit_wallets set reserved=reserved-1,updated_at=now() where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'consume',0);
  else
    if p_error is null then raise exception 'ERROR_REQUIRED'; end if;
    update public.try_on_jobs set status='failed',error_code=p_error,updated_at=now() where id=p_job returning * into j;
    update public.credit_wallets set available=available+1,reserved=reserved-1,updated_at=now() where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'refund',1);
  end if;
  return j;
end $$;
revoke all on function public.initialize_account(uuid),public.on_account_created(),public.reserve_tryon(uuid,uuid,uuid,uuid,text),public.claim_tryon(uuid),public.attach_prediction(uuid,text),public.finish_tryon(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.initialize_account(uuid),public.reserve_tryon(uuid,uuid,uuid,uuid,text),public.claim_tryon(uuid),public.attach_prediction(uuid,text),public.finish_tryon(uuid,uuid,text) to service_role;
revoke all on function public.register_tryon_upload(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.register_tryon_upload(uuid,uuid,text,integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tryon-private','tryon-private',false,8388608,array['image/jpeg']);
-- Uploads are issued by authenticated server endpoints using signed upload tokens.
-- No client object insert/update policy: an issued input cannot be replaced mid-job.
create policy read_own_tryon_files on storage.objects for select to authenticated
using(bucket_id='tryon-private' and exists(
  select 1 from public.private_assets a where a.path=name and a.owner_id=auth.uid()
));
