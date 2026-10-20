-- Feed access locations and permission notes are operator metadata, not public
-- product data. Public callers see only whether a retailer is approved.
create function public.catalog_retailer_approved(p_id text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.catalog_retailers where id=p_id and active and not is_demo and nullif(trim(feed_source),'') is not null and nullif(trim(permission_evidence),'') is not null)
$$;
revoke all on function public.catalog_retailer_approved(text) from public;
grant execute on function public.catalog_retailer_approved(text) to anon,authenticated,service_role;
revoke select on public.catalog_retailers from anon,authenticated;
grant select(id,name,domain,affiliate_hosts,affiliate_approved,is_demo,active,country,image_hosts) on public.catalog_retailers to anon,authenticated;
drop policy product_public on public.products;
create policy product_public on public.products for select to anon,authenticated using(
 published and exists(select 1 from public.catalog_retailers r where r.id=retailer_id and r.active)
 and (is_demo or public.catalog_retailer_approved(retailer_id))
 and (is_demo or (expires_at>now() and price_checked_at<=now() and availability<>'out_of_stock'))
);
