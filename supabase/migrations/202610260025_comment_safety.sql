-- App Store guideline 1.2: comments can be reported and their authors blocked.
-- Two reports hide a comment for everyone until a moderator reviews it.
alter table public.battle_comments add column hidden boolean not null default false;
create table public.battle_comment_reports (
 comment_id bigint not null references public.battle_comments(id) on delete cascade,
 reporter_key text not null,
 created_at timestamptz not null default now(),
 primary key(comment_id,reporter_key)
);
-- A viewer (by their voter key) no longer sees anything the blocked author writes.
create table public.battle_blocks (
 blocker_key text not null,
 blocked_key text not null,
 created_at timestamptz not null default now(),
 primary key(blocker_key,blocked_key)
);
alter table public.battle_comment_reports enable row level security;
alter table public.battle_blocks enable row level security;
revoke all on public.battle_comment_reports,public.battle_blocks from public,anon,authenticated;
grant all on public.battle_comment_reports,public.battle_blocks to service_role;

create function public.report_battle_comment(p_comment bigint,p_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.battle_comments where id=p_comment) then raise exception 'NOT_FOUND'; end if;
 perform public.battle_rate('creport:'||p_key,20);
 insert into public.battle_comment_reports(comment_id,reporter_key) values(p_comment,p_key) on conflict do nothing;
 update public.battle_comments set hidden=true
 where id=p_comment and (select count(*) from public.battle_comment_reports where comment_id=p_comment)>=2;
end $$;

create function public.block_comment_author(p_comment bigint,p_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.battle_blocks(blocker_key,blocked_key)
 select p_key,author_key from public.battle_comments where id=p_comment and author_key<>p_key
 on conflict do nothing;
 if not found and not exists(select 1 from public.battle_comments where id=p_comment) then raise exception 'NOT_FOUND'; end if;
end $$;

revoke all on function public.report_battle_comment(bigint,text),public.block_comment_author(bigint,text) from public,anon,authenticated;
grant execute on function public.report_battle_comment(bigint,text),public.block_comment_author(bigint,text) to service_role;
