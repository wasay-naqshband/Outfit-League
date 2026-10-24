-- 360° views are a paid Pro feature: free trials include try-ons only.
alter table public.user_subscriptions add column in_trial boolean not null default false;

create or replace function public.apply_revenuecat_subscription_event(
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
        in_trial=(p_period_type='TRIAL'),next_allowance_at=case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end,updated_at=now()
        where owner_id=p_owner;
    else
      insert into public.user_subscriptions(owner_id,product_id,active,expires_at,next_allowance_at,in_trial)
        values(p_owner,p_product_id,p_expires_at>now(),p_expires_at,case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end,p_period_type='TRIAL');
    end if;
    update public.credit_wallets
      set available=available-subscription_tryons+50,subscription_tryons=50,
          subscription_spins=case when p_period_type='TRIAL' then 0 else 2 end,
          subscription_allowance_expires_at=least(case when p_period_type='TRIAL' then p_expires_at else now()+interval '1 month' end,p_expires_at),updated_at=now()
      where owner_id=p_owner;
    return;
  end if;

  if found then
    update public.user_subscriptions set product_id=p_product_id,active=(p_expires_at>now()),expires_at=p_expires_at,
      in_trial=(p_period_type='TRIAL'),updated_at=now()
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

create or replace function public.reserve_spin(p_owner uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.spin_views; w public.credit_wallets; n integer; use_subscription boolean;
begin
  perform public.refresh_subscription_allowance(p_owner);
  -- 360° views are for paying Pro members; free trials include try-ons only.
  if not exists(select 1 from public.user_subscriptions where owner_id=p_owner and active and expires_at>now() and not in_trial)
  then raise exception 'PRO_REQUIRED'; end if;
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

create or replace function public.read_my_wallet()
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
    'subscription_trial',coalesce(s.active and s.expires_at>now() and s.in_trial,false),
    'subscription_product',case when s.active and s.expires_at>now() then s.product_id else null end,
    'subscription_expires_at',case when s.active and s.expires_at>now() then s.expires_at else null end,
    'allowance_expires_at',w.subscription_allowance_expires_at
  );
end $$;
