-- Curated public sample catalog; publishing is server-only.
create table public.explore_outfits (
  id text primary key check(id ~ '^[a-z0-9-]{1,64}$'),
  name text not null check(char_length(name) between 1 and 100),
  style text not null check(style in ('Streetwear','Minimal','Y2K')),
  category text not null check(category in ('Tops','Shirts','Hoodies','Jackets','Bottoms','Dresses','Shoes','Accessories','Other')),
  description text not null,
  brand text not null default '',
  tags text not null default '',
  image text not null check(image in ('navy','cream','rust','green','ivory')),
  garment text check(garment in ('navy','cream','rust','green','ivory')),
  palette text not null check(palette in ('lavender','coral','sun','mint','pink')),
  source_label text not null,
  source_url text check(source_url is null or source_url ~ '^https?://[^ /]+'),
  published boolean not null default false,
  rank integer not null unique
);
alter table public.explore_outfits enable row level security;
revoke all on public.explore_outfits from public,anon,authenticated;
grant select on public.explore_outfits to anon,authenticated;
grant all on public.explore_outfits to service_role;
create policy explore_read on public.explore_outfits for select to anon,authenticated using(published);

alter table public.library_items
  add column explore_id text,
  add column explore_image text check(explore_image in ('navy','cream','rust','green','ivory')),
  add column explore_garment text check(explore_garment in ('navy','cream','rust','green','ivory'));
create unique index library_explore_once on public.library_items(owner_id,explore_id) where explore_id is not null;
-- Snapshot columns are deliberately absent from client INSERT/UPDATE grants.
create function public.save_explore(outfit_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; outfit public.explore_outfits;
begin
  if auth.uid() is null then raise exception 'Sign in to save'; end if;
  select * into outfit from public.explore_outfits where id=outfit_id and published;
  if not found then raise exception 'Outfit unavailable'; end if;
  insert into public.library_items(owner_id,kind,name,category,brand,tags,notes,source_url,explore_id,explore_image,explore_garment)
    values(auth.uid(),'inspiration',outfit.name,outfit.category,outfit.brand,outfit.tags,
      outfit.description || E'\nSource: ' || outfit.source_label,outfit.source_url,outfit.id,outfit.image,outfit.garment)
    on conflict(owner_id,explore_id) where explore_id is not null do nothing returning id into result;
  if result is null then select id into result from public.library_items where owner_id=auth.uid() and explore_id=outfit_id; end if;
  return result;
end $$;
revoke all on function public.save_explore(text) from public,anon;
grant execute on function public.save_explore(text) to authenticated;

create function public.explore_page(search_text text default '', style_filter text default '', after_rank integer default -1, page_size integer default 12)
returns setof public.explore_outfits language sql stable security invoker set search_path='' as $$
 select * from public.explore_outfits
 where published and rank > after_rank
   and (style_filter='' or style=style_filter)
   and (trim(search_text)='' or strpos(lower(name || ' ' || brand || ' ' || tags || ' ' || category),lower(left(trim(search_text),100)))>0)
 order by rank limit greatest(1,least(page_size,40))
$$;
revoke all on function public.explore_page(text,text,integer,integer) from public;
grant execute on function public.explore_page(text,text,integer,integer) to anon,authenticated;

insert into public.explore_outfits(id,name,style,category,description,tags,image,garment,palette,source_label,published,rank) values
 ('navy','Navy bomber','Streetwear','Jackets','Sample styling illustration with a separate flat bomber illustration for testing. Use a real garment photo for realistic try-ons.','navy bomber casual layered','navy','navy','lavender','Outfit League supplied sample artwork · original garment illustration',true,0),
 ('cream','Cream layers','Minimal','Tops','Sample neutral layers. The separate cream top illustration demonstrates the garment handoff; it is not a retail product.','cream neutral simple layers','cream','cream','coral','Outfit League supplied sample artwork · original garment illustration',true,1),
 ('rust','Rust jacket','Streetwear','Jackets','Sample warm-toned jacket styling, paired with an original flat garment illustration. No retailer or price is attached.','rust orange jacket weekend','rust','rust','sun','Outfit League supplied sample artwork · original garment illustration',true,2),
 ('green','Green varsity','Y2K','Jackets','Sample varsity styling with an original green jacket illustration for testing. Illustrated inputs may produce less realistic results.','green varsity college retro','green','green','mint','Outfit League supplied sample artwork · original garment illustration',true,3),
 ('ivory','Everyday layers','Minimal','Tops','Sample everyday ivory styling with an original flat top illustration. This is inspiration, not a shopping offer.','ivory everyday neutral basic','ivory','ivory','pink','Outfit League supplied sample artwork · original garment illustration',true,4);
