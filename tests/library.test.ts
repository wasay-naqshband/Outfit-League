import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = randomUUID(),
  other = randomUUID();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;`);
  await db.exec(
    await readFile("supabase/migrations/202610190003_library.sql", "utf8"),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
});
after(() => db.close());
async function asUser<T>(id: string, action: (tx: PGlite) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    return action(tx as unknown as PGlite);
  });
}
test("private library CRUD persists metadata while other accounts see nothing", async () => {
  const id = randomUUID();
  await asUser(owner, (tx) =>
    tx.query(
      "insert into public.library_items(id,kind,name,source_url,tags) values($1,'inspiration','Weekend fit','https://example.com/look','weekend')",
      [id],
    ),
  );
  assert.equal(
    (
      await asUser(other, (tx) =>
        tx.query("select * from public.library_items where id=$1", [id]),
      )
    ).rows.length,
    0,
  );
  await asUser(other, (tx) =>
    tx.query("update public.library_items set name='Stolen' where id=$1", [id]),
  );
  await asUser(owner, (tx) =>
    tx.query(
      "update public.library_items set name='My weekend fit',notes='Keep this' where id=$1",
      [id],
    ),
  );
  const row = (
    await asUser(owner, (tx) =>
      tx.query<{ name: string; notes: string }>(
        "select name,notes from public.library_items where id=$1",
        [id],
      ),
    )
  ).rows[0]!;
  assert.equal(row.name, "My weekend fit");
  assert.equal(row.notes, "Keep this");
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("update public.library_items set owner_id=$1 where id=$2", [
        other,
        id,
      ]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into public.library_items(owner_id,kind,name) values($1,'wardrobe','Foreign')",
        [other],
      ),
    ),
    /row-level security/,
  );
});
test("photo policies restrict upload paths and reads to the owning item", async () => {
  const id = randomUUID(),
    path = `${owner}/${id}/${randomUUID()}.jpg`;
  await asUser(owner, (tx) =>
    tx.query(
      "insert into public.library_items(id,kind,name) values($1,'wardrobe','Denim jacket')",
      [id],
    ),
  );
  await asUser(owner, (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name) values('library-private',$1)",
      [path],
    ),
  );
  await asUser(owner, (tx) =>
    tx.query("update public.library_items set photo_path=$1 where id=$2", [
      path,
      id,
    ]),
  );
  assert.equal(
    (
      await asUser(owner, (tx) =>
        tx.query("select * from storage.objects where name=$1", [path]),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asUser(other, (tx) =>
        tx.query("select * from storage.objects where name=$1", [path]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(other, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('library-private',$1)",
        [path],
      ),
    ),
    /row-level security/,
  );
  const wrong = `${owner}/${randomUUID()}/${randomUUID()}.jpg`;
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name) values('library-private',$1)",
        [wrong],
      ),
    ),
    /row-level security/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("update public.library_items set photo_path=$1 where id=$2", [
        `${other}/${id}/${randomUUID()}.jpg`,
        id,
      ]),
    ),
    /check constraint/,
  );
});
test("replacement and deletion queue durable byte cleanup and revoke new photo reads", async () => {
  const id = randomUUID(),
    first = `${owner}/${id}/${randomUUID()}.jpg`,
    second = `${owner}/${id}/${randomUUID()}.jpg`;
  await asUser(owner, (tx) =>
    tx.query(
      "insert into public.library_items(id,kind,name,photo_path) values($1,'wardrobe','My shirt',$2)",
      [id, first],
    ),
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('library-private',$1),('library-private',$2)",
    [first, second],
  );
  await asUser(owner, (tx) =>
    tx.query("update public.library_items set photo_path=$1 where id=$2", [
      second,
      id,
    ]),
  );
  await asUser(owner, (tx) =>
    tx.query("delete from public.library_items where id=$1", [id]),
  );
  const queue = (
    await db.query<{ path: string }>("select path from public.library_cleanup")
  ).rows.map((x) => x.path);
  assert.ok(queue.includes(first));
  assert.ok(queue.includes(second));
  assert.equal(
    (
      await asUser(owner, (tx) =>
        tx.query("select * from storage.objects where name=$1", [second]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(owner, (tx) => tx.query("select * from public.library_cleanup")),
    /permission denied/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query("select * from public.library_cleanup_paths()"),
    ),
    /permission denied/,
  );
});
test("malformed metadata and anonymous reads are rejected", async () => {
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into public.library_items(kind,name) values('wardrobe','')",
      ),
    ),
    /check constraint/,
  );
  await assert.rejects(
    asUser(owner, (tx) =>
      tx.query(
        "insert into public.library_items(kind,name,source_url) values('inspiration','Unsafe','javascript:alert(1)')",
      ),
    ),
    /check constraint/,
  );
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      return tx.query("select * from public.library_items");
    }),
    /permission denied/,
  );
  const bucket = (
    await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='library-private'",
    )
  ).rows[0]!;
  assert.equal(bucket.public, false);
});
