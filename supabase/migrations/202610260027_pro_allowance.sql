-- Pro allowance: 40 try-ons and 5 360° views a month (was 50 and 2).
-- Same functions as before with only the two numbers changed; existing
-- subscribers move to the new allowance at their next monthly refresh.
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
      set available=available-subscription_tryons+40,
          subscription_tryons=40,subscription_spins=5,
          subscription_allowance_expires_at=s.next_allowance_at+interval '1 month',
          updated_at=now()
      where owner_id=p_owner;
    update public.user_subscriptions
      set next_allowance_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
  end if;
end $$;

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
      set available=available-subscription_tryons+40,subscription_tryons=40,
          subscription_spins=case when p_period_type='TRIAL' then 0 else 5 end,
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
      set available=available-subscription_tryons+40,subscription_tryons=40,subscription_spins=5,
          subscription_allowance_expires_at=least(now()+interval '1 month',p_expires_at),updated_at=now()
      where owner_id=p_owner;
    return;
  end if;

  if s.active and s.next_allowance_at<=now() then
    update public.credit_wallets
      set available=available-subscription_tryons+40,subscription_tryons=40,subscription_spins=5,
          subscription_allowance_expires_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
    update public.user_subscriptions set next_allowance_at=now()+interval '1 month',updated_at=now()
      where owner_id=p_owner;
  end if;
end $$;
