-- AI Stylist "See it on me": a try-on described in words instead of a
-- clothing photo. It uses the same job, credit and result pipeline.
alter table public.try_on_jobs alter column garment_asset_id drop not null;
alter table public.try_on_jobs add column outfit text
  check (outfit is null or char_length(outfit) between 10 and 2000);
alter table public.try_on_jobs add constraint try_on_jobs_garment_or_outfit
  check ((garment_asset_id is null) <> (outfit is null));

drop function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[]);
create function public.reserve_tryon(
  p_owner uuid,p_key uuid,p_person uuid,p_garment uuid,p_consent text,
  p_extra uuid[] default '{}',p_parts text[] default '{}',p_outfit text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs; w public.credit_wallets; n integer; c integer := 1+cardinality(p_extra); sub_c integer;
begin
  perform public.initialize_account(p_owner);
  perform public.refresh_subscription_allowance(p_owner);
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into j from public.try_on_jobs where owner_id=p_owner and idempotency_key=p_key;
  if found then
    if j.person_asset_id<>p_person or j.garment_asset_id is distinct from p_garment
      or j.extra_garments<>p_extra or j.outfit is distinct from p_outfit
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('job',to_jsonb(j),'created',false);
  end if;
  if p_consent is distinct from 'tryon-v1' then raise exception 'CONSENT_REQUIRED'; end if;
  if p_outfit is not null then
    -- A described outfit: no clothing photos, one credit.
    if p_garment is not null or cardinality(p_extra)>0 or cardinality(p_parts)>0
      or char_length(p_outfit) not between 10 and 2000
    then raise exception 'INVALID_REQUEST'; end if;
    if not exists(select 1 from public.private_assets where id=p_person and owner_id=p_owner and kind='person')
    then raise exception 'INVALID_ASSETS'; end if;
  else
    if c>3 or cardinality(p_parts) not in (0,c)
      or (select count(distinct x) from unnest(p_garment||p_extra) x)<>c
      or (select count(distinct x) from unnest(p_parts) x)<>cardinality(p_parts)
    then raise exception 'INVALID_REQUEST'; end if;
    if not exists(select 1 from public.private_assets where id=p_person and owner_id=p_owner and kind='person')
      or (select count(*) from public.private_assets where id=any(p_garment||p_extra) and owner_id=p_owner and kind='garment')<>c
      or exists(select 1 from public.try_on_jobs where owner_id=p_owner and (garment_asset_id=any(p_extra) or extra_garments&&(p_garment||p_extra)))
    then raise exception 'INVALID_ASSETS'; end if;
  end if;
  if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  if w.available<c then raise exception 'NO_CREDITS'; end if;
  sub_c:=least(w.subscription_tryons,c);
  insert into public.try_on_jobs(owner_id,idempotency_key,person_asset_id,garment_asset_id,consent_version,extra_garments,garment_parts,credits,subscription_credits,subscription_credits_expires_at,outfit)
    values(p_owner,p_key,p_person,p_garment,p_consent,p_extra,p_parts,c,sub_c,case when sub_c>0 then w.subscription_allowance_expires_at else null end,p_outfit) returning * into j;
  update public.credit_wallets set available=available-c,subscription_tryons=subscription_tryons-sub_c,reserved=reserved+c,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,job_id,kind,amount) values(p_owner,j.id,'reserve',-c);
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end $$;
revoke all on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[],text) from public,anon,authenticated;
grant execute on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[],text) to service_role;
