-- A friend without an account can accept a versus invite with one photo.
-- Only the battles function (service role) calls this; clients get no new access.
alter table public.battles
 add column b_guest_name text check(b_guest_name is null or char_length(b_guest_name) between 1 and 40),
 add column b_guest_key text;

-- Reserves side B before the photo is uploaded, so two people can't both take it.
create function public.claim_guest_battle(p_id uuid,p_key text,p_name text) returns void language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.kind<>'versus' or b.status<>'waiting' or b.b_owner_id is not null or b.b_guest_key<>p_key then raise exception 'INVALID_STATE'; end if;
 perform public.battle_rate('guest-join:'||p_key,5);
 update public.battles set b_guest_key=p_key,b_guest_name=p_name where id=p_id;
end $$;

-- Same as before, plus: a side a guest has reserved is taken.
create or replace function public.join_battle(p_friend uuid,p_id uuid,p_kind text,p_source uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.kind<>'versus' or b.status<>'waiting' or b.b_guest_key is not null then raise exception 'INVALID_STATE'; end if;
 if b.owner_id=p_friend then raise exception 'INVALID_STATE'; end if;
 if b.b_owner_id is not null and b.b_owner_id<>p_friend then raise exception 'INVALID_STATE'; end if;
 if not exists(select 1 from public.profiles where id=p_friend and deleting_at is null) then raise exception 'UNAUTHORIZED'; end if;
 if not public.battle_source_ok(p_friend,p_kind,p_source) then raise exception 'INVALID_SOURCE'; end if;
 perform public.battle_rate('join:'||p_friend::text,20);
 update public.battles set b_owner_id=p_friend,source_b_kind=p_kind,source_b_id=p_source where id=p_id;
end $$;

revoke all on function public.claim_guest_battle(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_guest_battle(uuid,text,text) to service_role;
notify pgrst, 'reload schema';
