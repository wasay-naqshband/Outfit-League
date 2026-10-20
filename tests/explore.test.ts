import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  owner = randomUUID(),
  other = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());`);
  for (const file of ["202610190003_library.sql", "202610190004_explore.sql"])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  for (let i = 5; i < 30; i++)
    await db.query(
      `insert into public.explore_outfits(id,name,style,category,description,brand,tags,image,palette,source_label,published,rank)
    values($1,$2,'Minimal','Tops','Pagination fixture','Test Brand','distant-tag','cream','coral','Test only',true,$3)`,
      ["test-" + i, "Fixture " + i, i],
    );
  await db.exec(`insert into public.explore_outfits(id,name,style,category,description,image,palette,source_label,published,rank)
    values('unpublished','Hidden','Minimal','Tops','Not published','cream','coral','Test only',false,99)`);
});
after(() => db.close());
async function run(
  sql: string,
  params: unknown[] = [],
  user: string | null = owner,
) {
  return db.transaction(async (tx) => {
    await tx.exec(
      user ? "set local role authenticated" : "set local role anon",
    );
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    return tx.query<Record<string, any>>(sql, params);
  });
}
test("public pagination is stable, bounded, and hides unpublished outfits", async () => {
  let cursor = -1;
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const page = (
      await run(
        "select * from public.explore_page('','',$1,12)",
        [cursor],
        null,
      )
    ).rows;
    assert.ok(page.length <= 12);
    ids.push(...page.map((x) => x.id));
    cursor = page.at(-1)!.rank;
  }
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.ok(!ids.includes("unpublished"));
  assert.equal(
    (
      await run(
        "select * from public.explore_outfits where id='unpublished'",
        [],
        null,
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    run(
      "update public.explore_outfits set published=true where id='unpublished'",
    ),
    /permission denied/,
  );
});
test("database search finds later pages, brands and tags with combined style filters", async () => {
  assert.equal(
    (
      await run(
        "select * from public.explore_page('fixture 29','Minimal')",
        [],
        null,
      )
    ).rows[0]!.id,
    "test-29",
  );
  assert.equal(
    (
      await run(
        "select * from public.explore_page('TEST BRAND','Minimal',-1,40)",
        [],
        null,
      )
    ).rows.length,
    25,
  );
  assert.equal(
    (
      await run(
        "select * from public.explore_page('distant-tag','Streetwear')",
        [],
        null,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await run("select * from public.explore_page('%','')", [], null)).rows
      .length,
    0,
  );
});
test("repeated saves preserve one private snapshot, source and garment without changing edits", async () => {
  const first = (await run("select public.save_explore('navy') as id")).rows[0]!
    .id;
  await run(
    "update public.library_items set name='My custom name' where id=$1",
    [first],
  );
  const again = (await run("select public.save_explore('navy') as id")).rows[0]!
    .id;
  assert.equal(first, again);
  const rows = (
    await run("select * from public.library_items where explore_id='navy'")
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.name, "My custom name");
  assert.equal(rows[0]!.explore_image, "navy");
  assert.equal(rows[0]!.explore_garment, "navy");
  assert.match(rows[0]!.notes, /Source: Outfit League/);
  assert.equal(
    (
      await run(
        "select * from public.library_items where id=$1",
        [first],
        other,
      )
    ).rows.length,
    0,
  );
  const theirs = (
    await run("select public.save_explore('navy') as id", [], other)
  ).rows[0]!.id;
  assert.notEqual(first, theirs);
  await run("delete from public.library_items where id=$1", [first]);
  assert.notEqual(
    (await run("select public.save_explore('navy') as id")).rows[0]!.id,
    first,
  );
});
test("anonymous saves, unpublished saves and forged catalog snapshots are rejected", async () => {
  await assert.rejects(
    run("select public.save_explore('navy')", [], null),
    /permission denied/,
  );
  await assert.rejects(
    run("select public.save_explore('unpublished')"),
    /Outfit unavailable/,
  );
  await assert.rejects(
    run(
      "insert into public.library_items(kind,name,explore_id) values('inspiration','Fake','navy')",
    ),
    /permission denied/,
  );
  await assert.rejects(
    run("update public.library_items set explore_garment='rust'"),
    /permission denied/,
  );
});
