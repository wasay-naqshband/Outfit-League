create function public.delete_owned_battle(p_owner uuid, p_id uuid)
returns table(bucket text, path text)
language plpgsql security definer set search_path=''
as $$
declare b public.battles;
begin
  select * into b
  from public.battles
  where id=p_id and owner_id=p_owner
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  insert into public.account_cleanup(owner_id,bucket,path)
  select p_owner,'battle-images',x.path
  from unnest(array[b.a_path,b.b_path,b.c_path,b.d_path]) as x(path)
  where x.path is not null
  on conflict do nothing;

  delete from public.battles where id=p_id and owner_id=p_owner;
  return query
    select 'battle-images'::text, x.path
    from unnest(array[b.a_path,b.b_path,b.c_path,b.d_path]) as x(path)
    where x.path is not null;
end
$$;

revoke all on function public.delete_owned_battle(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.delete_owned_battle(uuid,uuid)
  to service_role;
