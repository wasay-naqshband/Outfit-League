-- Daily counterpart of battle_rate (same table, day buckets, its own error),
-- for per-day caps like free scans.
create function public.daily_rate(p_key text,p_max integer,p_error text) returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.battle_rate_limits(key,bucket_start,hits) values('day:'||p_key,date_trunc('day',now()),1)
 on conflict(key,bucket_start) do update set hits=public.battle_rate_limits.hits+1 returning hits into n;
 if n>p_max then raise exception '%', p_error; end if;
end $$;
revoke all on function public.daily_rate(text,integer,text) from public,anon,authenticated;
grant execute on function public.daily_rate(text,integer,text) to service_role;
