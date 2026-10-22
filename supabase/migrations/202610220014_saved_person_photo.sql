-- One reusable try-on photo per person at <owner>/person.jpg, owner-only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('saved-photos','saved-photos',false,8388608,array['image/jpeg']);

create policy saved_photo_select on storage.objects for select to authenticated
using(bucket_id='saved-photos' and name=auth.uid()::text||'/person.jpg' and public.account_active());
create policy saved_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='saved-photos' and name=auth.uid()::text||'/person.jpg' and public.account_active());
create policy saved_photo_update on storage.objects for update to authenticated
using(bucket_id='saved-photos' and name=auth.uid()::text||'/person.jpg' and public.account_active())
with check(bucket_id='saved-photos' and name=auth.uid()::text||'/person.jpg');
create policy saved_photo_delete on storage.objects for delete to authenticated
using(bucket_id='saved-photos' and name=auth.uid()::text||'/person.jpg');

create or replace function public.account_storage_paths(p_owner uuid,p_bucket text) returns table(name text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id=p_bucket and p_bucket in ('tryon-private','library-private','avatars','saved-photos') and o.name like p_owner::text||'/%' limit 500
$$;
