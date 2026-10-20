-- Run after the worker secret has been saved in Supabase Vault.
-- In SQL Editor, create two Vault secrets using the Vault UI:
-- tryon_worker_secret = same value as the TRYON_WORKER_SECRET Edge secret
-- tryon_function_url = https://YOUR_PROJECT.supabase.co/functions/v1/tryon
-- No service-role key is included in this schedule.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('outfit-league-tryon-reconcile','* * * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='tryon_function_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='tryon_worker_secret')),
    body := '{"action":"reconcile"}'::jsonb,
    timeout_milliseconds := 100000
  );
$$);
