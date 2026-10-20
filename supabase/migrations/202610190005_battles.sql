create table public.battles (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 100),
 voting_mode text not null check(voting_mode in ('anonymous','public')),
 status text not null default 'draft' check(status in ('draft','published','closed','unpublished','hidden')),
 source_a_kind text not null check(source_a_kind in ('library','job')), source_a_id uuid not null,
 source_b_kind text not null check(source_b_kind in ('library','job')), source_b_id uuid not null,
 a_path text, b_path text, a_sample text, b_sample text,
 a_label text not null default '', b_label text not null default '',
 ready boolean not null default false, created_at timestamptz not null default now(),
 published_at timestamptz,
 check(source_a_kind<>source_b_kind or source_a_id<>source_b_id),
 check(a_sample is null or a_sample in ('navy','cream','rust','green','ivory')),
 check(b_sample is null or b_sample in ('navy','cream','rust','green','ivory')),
 check(a_path is null or a_path=id::text || '/a.jpg'),
 check(b_path is null or b_path=id::text || '/b.jpg')
);
create index battle_owner_created on public.battles(owner_id,created_at desc);
create table public.battle_votes (
 id bigint generated always as identity primary key,
 battle_id uuid not null references public.battles(id) on delete cascade,
 voter_key text not null, choice text not null check(choice in ('A','B')),
 display_name text check(display_name is null or char_length(trim(display_name)) between 2 and 40),
 created_at timestamptz not null default now(), unique(battle_id,voter_key)
);
create index battle_votes_counts on public.battle_votes(battle_id,choice);
create table public.battle_reports (
 battle_id uuid not null references public.battles(id) on delete cascade,
 reporter_key text not null, reason text not null check(reason in ('Inappropriate image','Harassment','Privacy concern','Other')),
 created_at timestamptz not null default now(), primary key(battle_id,reporter_key)
);
create table public.battle_rate_limits(key text not null,bucket_start timestamptz not null,hits integer not null,primary key(key,bucket_start));
alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;
alter table public.battle_reports enable row level security;
alter table public.battle_rate_limits enable row level security;
revoke all on public.battles,public.battle_votes,public.battle_reports,public.battle_rate_limits from public,anon,authenticated;
grant all on public.battles,public.battle_votes,public.battle_reports,public.battle_rate_limits to service_role;
grant usage,select on sequence public.battle_votes_id_seq to service_role;
grant select on public.battles to authenticated;
create policy battle_owner_read on public.battles for select to authenticated using(owner_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('battle-images','battle-images',false,8388608,array['image/jpeg']) on conflict(id) do nothing;
-- No client storage policies: the server copies only selected owned assets.

create function public.battle_rate(p_key text,p_max integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.battle_rate_limits(key,bucket_start,hits) values(p_key,date_trunc('hour',now()),1)
 on conflict(key,bucket_start) do update set hits=public.battle_rate_limits.hits+1 returning hits into n;
 if n>p_max then raise exception 'RATE_LIMIT'; end if;
 delete from public.battle_rate_limits where bucket_start<now()-interval '2 days';
end $$;

create function public.create_battle(p_owner uuid,p_id uuid,p_title text,p_mode text,p_a_kind text,p_a uuid,p_b_kind text,p_b uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.battles; k text; asset uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into prior from public.battles where id=p_id;
 if found then
   if prior.owner_id<>p_owner then raise exception 'NOT_FOUND'; end if;
   return prior.id;
 end if;
 if (select count(*) from public.battles where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMIT'; end if;
 for k,asset in select p_a_kind,p_a union all select p_b_kind,p_b loop
   if k='library' then
     if not exists(select 1 from public.library_items where id=asset and owner_id=p_owner and (photo_path is not null or explore_image is not null)) then raise exception 'INVALID_SOURCE'; end if;
   elsif k='job' then
     if not exists(select 1 from public.try_on_jobs where id=asset and owner_id=p_owner and status='completed') then raise exception 'INVALID_SOURCE'; end if;
   else raise exception 'INVALID_SOURCE'; end if;
 end loop;
 insert into public.battles(id,owner_id,title,voting_mode,source_a_kind,source_a_id,source_b_kind,source_b_id)
 values(p_id,p_owner,trim(p_title),p_mode,p_a_kind,p_a,p_b_kind,p_b);
 return p_id;
end $$;

create function public.manage_battle(p_owner uuid,p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 select * into b from public.battles where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_action='publish' and b.status='draft' and b.ready then
   update public.battles set status='published',published_at=now() where id=p_id;
 elsif p_action='close' and b.status='published' then
   update public.battles set status='closed' where id=p_id;
 elsif p_action='unpublish' and b.status in ('draft','published','closed') then
   update public.battles set status='unpublished' where id=p_id;
 else raise exception 'INVALID_STATE'; end if;
end $$;

create function public.cast_battle_vote(p_id uuid,p_key text,p_choice text,p_name text,p_authenticated boolean)
returns text language plpgsql security definer set search_path='' as $$
declare b public.battles; result text;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.status<>'published' then raise exception 'VOTING_CLOSED'; end if;
 if b.voting_mode='public' and (not p_authenticated or char_length(trim(coalesce(p_name,''))) not between 2 and 40) then raise exception 'PUBLIC_IDENTITY_REQUIRED'; end if;
 perform public.battle_rate('voter:'||p_key,30);
 insert into public.battle_votes(battle_id,voter_key,choice,display_name)
 values(p_id,p_key,p_choice,case when b.voting_mode='public' then trim(p_name) else null end)
 on conflict(battle_id,voter_key) do nothing;
 select choice into result from public.battle_votes where battle_id=p_id and voter_key=p_key;
 return result;
end $$;

create function public.battle_counts(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('A',count(*) filter(where choice='A'),'B',count(*) filter(where choice='B')) from public.battle_votes where battle_id=p_id
$$;

create function public.report_battle(p_id uuid,p_key text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.battles where id=p_id and status in ('published','closed')) then raise exception 'NOT_FOUND'; end if;
 perform public.battle_rate('reporter:'||p_key,10);
 insert into public.battle_reports(battle_id,reporter_key,reason) values(p_id,p_key,p_reason) on conflict do nothing;
 -- Reports enter the server-only review queue; authors cannot clear them or unhide a battle.
end $$;

revoke all on function public.battle_rate(text,integer),public.create_battle(uuid,uuid,text,text,text,uuid,text,uuid),public.manage_battle(uuid,uuid,text),public.cast_battle_vote(uuid,text,text,text,boolean),public.battle_counts(uuid),public.report_battle(uuid,text,text) from public,anon,authenticated;
grant execute on function public.battle_rate(text,integer),public.create_battle(uuid,uuid,text,text,text,uuid,text,uuid),public.manage_battle(uuid,uuid,text),public.cast_battle_vote(uuid,text,text,text,boolean),public.battle_counts(uuid),public.report_battle(uuid,text,text) to service_role;

