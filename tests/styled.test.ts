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
    "202610240022_lookalikes.sql",
    "202610250023_styled_outfits.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1)", [owner]);
  await db.query("select initialize_account($1)", [owner]);
});
after(() => db.close());

const person = async () => {
  const id = randomUUID();
  await db.query(
    "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,'person',$3,1024,'image/jpeg')",
    [id, owner, `${owner}/${id}.jpg`],
  );
  return id;
};
const available = async () =>
  (
    await db.query<{ available: number }>(
      "select available from credit_wallets where owner_id=$1",
      [owner],
    )
  ).rows[0]!.available;
const OUTFIT = "Jacket: black matte cropped puffer. Top: charcoal hoodie.";

test("a styled outfit is a one-credit try-on with no clothing photo, refunded on failure", async () => {
  const before = await available();
  const r = (
    await db.query<{
      r: { job: { id: string; outfit: string; credits: number } };
    }>("select reserve_tryon($1,$2,$3,null,'tryon-v1','{}','{}',$4) r", [
      owner,
      randomUUID(),
      await person(),
      OUTFIT,
    ])
  ).rows[0]!.r.job;
  assert.equal(r.outfit, OUTFIT);
  assert.equal(r.credits, 1);
  assert.equal(await available(), before - 1);
  await db.query("select finish_tryon($1,null,'GENERATION_FAILED')", [r.id]);
  assert.equal(await available(), before);
});

test("an outfit can't also carry clothing photos, and a job needs one or the other", async () => {
  const p = await person();
  const garment = randomUUID();
  await db.query(
    "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,'garment',$3,1024,'image/jpeg')",
    [garment, owner, `${owner}/${garment}.jpg`],
  );
  await assert.rejects(
    db.query("select reserve_tryon($1,$2,$3,$4,'tryon-v1','{}','{}',$5)", [
      owner,
      randomUUID(),
      p,
      garment,
      OUTFIT,
    ]),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    db.query("select reserve_tryon($1,$2,$3,null,'tryon-v1')", [
      owner,
      randomUUID(),
      p,
    ]),
    /INVALID_REQUEST/,
  );
});
