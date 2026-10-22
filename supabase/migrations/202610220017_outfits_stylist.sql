-- Full outfits: up to three clothing pieces (top, bottoms, outer layer) in one
-- try-on. The provider bills per piece, so the job reserves one credit per piece.
alter table public.try_on_jobs
  add column extra_garments uuid[] not null default '{}' check (cardinality(extra_garments) <= 2),
  add column garment_parts text[] not null default '{}' check (garment_parts <@ array['top','bottom','outer']),
  add column credits integer not null default 1 check (credits between 1 and 3),
  -- AI stylist "Rate my fit" result, cached so a second tap is free.
  add column rating jsonb;
alter table public.profiles add column color_profile jsonb;

alter table public.credit_transactions drop constraint credit_transactions_check;
alter table public.credit_transactions add constraint credit_transactions_check check (
  (kind='grant' and amount=3) or (kind='reserve' and amount between -3 and -1)
  or (kind='consume' and amount=0) or (kind='refund' and amount between 1 and 3)
);

drop function public.reserve_tryon(uuid,uuid,uuid,uuid,text);
create function public.reserve_tryon(p_owner uuid,p_key uuid,p_person uuid,p_garment uuid,p_consent text,p_extra uuid[] default '{}',p_parts text[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.try_on_jobs; w public.credit_wallets; n integer; c integer := 1 + cardinality(p_extra);
begin
  perform public.initialize_account(p_owner);
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  select * into j from public.try_on_jobs where owner_id=p_owner and idempotency_key=p_key;
  if found then
    if j.person_asset_id<>p_person or j.garment_asset_id<>p_garment or j.extra_garments<>p_extra then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('job',to_jsonb(j),'created',false);
  end if;
  if p_consent is distinct from 'tryon-v1' then raise exception 'CONSENT_REQUIRED'; end if;
  if c > 3 or (cardinality(p_parts) not in (0, c))
  or (select count(distinct x) from unnest(p_garment || p_extra) x) <> c
  or (select count(distinct x) from unnest(p_parts) x) <> cardinality(p_parts)
  then raise exception 'INVALID_REQUEST'; end if;
  if not exists(select 1 from public.private_assets where id=p_person and owner_id=p_owner and kind='person')
  or (select count(*) from public.private_assets where id=any(p_garment || p_extra) and owner_id=p_owner and kind='garment') <> c
  or exists(select 1 from public.try_on_jobs where owner_id=p_owner and (garment_asset_id=any(p_extra) or extra_garments && (p_garment || p_extra)))
  then raise exception 'INVALID_ASSETS'; end if;
  if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  if w.available<c then raise exception 'NO_CREDITS'; end if;
  insert into public.try_on_jobs(owner_id,idempotency_key,person_asset_id,garment_asset_id,consent_version,extra_garments,garment_parts,credits)
  values(p_owner,p_key,p_person,p_garment,p_consent,p_extra,p_parts,c) returning * into j;
  update public.credit_wallets set available=available-c,reserved=reserved+c,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,job_id,kind,amount) values(p_owner,j.id,'reserve',-c);
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end $$;

create or replace function public.finish_tryon(p_job uuid,p_result uuid default null,p_error text default null)
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
    update public.credit_wallets set reserved=reserved-j.credits,updated_at=now() where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'consume',0);
  else
    if p_error is null then raise exception 'ERROR_REQUIRED'; end if;
    update public.try_on_jobs set status='failed',error_code=p_error,updated_at=now() where id=p_job returning * into j;
    update public.credit_wallets set available=available+j.credits,reserved=reserved-j.credits,updated_at=now() where owner_id=j.owner_id;
    insert into public.credit_transactions(owner_id,job_id,kind,amount) values(j.owner_id,j.id,'refund',j.credits);
  end if;
  return j;
end $$;

revoke all on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[]) from public,anon,authenticated;
grant execute on function public.reserve_tryon(uuid,uuid,uuid,uuid,text,uuid[],text[]) to service_role;
