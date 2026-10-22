-- Profile photos: one private JPEG per person at <owner>/avatar.jpg.
-- ponytail: owner-only for now; widen the select policy when friends/battles show avatars.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,1048576,array['image/jpeg']);

create policy avatar_select on storage.objects for select to authenticated
using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg' and public.account_active());
create policy avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg' and public.account_active());
create policy avatar_update on storage.objects for update to authenticated
using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg' and public.account_active())
with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg');
create policy avatar_delete on storage.objects for delete to authenticated
using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg');

-- Account deletion removes avatars with the other owner-prefixed buckets.
create or replace function public.account_storage_paths(p_owner uuid,p_bucket text) returns table(name text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id=p_bucket and p_bucket in ('tryon-private','library-private','avatars') and o.name like p_owner::text||'/%' limit 500
$$;
