alter table public.credit_transactions
  add column revenuecat_transaction_id text unique,
  add column product_id text;

alter table public.credit_transactions
  drop constraint credit_transactions_kind_check,
  add constraint credit_transactions_kind_check
    check (kind in ('grant','reserve','consume','refund','purchase')),
  drop constraint credit_transactions_check,
  add constraint credit_transactions_check check (
    (kind='grant' and amount=3) or
    (kind='reserve' and amount=-1) or
    (kind='consume' and amount=0) or
    (kind='refund' and amount=1) or
    (kind='purchase' and amount=10 and product_id='outfit_tryons_10'
      and revenuecat_transaction_id is not null)
  );

create function public.grant_revenuecat_tryons(
  p_owner uuid,
  p_transaction_id text,
  p_product_id text
) returns table(available integer, reserved integer)
language plpgsql security definer set search_path='' as $$
declare
  v_inserted integer;
begin
  if p_owner is null or p_transaction_id is null or length(p_transaction_id) > 255
    or p_product_id is distinct from 'outfit_tryons_10' then
    raise exception 'INVALID_PURCHASE';
  end if;

  insert into public.credit_wallets(owner_id) values(p_owner) on conflict do nothing;
  insert into public.credit_transactions(
    owner_id, kind, amount, revenuecat_transaction_id, product_id
  ) values(p_owner, 'purchase', 10, p_transaction_id, p_product_id)
  on conflict (revenuecat_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.credit_wallets w
      set available=w.available + 10, updated_at=now()
      where w.owner_id=p_owner
      returning w.available, w.reserved into available, reserved;
    return next;
  else
    return query select w.available, w.reserved
      from public.credit_wallets w where w.owner_id=p_owner;
  end if;
end $$;

revoke all on function public.grant_revenuecat_tryons(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.grant_revenuecat_tryons(uuid,text,text)
  to service_role;
