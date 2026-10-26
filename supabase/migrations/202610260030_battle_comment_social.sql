alter table public.battle_comments
  add column parent_id bigint references public.battle_comments(id) on delete cascade;
create index battle_comments_parent on public.battle_comments(battle_id,parent_id,id);

create table public.battle_comment_likes (
  comment_id bigint not null references public.battle_comments(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key(comment_id,voter_key)
);
alter table public.battle_comment_likes enable row level security;
revoke all on public.battle_comment_likes from public,anon,authenticated;
grant all on public.battle_comment_likes to service_role;

drop function public.add_battle_comment(uuid,text,text,text);
create function public.add_battle_comment(
  p_id uuid,p_key text,p_name text,p_body text,p_parent bigint default null
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.battles where id=p_id and status='published') then raise exception 'VOTING_CLOSED'; end if;
 if p_parent is not null and not exists(
   select 1 from public.battle_comments c
   where c.id=p_parent and c.battle_id=p_id and c.parent_id is null and not c.hidden
     and not exists(select 1 from public.battle_blocks x where x.blocker_key=p_key and x.blocked_key=c.author_key)
 ) then raise exception 'NOT_FOUND'; end if;
 perform public.battle_rate('comment:'||p_key,15);
 insert into public.battle_comments(battle_id,author_key,display_name,body,parent_id)
 values(p_id,p_key,trim(p_name),trim(p_body),p_parent);
end $$;

create function public.toggle_battle_comment_like(p_id uuid,p_comment bigint,p_key text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.battles where id=p_id and status in ('published','closed')) then raise exception 'NOT_FOUND'; end if;
 if not exists(select 1 from public.battle_comments where id=p_comment and battle_id=p_id and not hidden) then raise exception 'NOT_FOUND'; end if;
 perform public.battle_rate('comment-like:'||p_key,120);
 delete from public.battle_comment_likes where comment_id=p_comment and voter_key=p_key;
 if not found then insert into public.battle_comment_likes(comment_id,voter_key) values(p_comment,p_key); end if;
end $$;

drop function public.cast_battle_vote(uuid,text,text,text,boolean);
create function public.cast_battle_vote(p_id uuid,p_key text,p_choice text,p_name text,p_public_consent boolean)
returns text language plpgsql security definer set search_path='' as $$
declare b public.battles; result text;
begin
 select * into b from public.battles where id=p_id for update;
 if not found or b.status<>'published' then raise exception 'VOTING_CLOSED'; end if;
 if (p_choice='C' and b.c_path is null) or (p_choice='D' and b.d_path is null) then raise exception 'INVALID_REQUEST'; end if;
 if b.voting_mode='public' and (not p_public_consent or char_length(trim(coalesce(p_name,''))) not between 2 and 40) then raise exception 'PUBLIC_IDENTITY_REQUIRED'; end if;
 perform public.battle_rate('voter:'||p_key,30);
 insert into public.battle_votes(battle_id,voter_key,choice,display_name)
 values(p_id,p_key,p_choice,case when b.voting_mode='public' then trim(p_name) else null end)
 on conflict(battle_id,voter_key) do nothing;
 select choice into result from public.battle_votes where battle_id=p_id and voter_key=p_key;
 return result;
end $$;

revoke all on function public.add_battle_comment(uuid,text,text,text,bigint),public.toggle_battle_comment_like(uuid,bigint,text),public.cast_battle_vote(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.add_battle_comment(uuid,text,text,text,bigint),public.toggle_battle_comment_like(uuid,bigint,text),public.cast_battle_vote(uuid,text,text,text,boolean) to service_role;
