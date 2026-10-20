import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const owner = randomUUID(),
  other = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
  await db.exec(
    await readFile("supabase/migrations/202610190001_tryon.sql", "utf8"),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
});
after(() => db.close());
async function asset(kind: string, user = owner) {
  const id = randomUUID();
  await db.query(
    "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,$3,$4,1024,'image/jpeg')",
    [id, user, kind, `${user}/${id}.jpg`],
  );
  return id;
}
async function wallet() {
  return (
    await db.query<{ available: number; reserved: number }>(
      "select available,reserved from credit_wallets where owner_id=$1",
      [owner],
    )
  ).rows[0];
}
async function userQuery(user: string, sql: string, args: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return tx.query(sql, args);
  });
}
test("welcome grant, reservation and successful completion remain idempotent", async () => {
  await db.query("select initialize_account($1)", [owner]);
  await db.query("select initialize_account($1)", [owner]);
  assert.deepEqual(await wallet(), { available: 3, reserved: 0 });
  const person = await asset("person"),
    garment = await asset("garment"),
    key = randomUUID();
  const start = async () =>
    (
      await db.query<{ result: { job: { id: string }; created: boolean } }>(
        "select reserve_tryon($1,$2,$3,$4,'tryon-v1') result",
        [owner, key, person, garment],
      )
    ).rows[0]!.result;
  const first = await start(),
    repeated = await start();
  assert.equal(first.job.id, repeated.job.id);
  assert.equal(repeated.created, false);
  assert.deepEqual(await wallet(), { available: 2, reserved: 1 });
  assert.equal(
    (
      await db.query<{ claimed: boolean }>("select claim_tryon($1) claimed", [
        first.job.id,
      ])
    ).rows[0]!.claimed,
    true,
  );
  assert.equal(
    (
      await db.query<{ claimed: boolean }>("select claim_tryon($1) claimed", [
        first.job.id,
      ])
    ).rows[0]!.claimed,
    false,
  );
  const result = await asset("result");
  await db.query("select finish_tryon($1,$2,null)", [first.job.id, result]);
  await db.query("select finish_tryon($1,null,'TIMEOUT')", [first.job.id]);
  assert.deepEqual(await wallet(), { available: 2, reserved: 0 });
  const log = (
    await db.query<{ kind: string; amount: number }>(
      "select kind,amount from credit_transactions where job_id=$1 order by kind",
      [first.job.id],
    )
  ).rows;
  assert.deepEqual(log, [
    { kind: "consume", amount: 0 },
    { kind: "reserve", amount: -1 },
  ]);
});
test("failed generation refunds once and cannot later consume the returned credit", async () => {
  const person = await asset("person"),
    garment = await asset("garment");
  const job = (
    await db.query<{ result: { job: { id: string } } }>(
      "select reserve_tryon($1,$2,$3,$4,'tryon-v1') result",
      [owner, randomUUID(), person, garment],
    )
  ).rows[0]!.result.job.id;
  await db.query("select finish_tryon($1,null,'PROVIDER_FAILED')", [job]);
  await db.query("select finish_tryon($1,null,'TIMEOUT')", [job]);
  await db.query("select finish_tryon($1,$2,null)", [
    job,
    await asset("result"),
  ]);
  assert.deepEqual(await wallet(), { available: 2, reserved: 0 });
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from credit_transactions where job_id=$1 and kind='refund'",
        [job],
      )
    ).rows[0]!.count,
    1,
  );
});
test("credit history is owner-only and clients cannot grant, alter or complete credits", async () => {
  assert.ok(
    (
      await userQuery(
        owner,
        "select id,kind,created_at from credit_transactions",
      )
    ).rows.length > 1,
  );
  const foreign = (
    await userQuery(
      other,
      "select * from credit_transactions where owner_id=$1",
      [owner],
    )
  ).rows;
  assert.equal(foreign.length, 0);
  for (const sql of [
    "update credit_wallets set available=999",
    "delete from credit_transactions",
    "insert into credit_transactions(owner_id,kind,amount) values(auth.uid(),'grant',3)",
    "select initialize_account(auth.uid())",
    "select reserve_tryon(auth.uid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'tryon-v1')",
  ])
    await assert.rejects(userQuery(owner, sql), /permission denied/);
});
