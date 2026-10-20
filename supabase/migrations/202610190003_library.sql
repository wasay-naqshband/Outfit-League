-- Milestone 3: private wardrobe and inspiration, separate from disposable try-on inputs.
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('wardrobe','inspiration')),
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null default 'Other' check (category in ('Tops','Shirts','Hoodies','Jackets','Bottoms','Dresses','Shoes','Accessories','Other')),
  color text not null default '' check (char_length(color) <= 50),
  brand text not null default '' check (char_length(brand) <= 100),
  notes text not null default '' check (char_length(notes) <= 2000),
  tags text not null default '' check (char_length(tags) <= 200),
  source_url text check (source_url is null or (char_length(source_url) <= 2048 and source_url ~ '^https?://[^ /]+')),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (photo_path is null or photo_path ~ ('^' || owner_id::text || '/' || id::text || '/[0-9a-f-]{36}\.jpg$'))
);
create index library_owner_kind on public.library_items(owner_id,kind,created_at desc);
alter table public.library_items enable row level security;
revoke all on public.library_items from public,anon,authenticated;
grant select,delete on public.library_items to authenticated;
grant insert(id,owner_id,kind,name,category,color,brand,notes,tags,source_url,photo_path) on public.library_items to authenticated;
grant update(name,category,color,brand,notes,tags,source_url,photo_path) on public.library_items to authenticated;
grant all on public.library_items to service_role;
create policy library_select on public.library_items for select to authenticated using(owner_id=auth.uid());
create policy library_insert on public.library_items for insert to authenticated with check(owner_id=auth.uid());
create policy library_update on public.library_items for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy library_delete on public.library_items for delete to authenticated using(owner_id=auth.uid());

-- Durable cleanup: deleting metadata makes photos inaccessible immediately;
-- the private worker removes bytes even if a client closes during deletion.
create table public.library_cleanup (
  path text primary key,
  created_at timestamptz not null default now()
);
alter table public.library_cleanup enable row level security;
revoke all on public.library_cleanup from public,anon,authenticated;
grant all on public.library_cleanup to service_role;
create function public.queue_library_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.photo_path is not null then insert into public.library_cleanup(path) values(old.photo_path) on conflict do nothing; end if;
    return old;
  end if;
  new.updated_at=now();
  if old.photo_path is not null and old.photo_path is distinct from new.photo_path then
    insert into public.library_cleanup(path) values(old.photo_path) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.queue_library_cleanup() from public,anon,authenticated;
create trigger library_cleanup_trigger before update or delete on public.library_items for each row execute function public.queue_library_cleanup();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('library-private','library-private',false,8388608,array['image/jpeg']) on conflict(id) do nothing;
create policy library_photo_read on storage.objects for select to authenticated using(
  bucket_id='library-private' and exists(select 1 from public.library_items i where i.owner_id=auth.uid() and i.photo_path=storage.objects.name)
);
create policy library_photo_insert on storage.objects for insert to authenticated with check(
  bucket_id='library-private' and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$')
  and exists(select 1 from public.library_items i where i.owner_id=auth.uid() and i.id::text=split_part(storage.objects.name,'/',2))
);
create policy library_photo_delete on storage.objects for delete to authenticated using(
  bucket_id='library-private' and split_part(name,'/',1)=auth.uid()::text
);

create function public.library_cleanup_paths() returns table(path text) language sql security definer set search_path='' as $$
  select q.path from public.library_cleanup q
    where not exists(select 1 from public.library_items i where i.photo_path=q.path)
  union
  select o.name from storage.objects o where o.bucket_id='library-private' and o.created_at < now()-interval '1 day'
    and not exists(select 1 from public.library_items i where i.photo_path=o.name)
  limit 50
$$;
revoke all on function public.library_cleanup_paths() from public,anon,authenticated;
grant execute on function public.library_cleanup_paths() to service_role;
