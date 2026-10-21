import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  owner = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());`);
  for (const file of [
    "202610190003_library.sql",
    "202610190004_explore.sql",
    "202610210010_brand_explore.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1)", [owner]);
});
after(() => db.close());

test("brand photos replace samples, and saving keeps the photo", async () => {
  const feed = (await db.query<any>("select * from public.explore_page()"))
    .rows;
  assert.ok(feed.length > 0);
  assert.ok(feed.every((x) => x.photo_url && x.price_label && x.source_url));
  const saved = await db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      owner,
    ]);
    const { rows } = await tx.query<any>("select public.save_explore($1) id", [
      feed[0].id,
    ]);
    return (
      await tx.query<any>(
        "select explore_photo_url from public.library_items where id=$1",
        [rows[0].id],
      )
    ).rows[0];
  });
  assert.equal(saved.explore_photo_url, feed[0].photo_url);
  await assert.rejects(
    db.query(
      "update public.explore_outfits set photo_url='https://evil.example/x.jpg' where id=$1",
      [feed[0].id],
    ),
    /check constraint/,
  );
});
