alter table public.catalog_retailers add column country text not null default 'US' check(country='US');
alter table public.catalog_retailers add column feed_source text;
alter table public.catalog_retailers add column permission_evidence text;
alter table public.catalog_retailers add column image_hosts text[] not null default '{}';
alter table public.products add column image_url text;
alter table public.products add column expires_at timestamptz;
alter table public.products add constraint live_offer_freshness check(is_demo or (image_url is not null and image_url ~ '^https://[^ /]+' and expires_at is not null and expires_at>price_checked_at and expires_at<=price_checked_at+interval '24 hours'));
-- Existing unapproved live rows, if any, stay unavailable until imported with evidence.
drop policy product_public on public.products;
create policy product_public on public.products for select to anon,authenticated using(
 published and exists(select 1 from public.catalog_retailers r where r.id=retailer_id and r.active and (products.is_demo or (r.feed_source is not null and r.permission_evidence is not null)))
 and (is_demo or (expires_at>now() and price_checked_at<=now() and availability<>'out_of_stock'))
);
drop function public.catalog_page(text,text,text,integer,text,integer,text,integer);
create function public.catalog_page(p_category text default '',p_search text default '',p_exact_explore text default null,p_max_minor integer default null,p_currency text default 'USD',p_after_price integer default -1,p_after_id text default '',p_limit integer default 20,p_live boolean default false)
returns setof public.products language sql stable security invoker set search_path='' as $$
 select p.* from public.products p
 where p.is_demo=not p_live and (p_category='' or p.category=p_category)
 and p.currency=p_currency
 and (trim(p_search)='' or strpos(lower(p.name||' '||p.brand||' '||p.color||' '||p.tags),lower(left(trim(p_search),100)))>0)
 and (p_max_minor is null or p.price_minor<p_max_minor)
 and (p_exact_explore is null or exists(select 1 from public.product_matches m where m.explore_id=p_exact_explore and m.product_id=p.id and m.relation='exact' and m.verified_at is not null and not p.is_demo))
 and (p.price_minor>p_after_price or (p.price_minor=p_after_price and p.id>p_after_id))
 order by p.price_minor,p.id limit greatest(1,least(p_limit,40))
$$;
revoke all on function public.catalog_page(text,text,text,integer,text,integer,text,integer,boolean) from public;
grant execute on function public.catalog_page(text,text,text,integer,text,integer,text,integer,boolean) to anon,authenticated;

-- Import a complete retailer snapshot atomically. Approval is an operator action,
-- never taken from a feed or public request. Removed offers are unpublished.
create function public.import_catalog(p_retailer text,p_products jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r public.catalog_retailers; x jsonb; n integer:=0; ids text[]:='{}'; product_id text; checked_at timestamptz; expiry timestamptz;
begin
 select * into r from public.catalog_retailers where id=p_retailer and active and not is_demo for update;
 if not found or r.country<>'US' or nullif(trim(r.feed_source),'') is null or nullif(trim(r.permission_evidence),'') is null or cardinality(r.image_hosts)=0 then raise exception 'RETAILER_APPROVAL_REQUIRED'; end if;
 if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>1000 then raise exception 'INVALID_FEED'; end if;
 for x in select value from jsonb_array_elements(p_products) loop
  product_id=p_retailer||':'||(x->>'external_id'); checked_at=(x->>'price_checked_at')::timestamptz; expiry=(x->>'expires_at')::timestamptz;
  if nullif(x->>'external_id','') is null or char_length(product_id)>200 or product_id=any(ids) or (x->>'currency') is distinct from 'USD' or (x->>'product_url') is null or (x->>'image_url') is null or checked_at is null or checked_at>now() or checked_at<now()-interval '24 hours' or expiry is null or expiry<=now() or expiry>checked_at+interval '24 hours'
   or split_part(split_part(x->>'product_url','/',3),'?',1)<>r.domain or (x->>'product_url')!~'^https://[^ /]+/'
   or not(split_part(split_part(x->>'image_url','/',3),'?',1)=any(r.image_hosts)) or (x->>'image_url')!~'^https://[^ /]+/' then raise exception 'INVALID_FEED'; end if;
  if exists(select 1 from public.products where id=product_id and retailer_id<>p_retailer) then raise exception 'PRODUCT_COLLISION'; end if;
  insert into public.products(id,retailer_id,name,category,color,brand,tags,palette,price_minor,currency,product_url,image_url,is_demo,published,availability,price_checked_at,expires_at)
  values(product_id,p_retailer,x->>'name',x->>'category',coalesce(x->>'color',''),coalesce(x->>'brand',''),coalesce(x->>'tags',''),'lavender',(x->>'price_minor')::integer,'USD',x->>'product_url',x->>'image_url',false,true,coalesce(x->>'availability','unknown'),checked_at,expiry)
  on conflict(id) do update set name=excluded.name,category=excluded.category,color=excluded.color,brand=excluded.brand,tags=excluded.tags,price_minor=excluded.price_minor,product_url=excluded.product_url,image_url=excluded.image_url,availability=excluded.availability,price_checked_at=excluded.price_checked_at,expires_at=excluded.expires_at,published=true;
  ids=array_append(ids,product_id);n=n+1;
 end loop;
 update public.products set published=false where retailer_id=p_retailer and not(id=any(ids));
 return n;
end $$;
revoke all on function public.import_catalog(text,jsonb) from public,anon,authenticated;
grant execute on function public.import_catalog(text,jsonb) to service_role;
