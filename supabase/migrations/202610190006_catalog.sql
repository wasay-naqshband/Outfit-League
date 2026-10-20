create table public.catalog_retailers (
 id text primary key, name text not null, domain text,
 affiliate_hosts text[] not null default '{}', affiliate_approved boolean not null default false,
 is_demo boolean not null default true, active boolean not null default true,
 check(domain is null or domain ~ '^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$'),
 check(is_demo or domain is not null)
);
create table public.products (
 id text primary key, retailer_id text not null references public.catalog_retailers(id),
 name text not null check(char_length(name) between 1 and 100),
 category text not null check(category in ('Tops','Shirts','Hoodies','Jackets','Bottoms','Dresses','Shoes','Accessories','Other')),
 color text not null default '',brand text not null default '',tags text not null default '',
 image_key text check(image_key in ('navy','cream','rust','green','ivory')),
 palette text not null default 'lavender' check(palette in ('lavender','coral','sun','mint','pink')),
 price_minor integer not null check(price_minor between 0 and 100000000),currency text not null check(currency ~ '^[A-Z]{3}$'),
 product_url text check(product_url is null or product_url ~ '^https://[^ /]+'),
 affiliate_url text check(affiliate_url is null or affiliate_url ~ '^https://[^ /]+'),
 affiliate_approved boolean not null default false,
 is_demo boolean not null default true,published boolean not null default false,
 availability text not null default 'unknown' check(availability in ('unknown','in_stock','out_of_stock')),
 price_checked_at timestamptz, created_at timestamptz not null default now(),
 check(is_demo or (product_url is not null and price_checked_at is not null))
);
create index catalog_category_price on public.products(category,currency,price_minor,id) where published;
create table public.product_matches (
 explore_id text not null references public.explore_outfits(id) on delete cascade,
 product_id text not null references public.products(id) on delete cascade,
 relation text not null check(relation in ('similar','exact')),
 verification_type text check(verification_type in ('retailer_sku','catalog_identifier','manual_review')),
 evidence_url text check(evidence_url is null or evidence_url ~ '^https://[^ /]+'),
 verified_at timestamptz,
 primary key(explore_id,product_id),
 check(relation<>'exact' or (verification_type is not null and evidence_url is not null and verified_at is not null))
);
create table public.affiliate_clicks (
 request_id uuid primary key,product_id text not null references public.products(id),
 retailer_id text not null references public.catalog_retailers(id),
 used_affiliate boolean not null,created_at timestamptz not null default now()
);
alter table public.catalog_retailers enable row level security;
alter table public.products enable row level security;
alter table public.product_matches enable row level security;
alter table public.affiliate_clicks enable row level security;
revoke all on public.catalog_retailers,public.products,public.product_matches,public.affiliate_clicks from public,anon,authenticated;
grant select on public.catalog_retailers,public.products,public.product_matches to anon,authenticated;
grant all on public.catalog_retailers,public.products,public.product_matches,public.affiliate_clicks to service_role;
create policy retailer_public on public.catalog_retailers for select to anon,authenticated using(active);
create policy product_public on public.products for select to anon,authenticated using(published and exists(select 1 from public.catalog_retailers r where r.id=retailer_id and r.active));
create policy match_public on public.product_matches for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.published) and exists(select 1 from public.explore_outfits e where e.id=explore_id and e.published));

create function public.catalog_page(p_category text default '',p_search text default '',p_exact_explore text default null,p_max_minor integer default null,p_currency text default 'USD',p_after_price integer default -1,p_after_id text default '',p_limit integer default 20)
returns setof public.products language sql stable security invoker set search_path='' as $$
 select p.* from public.products p
 where (p_category='' or p.category=p_category)
 and p.currency=p_currency
 and (trim(p_search)='' or strpos(lower(p.name||' '||p.brand||' '||p.color||' '||p.tags),lower(left(trim(p_search),100)))>0)
 and (p_max_minor is null or p.price_minor<p_max_minor)
 and (p_exact_explore is null or exists(select 1 from public.product_matches m where m.explore_id=p_exact_explore and m.product_id=p.id and m.relation='exact' and m.verified_at is not null and not p.is_demo))
 and (p.price_minor>p_after_price or (p.price_minor=p_after_price and p.id>p_after_id))
 order by p.price_minor,p.id limit greatest(1,least(p_limit,40))
$$;
revoke all on function public.catalog_page(text,text,text,integer,text,integer,text,integer) from public;
grant execute on function public.catalog_page(text,text,text,integer,text,integer,text,integer) to anon,authenticated;

insert into public.catalog_retailers(id,name) values('sample-catalog','Outfit League sample catalog');
insert into public.products(id,retailer_id,name,category,color,tags,image_key,palette,price_minor,currency,published) values
 ('navy-bomber','sample-catalog','Navy bomber illustration','Jackets','Navy','bomber streetwear layered','navy','lavender',6400,'USD',true),
 ('navy-budget','sample-catalog','Simple navy jacket illustration','Jackets','Navy','budget bomber streetwear','navy','lavender',3800,'USD',true),
 ('rust-jacket','sample-catalog','Rust jacket illustration','Jackets','Rust','orange casual warm','rust','sun',5800,'USD',true),
 ('rust-budget','sample-catalog','Light rust jacket illustration','Jackets','Rust','orange budget casual','rust','sun',3400,'USD',true),
 ('green-varsity','sample-catalog','Green varsity illustration','Jackets','Green','varsity y2k college','green','mint',7200,'USD',true),
 ('green-budget','sample-catalog','Simple green jacket illustration','Jackets','Green','varsity budget retro','green','mint',4200,'USD',true),
 ('cream-top','sample-catalog','Cream top illustration','Tops','Cream','minimal neutral layered','cream','coral',4800,'USD',true),
 ('cream-budget','sample-catalog','Basic cream top illustration','Tops','Cream','budget neutral minimal','cream','coral',2400,'USD',true),
 ('ivory-top','sample-catalog','Ivory top illustration','Tops','Ivory','minimal everyday neutral','ivory','pink',4400,'USD',true),
 ('ivory-budget','sample-catalog','Basic ivory top illustration','Tops','Ivory','budget everyday neutral','ivory','pink',2000,'USD',true);
-- Similarity metadata is not evidence of exact retail identity.
insert into public.product_matches(explore_id,product_id,relation) values
 ('navy','navy-bomber','similar'),('navy','navy-budget','similar'),
 ('rust','rust-jacket','similar'),('rust','rust-budget','similar'),
 ('green','green-varsity','similar'),('green','green-budget','similar'),
 ('cream','cream-top','similar'),('cream','cream-budget','similar'),
 ('ivory','ivory-top','similar'),('ivory','ivory-budget','similar');
