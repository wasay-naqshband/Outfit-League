import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  owner = randomUUID(),
  other = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to public;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
  for (const file of [
    "202610190001_tryon",
    "202610190003_library",
    "202610190004_explore",
    "202610190005_battles",
    "202610190006_catalog",
    "202610200007_account_control",
    "202610210011_spin_views",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}.sql`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
});
after(() => db.close());
async function asset(kind: string) {
  const id = randomUUID();
  await db.query(
    "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,$3,$4,1024,'image/jpeg')",
    [id, owner, kind, `${owner}/${id}.jpg`],
  );
  return id;
}
const wallet = async () =>
  (
    await db.query<{ available: number; reserved: number }>(
      "select available,reserved from credit_wallets where owner_id=$1",
      [owner],
    )
  ).rows[0];
async function completedJob() {
  const r = (
    await db.query<{ r: { job: { id: string } } }>(
      "select reserve_tryon($1,$2,$3,$4,'tryon-v1') r",
      [owner, randomUUID(), await asset("person"), await asset("garment")],
    )
  ).rows[0]!.r;
  await db.query("select finish_tryon($1,$2)", [
    r.job.id,
    await asset("result"),
  ]);
  return r.job.id;
}
const reserve = async (job: string, user = owner) =>
  (
    await db.query<{ r: { spin: { id: string }; created: boolean } }>(
      "select reserve_spin($1,$2) r",
      [user, job],
    )
  ).rows[0]!.r;

test("a spin reserves one credit once, and failure refunds it", async () => {
  const job = await completedJob();
  assert.deepEqual(await wallet(), { available: 2, reserved: 0 });
  const first = await reserve(job),
    again = await reserve(job);
  assert.equal(first.created, true);
  assert.equal(again.created, false);
  assert.equal(again.spin.id, first.spin.id);
  assert.deepEqual(await wallet(), { available: 1, reserved: 1 });
  await db.query("select finish_spin($1,null,'GENERATION_FAILED')", [
    first.spin.id,
  ]);
  await db.query("select finish_spin($1,null,'GENERATION_FAILED')", [
    first.spin.id,
  ]);
  assert.deepEqual(await wallet(), { available: 2, reserved: 0 });
  // A failed spin can be retried, and success keeps the credit.
  const retry = await reserve(job);
  assert.equal(retry.created, true);
  await db.query("select finish_spin($1,$2)", [
    retry.spin.id,
    await asset("spin"),
  ]);
  assert.deepEqual(await wallet(), { available: 1, reserved: 0 });
  assert.equal((await reserve(job)).created, false);
});

test("spins need the owner's completed try-on and a credit", async () => {
  const job = await completedJob();
  await assert.rejects(reserve(job, other), /UNAUTHORIZED|NOT_FOUND/);
  await db.query("update credit_wallets set available=0 where owner_id=$1", [
    owner,
  ]);
  await assert.rejects(reserve(job), /NO_CREDITS/);
  await assert.rejects(
    db.query("select finish_spin($1,$2)", [randomUUID(), randomUUID()]),
    /NOT_FOUND/,
  );
});

test("deleting a try-on removes its spin", async () => {
  await db.query("update credit_wallets set available=3 where owner_id=$1", [
    owner,
  ]);
  const job = await completedJob();
  await reserve(job);
  await db.query("delete from try_on_jobs where id=$1", [job]);
  const left = await db.query("select 1 from spin_views where job_id=$1", [
    job,
  ]);
  assert.equal(left.rows.length, 0);
});
