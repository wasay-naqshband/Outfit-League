alter table public.profiles add column display_name text not null default '' check(char_length(display_name)<=40);
alter table public.profiles add column deleting_at timestamptz;
create table public.account_deletions (
 owner_id uuid primary key, requested_at timestamptz not null default now(),
 voter_key text not null, attempts integer not null default 0
);
create table public.account_cleanup (
 owner_id uuid not null, bucket text not null, path text not null, primary key(bucket,path)
);
create table public.moderators (
 owner_id uuid primary key references auth.users(id) on delete cascade
);
create table public.moderation_actions (
 id bigint generated always as identity primary key,
 moderator_id uuid references auth.users(id) on delete set null,
 battle_id uuid not null, action text not null check(action='hide'),
 created_at timestamptz not null default now()
);
alter table public.account_deletions enable row level security;
alter table public.account_cleanup enable row level security;
alter table public.moderators enable row level security;
alter table public.moderation_actions enable row level security;
revoke all on public.account_deletions,public.account_cleanup,public.moderators,public.moderation_actions from public,anon,authenticated;
grant all on public.account_deletions,public.account_cleanup,public.moderators,public.moderation_actions to service_role;
grant usage,select on sequence public.moderation_actions_id_seq to service_role;

-- A restrictive policy also blocks existing access tokens during asynchronous cleanup.
create function public.account_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and deleting_at is null)
$$;
revoke all on function public.account_active() from public;
grant execute on function public.account_active() to authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','credit_wallets','private_assets','try_on_jobs','looks','credit_transactions','library_items','battles'] loop
 execute format('create policy active_account on public.%I as restrictive for all to authenticated using(public.account_active()) with check(public.account_active())',t);
 end loop;
end $$;
create policy active_account on storage.objects as restrictive for all to authenticated using(public.account_active()) with check(public.account_active());
create policy edit_own_profile on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant update(display_name) on public.profiles to authenticated;

create function public.request_account_deletion(p_owner uuid,p_voter_key text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if exists(select 1 from public.account_deletions where owner_id=p_owner) then return; end if;
 if not exists(select 1 from public.profiles where id=p_owner) then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.try_on_jobs where owner_id=p_owner and status in ('pending','submitting','queued','processing')) then raise exception 'ACTIVE_JOB'; end if;
 insert into public.account_deletions(owner_id,voter_key) values(p_owner,p_voter_key);
 update public.profiles set deleting_at=now(),display_name='' where id=p_owner;
 insert into public.account_cleanup(owner_id,bucket,path)
 select p_owner,'battle-images',b.id::text||v.suffix from public.battles b cross join lateral (values('/a.jpg'),('/b.jpg')) v(suffix) where b.owner_id=p_owner on conflict do nothing;
 update public.battles set status='unpublished' where owner_id=p_owner;
 delete from public.battle_votes where voter_key=p_voter_key;
end $$;
revoke all on function public.request_account_deletion(uuid,text) from public,anon,authenticated;
grant execute on function public.request_account_deletion(uuid,text) to service_role;

-- Guard server writes which began just before a deletion request. Same owner lock
-- as try-on reservation and battle creation serializes those transactions.
create function public.guard_active_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if exists(select 1 from public.account_deletions where owner_id=new.owner_id) then raise exception 'ACCOUNT_DELETING'; end if;
 return new;
end $$;
revoke all on function public.guard_active_owner() from public,anon,authenticated;
create trigger active_owner before insert or update on public.private_assets for each row execute function public.guard_active_owner();
create trigger active_owner before insert or update on public.try_on_jobs for each row execute function public.guard_active_owner();
create trigger active_owner before insert or update on public.library_items for each row execute function public.guard_active_owner();
create trigger active_owner before insert on public.battles for each row execute function public.guard_active_owner();
create trigger active_owner_publish before update on public.battles for each row when(new.status='published') execute function public.guard_active_owner();
create trigger active_owner_draft before update on public.battles for each row when(new.status='draft') execute function public.guard_active_owner();

create function public.account_storage_paths(p_owner uuid,p_bucket text) returns table(name text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id=p_bucket and p_bucket in ('tryon-private','library-private') and o.name like p_owner::text||'/%' limit 500
$$;
revoke all on function public.account_storage_paths(uuid,text) from public,anon,authenticated;
grant execute on function public.account_storage_paths(uuid,text) to service_role;

create function public.account_recent_signin(p_owner uuid,p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_owner and created_at>now()-interval '10 minutes')
$$;
revoke all on function public.account_recent_signin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_recent_signin(uuid,uuid) to service_role;

create function public.hide_reported_battle(p_moderator uuid,p_battle uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.moderators m join public.profiles p on p.id=m.owner_id where m.owner_id=p_moderator and p.deleting_at is null) then raise exception 'FORBIDDEN'; end if;
 update public.battles set status='hidden' where id=p_battle and status in ('published','closed');
 if found then insert into public.moderation_actions(moderator_id,battle_id,action) values(p_moderator,p_battle,'hide'); end if;
end $$;
revoke all on function public.hide_reported_battle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hide_reported_battle(uuid,uuid) to service_role;
