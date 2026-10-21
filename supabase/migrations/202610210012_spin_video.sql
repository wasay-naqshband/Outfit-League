-- 360° views become a short turntable video (MP4) instead of a four-angle image.
alter table public.private_assets drop constraint private_assets_check;
alter table public.private_assets drop constraint private_assets_content_type_check;
alter table public.private_assets add constraint private_assets_file_check check (
  (content_type = 'image/jpeg' and path = owner_id::text || '/' || id::text || '.jpg')
  or (kind = 'spin' and content_type = 'video/mp4' and path = owner_id::text || '/' || id::text || '.mp4')
);
update storage.buckets set allowed_mime_types = array['image/jpeg','video/mp4'] where id = 'tryon-private';
-- Beta-only: drop the earlier four-angle image spins (owner test data); their
-- storage files are removed separately. Spending stays in credit_transactions.
delete from public.spin_views;
delete from public.private_assets where kind = 'spin';
