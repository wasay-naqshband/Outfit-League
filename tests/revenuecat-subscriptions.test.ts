import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = randomUUID();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;
    create function public.guard_active_owner() returns trigger language plpgsql as $$begin return new; end$$;`);
  for (const file of [
    "202610190001_tryon.sql",
    "202610210011_spin_views.sql",
    "202610220017_outfits_stylist.sql",
    "202610230018_revenuecat_credits.sql",
    "202610230019_revenuecat_pack_15.sql",
    "202610230020_revenuecat_pro.sql",
    "202610240021_spin_pro_only.sql",
    "202610260027_pro_allowance.sql",
  ]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.query("insert into auth.users(id) values($1)", [owner]);
  await db.query("select initialize_account($1)", [owner]);
});
after(() => db.close());

async function asset(kind: "person" | "garment" | "result" | "spin") {
  const id = randomUUID();
  await db.query(
    "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,$3,$4,1024,'image/jpeg')",
    [id, owner, kind, `${owner}/${id}.jpg`],
  );
  return id;
}
const wallet = async () =>
  (
    await db.query<{
      available: number;
      reserved: number;
      subscription_tryons: number;
      subscription_spins: number;
    }>(
      "select available,reserved,subscription_tryons,subscription_spins from credit_wallets where owner_id=$1",
      [owner],
    )
  ).rows[0];
const subscriptionEvent = (
  id: string,
  type: string,
  expiresAt: string,
  period = "NORMAL",
  user = owner,
) =>
  db.query(
    "select apply_revenuecat_subscription_event($1,$2,$3,'outfit_pro_monthly',$4::timestamptz,$5)",
    [user, id, type, expiresAt, period],
  );

test("Pro grants monthly allowances separately and an included spin does not spend permanent credits", async () => {
  await subscriptionEvent(
    "trial-start",
    "INITIAL_PURCHASE",
    new Date(Date.now() + 3 * 86400000).toISOString(),
  );
  assert.deepEqual(await wallet(), {
    available: 43,
    reserved: 0,
    subscription_tryons: 40,
    subscription_spins: 5,
  });

  const person = await asset("person");
  const garment = await asset("garment");
  const result = await asset("result");
  const job = (
    await db.query<{ r: { job: { id: string } } }>(
      "select reserve_tryon($1,$2,$3,$4,'tryon-v1') r",
      [owner, randomUUID(), person, garment],
    )
  ).rows[0].r.job;
  assert.deepEqual(await wallet(), {
    available: 42,
    reserved: 1,
    subscription_tryons: 39,
    subscription_spins: 5,
  });
  await db.query("select finish_tryon($1,$2,null)", [job.id, result]);
  const spin = (
    await db.query<{ r: { spin: { id: string } } }>(
      "select reserve_spin($1,$2) r",
      [owner, job.id],
    )
  ).rows[0].r.spin;
  assert.equal(
    (
      await db.query<{ credit_source: string }>(
        "select credit_source from spin_views where id=$1",
        [spin.id],
      )
    ).rows[0].credit_source,
    "subscription",
  );
  assert.deepEqual(await wallet(), {
    available: 42,
    reserved: 1,
    subscription_tryons: 39,
    subscription_spins: 4,
  });
});

test("expiration removes only unused subscription credits and purchased pack credits stay permanent", async () => {
  await db.query(
    "select grant_revenuecat_tryons($1,'pack-15','outfit_tryons_15')",
    [owner],
  );
  await subscriptionEvent(
    "trial-expired",
    "EXPIRATION",
    new Date(Date.now() - 1000).toISOString(),
  );
  const current = await wallet();
  assert.equal(current.subscription_tryons, 0);
  assert.equal(current.subscription_spins, 0);
  assert.equal(current.available, 18); // Three free + fifteen purchased.
});

test("a free trial includes try-ons only; 360° views need paid Pro", async () => {
  const trial = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [trial]);
  await db.query("select initialize_account($1)", [trial]);
  const soon = new Date(Date.now() + 3 * 86400000).toISOString();
  await subscriptionEvent("t1", "INITIAL_PURCHASE", soon, "TRIAL", trial);
  const w = await db.query<{
    subscription_tryons: number;
    subscription_spins: number;
  }>(
    "select subscription_tryons,subscription_spins from credit_wallets where owner_id=$1",
    [trial],
  );
  assert.deepEqual(w.rows[0], {
    subscription_tryons: 40,
    subscription_spins: 0,
  });
  const add = async (kind: string) => {
    const id = randomUUID();
    await db.query(
      "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,$3,$4,1024,'image/jpeg')",
      [id, trial, kind, `${trial}/${id}.jpg`],
    );
    return id;
  };
  const job = (
    await db.query<{ r: { job: { id: string } } }>(
      "select reserve_tryon($1,$2,$3,$4,'tryon-v1') r",
      [trial, randomUUID(), await add("person"), await add("garment")],
    )
  ).rows[0]!.r.job;
  await db.query("select finish_tryon($1,$2,null)", [
    job.id,
    await add("result"),
  ]);
  await assert.rejects(
    db.query("select reserve_spin($1,$2)", [trial, job.id]),
    /PRO_REQUIRED/,
  );
  // The trial converts to a paid month: 360° views unlock.
  await subscriptionEvent(
    "t2",
    "RENEWAL",
    new Date(Date.now() + 30 * 86400000).toISOString(),
    "NORMAL",
    trial,
  );
  await db.query(
    "update user_subscriptions set next_allowance_at=now()-interval '1 second' where owner_id=$1",
    [trial],
  );
  await db.query("select refresh_subscription_allowance($1)", [trial]);
  const spin = await db.query<{ r: { created: boolean } }>(
    "select reserve_spin($1,$2) r",
    [trial, job.id],
  );
  assert.equal(spin.rows[0]!.r.created, true);
});
