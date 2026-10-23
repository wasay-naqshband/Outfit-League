-- Monthly subscription allowances are separate from permanent/free credits.
-- Unused allowances expire at the next month; purchased credits never expire.
alter table public.credit_wallets
  add column subscription_tryons integer not null default 0 check (subscription_tryons >= 0),
  add column subscription_spins integer not null default 0 check (subscription_spins >= 0),
  add column subscription_allowance_expires_at timestamptz;

create table public.user_subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('outfit_pro_monthly','outfit_pro_yearly')),
  active boolean not null default true,
  expires_at timestamptz not null,
  next_allowance_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.user_subscriptions enable row level security;
create policy own_subscription on public.user_subscriptions
  for select to authenticated using (owner_id=auth.uid());
revoke all on public.user_subscriptions from public, anon, authenticated;
grant select on public.user_subscriptions to authenticated;
grant all on public.user_subscriptions to service_role;

create table public.revenuecat_subscription_events (
  event_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now()
);
revoke all on public.revenuecat_subscription_events from public, anon, authenticated;
grant all on public.revenuecat_subscription_events to service_role;

alter table public.try_on_jobs
  add column subscription_credits integer not null default 0 check (subscription_credits between 0 and credits),
  add column subscription_credits_expires_at timestamptz;

alter table public.spin_views
  add column credit_source text not null default 'wallet' check (credit_source in ('wallet','subscription')),
  add column subscription_credits_expires_at timestamptz;

create or replace function public.refresh_subscription_allowance(p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.user_subscriptions; w public.credit_wallets;
begin
  insert into public.credit_wallets(owner_id) values(p_owner) on conflict do nothing;
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into s from public.user_subscriptions where owner_id=p_owner for update;
  if not found then return; end if;

  if not s.active or s.expires_at<=now() then
    update public.credit_wallets
      set available=greatest(0,available-subscription_tryons),
          subscription_tryons=0,subscription_spins=0,
          subscription_allowance_expires_at=null,updated_at=now()
      where owner_id=p_owner;
    update public.user_subscriptions set active=false,updated_at=now()
      where owner_id=p_owner and active;
    return;
  end if;

  if s.next_allowance_at<=now() then
    update public.credit_wallets
      set available=available-subscription_tryons+50,
          subscription_tryons=50,subscription_spins=2,
          subscription_allowance_expires_at=s.next_allowance_at+interval '1 month',
          updated_at=now()
      where owner_id=p_owner;
    update public.user_subscriptions
      set next_allowance_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
  end if;
end $$;

create function public.refresh_my_subscription_allowance()
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  perform public.refresh_subscription_allowance(auth.uid());
end $$;

create function public.read_my_wallet()
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.credit_wallets; s public.user_subscriptions;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  perform public.refresh_subscription_allowance(auth.uid());
  select * into w from public.credit_wallets where owner_id=auth.uid();
  select * into s from public.user_subscriptions where owner_id=auth.uid();
  return jsonb_build_object(
    'available',w.available,'reserved',w.reserved,
    'subscription_tryons',w.subscription_tryons,
    'subscription_spins',w.subscription_spins,
    'subscription_active',coalesce(s.active and s.expires_at>now(),false),
    'subscription_product',case when s.active and s.expires_at>now() then s.product_id else null end,
    'subscription_expires_at',case when s.active and s.expires_at>now() then s.expires_at else null end,
    'allowance_expires_at',w.subscription_allowance_expires_at
  );
end $$;

create function public.apply_revenuecat_subscription_event(
  p_owner uuid,p_event_id text,p_event_type text,p_product_id text,p_expires_at timestamptz,p_period_type text default 'NORMAL'
) returns void language plpgsql security definer set search_path='' as $$
declare w public.credit_wallets; s public.user_subscriptions; inserted integer;
begin
  if p_owner is null or p_event_id is null or length(p_event_id)>255
    or p_product_id not in ('outfit_pro_monthly','outfit_pro_yearly')
    or p_event_type not in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','CANCELLATION','EXPIRATION','BILLING_ISSUE')
    or p_expires_at is null then raise exception 'INVALID_SUBSCRIPTION_EVENT'; end if;
  insert into public.revenuecat_subscription_events(event_id,owner_id,event_type)
    values(p_event_id,p_owner,p_event_type) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return; end if;
  insert into public.credit_wallets(owner_id) values(p_owner) on conflict do nothing;
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into s from public.user_subscriptions where owner_id=p_owner for update;

  if p_event_type='EXPIRATION' then
    if found and s.product_id=p_product_id then
      update public.user_subscriptions set active=false,expires_at=least(expires_at,p_expires_at),updated_at=now()
        where owner_id=p_owner;
      update public.credit_wallets
        set available=greatest(0,available-subscription_tryons),subscription_tryons=0,
            subscription_spins=0,subscription_allowance_expires_at=null,updated_at=now()
        where owner_id=p_owner;
    end if;
    return;
  end if;

  if p_event_type='BILLING_ISSUE' then return; end if;
  if p_event_type in ('CANCELLATION') then
    update public.user_subscriptions set expires_at=p_expires_at,updated_at=now()
      where owner_id=p_owner and product_id=p_product_id;
    return;
  end if;

  if p_event_type='INITIAL_PURCHASE' then
    if found then
      update public.user_subscriptions set product_id=p_product_id,active=(p_expires_at>now()),expires_at=p_expires_at,
        next_allowance_at=case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end,updated_at=now()
        where owner_id=p_owner;
    else
      insert into public.user_subscriptions(owner_id,product_id,active,expires_at,next_allowance_at)
        values(p_owner,p_product_id,p_expires_at>now(),p_expires_at,case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end);
    end if;
    update public.credit_wallets
      set available=available-subscription_tryons+50,subscription_tryons=50,subscription_spins=2,
          subscription_allowance_expires_at=least(case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end,p_expires_at),updated_at=now()
      where owner_id=p_owner;
    return;
  end if;

  if found then
    update public.user_subscriptions set product_id=p_product_id,active=(p_expires_at>now()),expires_at=p_expires_at,updated_at=now()
      where owner_id=p_owner returning * into s;
  else
    insert into public.user_subscriptions(owner_id,product_id,active,expires_at,next_allowance_at)
      values(p_owner,p_product_id,p_expires_at>now(),p_expires_at,now()+interval '1 month') returning * into s;
    update public.credit_wallets
      set available=available-subscription_tryons+50,subscription_tryons=50,subscription_spins=2,
          subscription_allowance_expires_at=least(now()+interval '1 month',p_expires_at),updated_at=now()
      where owner_id=p_owner;
    return;
  end if;

  if s.active and s.next_allowance_at<=now() then
    update public.credit_wallets
      set available=available-subscription_tryons+50,subscription_tryons=50,subscription_spins=2,
          subscription_allowance_expires_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
    update public.user_subscriptions set next_allowance_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
  end if;
end $$;

create or replace function public.reserve_tryon(
  p_owner uuid,p_key uuid,p_person uuid,p_garment uuid,p_consent text,
  p_extra uuid[] default '{}',p_parts text[] default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs; w public.credit_wallets; n integer; c integer := 1+cardinality(p_extra); sub_c integer;
begin
  perform public.initialize_account(p_owner);
  perform public.refresh_subscription_allowance(p_owner);
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into j from public.try_on_jobs where owner_id=p_owner and idempotency_key=p_key;
  if found then
    if j.person_asset_id<>p_person or j.garment_asset_id<>p_garment or j.extra_garments<>p_extra then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('job',to_jsonb(j),'created',false);
  end if;
  if p_consent is distinct from 'tryon-v1' then raise exception 'CONSENT_REQUIRED'; end if;
  if c>3 or cardinality(p_parts) not in (0,c)
    or (select count(distinct x) from unnest(p_garment||p_extra) x)<>c
    or (select count(distinct x) from unnest(p_parts) x)<>cardinality(p_parts)
  then raise exception 'INVALID_REQUEST'; end if;
  if not exists(select 1 from public.private_assets where id=p_person and owner_id=p_owner and kind='person')
    or (select count(*) from public.private_assets where id=any(p_garment||p_extra) and owner_id=p_owner and kind='garment')<>c
    or exists(select 1 from public.try_on_jobs where owner_id=p_owner and (garment_asset_id=any(p_extra) or extra_garments&&(p_garment||p_extra)))
  then raise exception 'INVALID_ASSETS'; end if;
  if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  if w.available<c then raise exception 'NO_CREDITS'; end if;
  sub_c:=least(w.subscription_tryons,c);
  insert into public.try_on_jobs(owner_id,idempotency_key,person_asset_id,garment_asset_id,consent_version,extra_garments,garment_parts,credits,subscription_credits,subscription_credits_expires_at)
    values(p_owner,p_key,p_person,p_garment,p_consent,p_extra,p_parts,c,sub_c,case when sub_c>0 then w.subscription_allowance_expires_at else null end) returning * into j;
  update public.credit_wallets set available=available-c,subscription_tryons=subscription_tryons-sub_c,reserved=reserved+c,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,job_id,kind,amount) values(p_owner,j.id,'reserve',-c);
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end $$;

create or replace function public.finish_tryon(p_job uuid,p_result uuid default null,p_error text default null)
returns public.try_on_jobs language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs; w public.credit_wallets; restore_sub integer;
begin
  select * into j from public.try_on_jobs where id=p_job for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.status in ('completed','failed') then return j; end if;
  if p_result is not null then
    if p_error is not null or not exists(select 1 from public.private_assets where id=p_result and owner_id=j.owner_id and kind='result') then raise exception 'INVALID_RESULT'; end if;
    update public.try_on_jobs set status='completed',result_asset_id=p_result,updated_at=now() where id=p_job returning * into j;
    insert into public.looks(owner_id,job_id) values(j.owner_id,j.id);
    update public.credit_wallets set reserved=reserved-j.credits,updated_at=now() where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'consume',0);
  else
    if p_error is null then raise exception 'ERROR_REQUIRED'; end if;
    update public.try_on_jobs set status='failed',error_code=p_error,updated_at=now() where id=p_job returning * into j;
    select * into w from public.credit_wallets where owner_id=j.owner_id for update;
    restore_sub:=case when j.subscription_credits>0 and j.subscription_credits_expires_at>now()
      and w.subscription_allowance_expires_at=j.subscription_credits_expires_at then j.subscription_credits else 0 end;
    update public.credit_wallets
      set available=available+j.credits,reserved=reserved-j.credits,
          subscription_tryons=subscription_tryons+restore_sub,updated_at=now()
      where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'refund',j.credits);
  end if;
  return j;
end $$;

create or replace function public.reserve_spin(p_owner uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.spin_views; w public.credit_wallets; n integer; use_subscription boolean;
begin
  perform public.refresh_subscription_allowance(p_owner);
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  if not exists(select 1 from public.try_on_jobs where id=p_job and owner_id=p_owner and status='completed') then raise exception 'NOT_FOUND'; end if;
  select * into s from public.spin_views where job_id=p_job;
  if found and s.status<>'failed' then return jsonb_build_object('spin',to_jsonb(s),'created',false); end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  use_subscription:=w.subscription_spins>0 and w.subscription_allowance_expires_at>now();
  if not use_subscription and w.available-w.subscription_tryons<1 then raise exception 'NO_CREDITS'; end if;
  delete from public.spin_views where job_id=p_job;
  insert into public.spin_views(owner_id,job_id,credit_source,subscription_credits_expires_at)
    values(p_owner,p_job,case when use_subscription then 'subscription' else 'wallet' end,case when use_subscription then w.subscription_allowance_expires_at else null end) returning * into s;
  update public.credit_wallets
    set available=available-case when use_subscription then 0 else 1 end,
        subscription_spins=subscription_spins-case when use_subscription then 1 else 0 end,
        reserved=reserved+1,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,spin_id,kind,amount) values(p_owner,s.id,'reserve',-1);
  return jsonb_build_object('spin',to_jsonb(s),'created',true);
end $$;

create or replace function public.finish_spin(p_spin uuid,p_sheet uuid default null,p_error text default null)
returns public.spin_views language plpgsql security definer set search_path='' as $$
declare s public.spin_views; w public.credit_wallets; restore_subscription boolean;
begin
  select * into s from public.spin_views where id=p_spin for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.status<>'processing' then return s; end if;
  if p_sheet is not null then
    if not exists(select 1 from public.private_assets where id=p_sheet and owner_id=s.owner_id and kind='spin') then raise exception 'INVALID_RESULT'; end if;
    update public.spin_views set status='completed',sheet_asset_id=p_sheet,updated_at=now() where id=p_spin returning * into s;
    update public.credit_wallets set reserved=reserved-1,updated_at=now() where owner_id=s.owner_id;
    insert into public.credit_transactions(owner_id,spin_id,kind,amount) values(s.owner_id,s.id,'consume',0);
  else
    update public.spin_views set status='failed',error_code=coalesce(p_error,'GENERATION_FAILED'),updated_at=now() where id=p_spin returning * into s;
    select * into w from public.credit_wallets where owner_id=s.owner_id for update;
    restore_subscription:=s.credit_source='subscription' and s.subscription_credits_expires_at>now() and w.subscription_allowance_expires_at=s.subscription_credits_expires_at;
    update public.credit_wallets
      set available=available+case when s.credit_source='wallet' or not restore_subscription then 1 else 0 end,
          subscription_spins=subscription_spins+case when restore_subscription then 1 else 0 end,
          reserved=reserved-1,updated_at=now() where owner_id=s.owner_id;
    insert into public.credit_transactions(owner_id,spin_id,kind,amount) values(s.owner_id,s.id,'refund',1);
  end if;
  return s;
end $$;

revoke all on function public.refresh_subscription_allowance(uuid),public.apply_revenuecat_subscription_event(uuid,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.refresh_subscription_allowance(uuid),public.apply_revenuecat_subscription_event(uuid,text,text,text,timestamptz,text) to service_role;
revoke all on function public.refresh_my_subscription_allowance(),public.read_my_wallet() from public,anon,authenticated;
grant execute on function public.refresh_my_subscription_allowance(),public.read_my_wallet() to authenticated;
revoke all on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[]),public.finish_tryon(uuid,uuid,text),public.reserve_spin(uuid,uuid),public.finish_spin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[]),public.finish_tryon(uuid,uuid,text),public.reserve_spin(uuid,uuid),public.finish_spin(uuid,uuid,text) to service_role;
