-- Push notifications: each signed-in iPhone's Expo push token, and what each
-- battle has already notified its owner about (so they aren't spammed).
create table public.push_tokens (
 token text primary key check(token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create index push_tokens_owner on public.push_tokens(owner_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public,anon,authenticated;
grant all on public.push_tokens to service_role;

alter table public.battles add column notified_votes integer not null default 0;
alter table public.battles add column comment_pushed_at timestamptz;

-- The vote milestone to announce now (1, 5, 10, 25, 50, 100, 250, 500), or
-- null. Claims it atomically, so each milestone is sent once.
create function public.battle_vote_milestone(p_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare total integer; m integer;
begin
 select count(*) into total from public.battle_votes where battle_id=p_id;
 select max(x) into m from unnest(array[1,5,10,25,50,100,250,500]) x where x<=total;
 if m is null then return null; end if;
 update public.battles set notified_votes=m where id=p_id and notified_votes<m;
 return case when found then m else null end;
end $$;
-- New comments notify the owner at most once every 3 hours per battle.
create function public.battle_comment_push(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.battles set comment_pushed_at=now()
 where id=p_id and (comment_pushed_at is null or comment_pushed_at<now()-interval '3 hours');
 return found;
end $$;
revoke all on function public.battle_vote_milestone(uuid),public.battle_comment_push(uuid) from public,anon,authenticated;
grant execute on function public.battle_vote_milestone(uuid),public.battle_comment_push(uuid) to service_role;
