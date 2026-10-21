-- 360° views: one Gemini image holding four angles (front, left, back, right)
-- of a completed try-on. Costs one credit, reserved up front and refunded on failure.
alter table public.private_assets drop constraint private_assets_kind_check;
alter table public.private_assets add constraint private_assets_kind_check check (kind in ('person','garment','result','spin'));

create table public.spin_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null unique,
  sheet_asset_id uuid,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, owner_id),
  foreign key(job_id, owner_id) references public.try_on_jobs(id, owner_id) on delete cascade,
  foreign key(sheet_asset_id, owner_id) references public.private_assets(id, owner_id),
  check ((status = 'completed') = (sheet_asset_id is not null))
);
alter table public.spin_views enable row level security;
create policy own_spins on public.spin_views for select to authenticated using (owner_id=auth.uid());
revoke all on public.spin_views from anon,authenticated;
grant select on public.spin_views to authenticated;
grant all on public.spin_views to service_role;
create trigger active_owner before insert or update on public.spin_views for each row execute function public.guard_active_owner();

alter table public.credit_transactions add column spin_id uuid references public.spin_views(id) on delete set null;
create unique index one_spin_transition on public.credit_transactions(spin_id, kind) where spin_id is not null;

-- A failed spin can be retried: the old row is replaced.
create function public.reserve_spin(p_owner uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.spin_views; w public.credit_wallets; n integer;
begin
  select * into w from public.credit_wallets where owner_id=p_owner for update;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  if not exists(select 1 from public.try_on_jobs where id=p_job and owner_id=p_owner and status='completed') then raise exception 'NOT_FOUND'; end if;
  select * into s from public.spin_views where job_id=p_job;
  if found and s.status<>'failed' then return jsonb_build_object('spin',to_jsonb(s),'created',false); end if;
  select count(*) into n from public.credit_transactions where owner_id=p_owner and kind='reserve' and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'RATE_LIMIT'; end if;
  if w.available<1 then raise exception 'NO_CREDITS'; end if;
  delete from public.spin_views where job_id=p_job;
  insert into public.spin_views(owner_id,job_id) values(p_owner,p_job) returning * into s;
  update public.credit_wallets set available=available-1,reserved=reserved+1,updated_at=now() where owner_id=p_owner;
  insert into public.credit_transactions(owner_id,spin_id,kind,amount) values(p_owner,s.id,'reserve',-1);
  return jsonb_build_object('spin',to_jsonb(s),'created',true);
end $$;

create function public.finish_spin(p_spin uuid,p_sheet uuid default null,p_error text default null)
returns public.spin_views language plpgsql security definer set search_path='' as $$
declare s public.spin_views;
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
    update public.credit_wallets set available=available+1,reserved=reserved-1,updated_at=now() where owner_id=s.owner_id;
    insert into public.credit_transactions(owner_id,spin_id,kind,amount) values(s.owner_id,s.id,'refund',1);
  end if;
  return s;
end $$;
revoke all on function public.reserve_spin(uuid,uuid),public.finish_spin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_spin(uuid,uuid),public.finish_spin(uuid,uuid,text) to service_role;
