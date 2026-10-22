-- Short comments on shared battles. Anyone with the link may comment under a name;
-- the battle owner can remove any comment, authors can remove their own.
create table public.battle_comments (
 id bigint generated always as identity primary key,
 battle_id uuid not null references public.battles(id) on delete cascade,
 author_key text not null,
 display_name text not null check(char_length(trim(display_name)) between 2 and 40),
 body text not null check(char_length(trim(body)) between 1 and 280),
 created_at timestamptz not null default now()
);
create index battle_comments_list on public.battle_comments(battle_id,id);
alter table public.battle_comments enable row level security;
revoke all on public.battle_comments from public,anon,authenticated;
grant all on public.battle_comments to service_role;
grant usage,select on sequence public.battle_comments_id_seq to service_role;

create function public.add_battle_comment(p_id uuid,p_key text,p_name text,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.battles where id=p_id and status='published') then raise exception 'VOTING_CLOSED'; end if;
 perform public.battle_rate('comment:'||p_key,15);
 insert into public.battle_comments(battle_id,author_key,display_name,body) values(p_id,p_key,trim(p_name),trim(p_body));
end $$;

create function public.delete_battle_comment(p_owner uuid,p_key text,p_comment bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.battle_comments c using public.battles b
 where c.id=p_comment and b.id=c.battle_id and (c.author_key=p_key or (p_owner is not null and b.owner_id=p_owner));
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;

revoke all on function public.add_battle_comment(uuid,text,text,text),public.delete_battle_comment(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.add_battle_comment(uuid,text,text,text),public.delete_battle_comment(uuid,text,bigint) to service_role;

-- Account deletion also removes the person's comments.
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
 delete from public.battle_comments where author_key=p_voter_key;
end $$;
