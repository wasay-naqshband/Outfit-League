-- Two battle modes:
--  choose: one person asks "which should I wear?" across 2-4 of their looks (A-D).
--  versus: one person's look (A) against a friend's (B); the friend joins by invite.
alter table public.battles add column kind text not null default 'choose' check(kind in ('choose','versus'));
alter table public.battles alter column source_b_kind drop not null, alter column source_b_id drop not null;
alter table public.battles
 add column source_c_kind text check(source_c_kind in ('library','job')), add column source_c_id uuid,
 add column source_d_kind text check(source_d_kind in ('library','job')), add column source_d_id uuid,
 add column c_path text check(c_path is null or c_path=id::text||'/c.jpg'),
 add column d_path text check(d_path is null or d_path=id::text||'/d.jpg'),
 add column c_label text not null default '', add column d_label text not null default '',
 add column b_owner_id uuid references auth.users(id) on delete set null,
 add constraint battles_versus_two check(kind='choose' or (source_c_id is null and source_d_id is null)),
 add constraint battles_choose_b check(kind='versus' or source_b_id is not null);
alter table public.battles drop constraint battles_status_check;
alter table public.battles add constraint battles_status_check check(status in ('draft','waiting','published','closed','unpublished','hidden'));
alter table public.battle_votes drop constraint battle_votes_choice_check;
alter table public.battle_votes add constraint battle_votes_choice_check check(choice in ('A','B','C','D'));
create index battle_friend on public.battles(b_owner_id,created_at desc) where b_owner_id is not null;
create policy battle_friend_read on public.battles for select to authenticated using(b_owner_id=auth.uid());

create function public.battle_source_ok(p_owner uuid,p_kind text,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind
  when 'library' then exists(select 1 from public.library_items where id=p_id and owner_id=p_owner and (photo_path is not null or explore_image is not null))
  when 'job' then exists(select 1 from public.try_on_jobs where id=p_id and owner_id=p_owner and status='completed')
  else false end
$$;

-- p_sources: [{"kind":"job","id":"..."}, ...] — 2-4 for choose, 1 for versus.
create function public.create_battle_n(p_owner uuid,p_id uuid,p_title text,p_mode text,p_kind text,p_sources jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.battles; n integer := jsonb_array_length(p_sources); s jsonb; k text[]; i uuid[];
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into prior from public.battles where id=p_id;
 if found then
   if prior.owner_id<>p_owner then raise exception 'NOT_FOUND'; end if;
   return prior.id;
 end if;
 if (select count(*) from public.battles where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMIT'; end if;
 if not (p_kind='choose' and n between 2 and 4 or p_kind='versus' and n=1) then raise exception 'INVALID_SOURCE'; end if;
 for s in select * from jsonb_array_elements(p_sources) loop
   if not public.battle_source_ok(p_owner,s->>'kind',(s->>'id')::uuid) then raise exception 'INVALID_SOURCE'; end if;
   k := k || (s->>'kind'); i := i || (s->>'id')::uuid;
 end loop;
 if (select count(distinct (x.sk,x.si)) from unnest(k,i) x(sk,si))<>n then raise exception 'INVALID_SOURCE'; end if;
 insert into public.battles(id,owner_id,title,voting_mode,kind,source_a_kind,source_a_id,source_b_kind,source_b_id,source_c_kind,source_c_id,source_d_kind,source_d_id)
 values(p_id,p_owner,trim(p_title),p_mode,p_kind,k[1],i[1],k[2],i[2],k[3],i[3],k[4],i[4]);
 return p_id;
end $$;

-- A friend accepts a versus invite with one of their own looks. Idempotent for that friend.
create function public.join_battle(p_friend uuid,p_id uuid,p_kind text,p_source uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.kind<>'versus' or b.status<>'waiting' then raise exception 'INVALID_STATE'; end if;
 if b.owner_id=p_friend then raise exception 'INVALID_STATE'; end if;
 if b.b_owner_id is not null and b.b_owner_id<>p_friend then raise exception 'INVALID_STATE'; end if;
 if not exists(select 1 from public.profiles where id=p_friend and deleting_at is null) then raise exception 'UNAUTHORIZED'; end if;
 if not public.battle_source_ok(p_friend,p_kind,p_source) then raise exception 'INVALID_SOURCE'; end if;
 perform public.battle_rate('join:'||p_friend::text,20);
 update public.battles set b_owner_id=p_friend,source_b_kind=p_kind,source_b_id=p_source where id=p_id;
end $$;

-- Publishing a versus battle opens the invite (waiting); the friend's join makes it live.
create or replace function public.manage_battle(p_owner uuid,p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 select * into b from public.battles where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_action='publish' and b.status='draft' and b.ready then
   update public.battles set status=case b.kind when 'versus' then 'waiting' else 'published' end,
     published_at=case b.kind when 'versus' then null else now() end where id=p_id;
 elsif p_action='close' and b.status='published' then
   update public.battles set status='closed' where id=p_id;
 elsif p_action='unpublish' and b.status in ('draft','waiting','published','closed') then
   update public.battles set status='unpublished' where id=p_id;
 else raise exception 'INVALID_STATE'; end if;
end $$;

create or replace function public.cast_battle_vote(p_id uuid,p_key text,p_choice text,p_name text,p_authenticated boolean)
returns text language plpgsql security definer set search_path='' as $$
declare b public.battles; result text;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.status<>'published' then raise exception 'VOTING_CLOSED'; end if;
 if (p_choice='C' and b.c_path is null) or (p_choice='D' and b.d_path is null) then raise exception 'INVALID_REQUEST'; end if;
 if b.voting_mode='public' and (not p_authenticated or char_length(trim(coalesce(p_name,''))) not between 2 and 40) then raise exception 'PUBLIC_IDENTITY_REQUIRED'; end if;
 perform public.battle_rate('voter:'||p_key,30);
 insert into public.battle_votes(battle_id,voter_key,choice,display_name)
 values(p_id,p_key,p_choice,case when b.voting_mode='public' then trim(p_name) else null end)
 on conflict(battle_id,voter_key) do nothing;
 select choice into result from public.battle_votes where battle_id=p_id and voter_key=p_key;
 return result;
end $$;

create or replace function public.battle_counts(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('A',count(*) filter(where choice='A'),'B',count(*) filter(where choice='B'),
  'C',count(*) filter(where choice='C'),'D',count(*) filter(where choice='D')) from public.battle_votes where battle_id=p_id
$$;

-- Deletion also clears C/D snapshots, and a friend's photo in someone else's versus battle.
create or replace function public.request_account_deletion(p_owner uuid,p_voter_key text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if exists(select 1 from public.account_deletions where owner_id=p_owner) then return; end if;
 if not exists(select 1 from public.profiles where id=p_owner) then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
 insert into public.account_deletions(owner_id,voter_key) values(p_owner,p_voter_key);
 update public.profiles set deleting_at=now(),display_name='' where id=p_owner;
 insert into public.account_cleanup(owner_id,bucket,path)
 select p_owner,'battle-images',x.path from public.battles b cross join lateral unnest(array[b.id::text||'/a.jpg',b.id::text||'/b.jpg',b.c_path,b.d_path]) x(path) where b.owner_id=p_owner and x.path is not null
 union select p_owner,'battle-images',b.id::text||'/b.jpg' from public.battles b where b.b_owner_id=p_owner
 on conflict do nothing;
 update public.battles set status='unpublished' where owner_id=p_owner or b_owner_id=p_owner;
 delete from public.battle_votes where voter_key=p_voter_key;
end $$;

revoke all on function public.battle_source_ok(uuid,text,uuid),public.create_battle_n(uuid,uuid,text,text,text,jsonb),public.join_battle(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.battle_source_ok(uuid,text,uuid),public.create_battle_n(uuid,uuid,text,text,text,jsonb),public.join_battle(uuid,uuid,text,uuid) to service_role;
