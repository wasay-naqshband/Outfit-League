import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  owner = randomUUID(),
  other = randomUUID(),
  battle = randomUUID(),
  a = randomUUID(),
  b = randomUUID();
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
    "202610200008_live_catalog",
    "202610200009_catalog_approval_privacy",
    "202610220013_avatars",
    "202610220014_saved_person_photo",
    "202610220015_battle_modes",
    "202610220016_battle_comments",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}.sql`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query(
    "insert into library_items(id,owner_id,kind,name,explore_image) values($1,$3,'inspiration','A','navy'),($2,$3,'inspiration','B','green')",
    [a, b, owner],
  );
  await db.query(
    "select create_battle($1,$2,'Test','public','library',$3,'library',$4)",
    [owner, battle, a, b],
  );
  await db.query(
    "update battles set ready=true,status='published',a_path=$2 where id=$1",
    [battle, battle + "/a.jpg"],
  );
});
after(() => db.close());
async function user(sql: string, args: unknown[] = [], id = owner) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    return tx.query(sql, args);
  });
}
test("profile name can be edited only by its owner; account state and moderator grants remain protected", async () => {
  await user("update profiles set display_name='Test' where id=$1", [owner]);
  assert.equal(
    (await user("select * from profiles where id=$1", [other])).rows.length,
    0,
  );
  await assert.rejects(
    user("update profiles set deleting_at=now() where id=$1", [owner]),
  );
  await assert.rejects(user("insert into moderators values($1)", [owner]));
  await assert.rejects(
    user("select request_account_deletion($1,'key')", [owner]),
  );
  await assert.rejects(
    db.query("select hide_reported_battle($1,$2)", [owner, battle]),
    /FORBIDDEN/,
  );
  await db.query("insert into moderators values($1)", [other]);
  await db.query("select hide_reported_battle($1,$2)", [other, battle]);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from battles where id=$1",
        [battle],
      )
    ).rows[0]?.status,
    "hidden",
  );
  assert.equal(
    (await db.query("select * from moderation_actions")).rows.length,
    1,
  );
});
test("active jobs prevent deletion and stale authentication requires a new sign-in", async () => {
  const id = randomUUID(),
    session = randomUUID(),
    person = randomUUID(),
    garment = randomUUID();
  await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "insert into auth.sessions(id,user_id,created_at) values($1,$2,now()-interval '1 hour')",
    [session, id],
  );
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select account_recent_signin($1,$2) ok",
        [id, session],
      )
    ).rows[0]?.ok,
    false,
  );
  await db.query("update auth.sessions set created_at=now() where id=$1", [
    session,
  ]);
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select account_recent_signin($1,$2) ok",
        [id, session],
      )
    ).rows[0]?.ok,
    true,
  );
  for (const [asset, kind] of [
    [person, "person"],
    [garment, "garment"],
  ])
    await db.query(
      "insert into private_assets(id,owner_id,kind,path,byte_size,content_type) values($1,$2,$3,$4,1024,'image/jpeg')",
      [asset, id, kind, `${id}/${asset}.jpg`],
    );
  await db.query("select reserve_tryon($1,$2,$3,$4,'tryon-v1')", [
    id,
    randomUUID(),
    person,
    garment,
  ]);
  await assert.rejects(
    db.query("select request_account_deletion($1,'key')", [id]),
    /ACTIVE_JOB/,
  );
  assert.equal(
    (await db.query("select * from account_deletions where owner_id=$1", [id]))
      .rows.length,
    0,
  );
  await db.query("delete from auth.users where id=$1", [id]);
});
test("deletion immediately denies old-token access, removes votes, queues snapshot cleanup and cannot be reversed", async () => {
  await db.query(
    "insert into battle_votes(battle_id,voter_key,choice,display_name) values($1,'test-key','A','Test')",
    [battle],
  );
  await db.query("select request_account_deletion($1,'test-key')", [owner]);
  await db.query("select request_account_deletion($1,'test-key')", [owner]);
  for (const table of [
    "profiles",
    "credit_wallets",
    "library_items",
    "battles",
  ])
    assert.equal((await user(`select * from ${table}`)).rows.length, 0);
  await assert.rejects(
    user("insert into library_items(kind,name) values('wardrobe','new')"),
  );
  await assert.rejects(
    db.query("update battles set status='published' where id=$1", [battle]),
    /ACCOUNT_DELETING/,
  );
  assert.equal((await db.query("select * from battle_votes")).rows.length, 0);
  assert.equal(
    (await db.query("select * from account_cleanup where owner_id=$1", [owner]))
      .rows.length,
    2,
  );
  await db.query("delete from auth.users where id=$1", [owner]);
  assert.equal(
    (await db.query("select * from library_items where owner_id=$1", [owner]))
      .rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from battles where id=$1", [battle])).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("select * from account_deletions where owner_id=$1", [
        owner,
      ])
    ).rows.length,
    1,
  );
});
test("live feed requires operator approval; atomic snapshots hide stale, unavailable and removed offers", async () => {
  await db.exec(
    "insert into catalog_retailers(id,name,domain,is_demo) values('test','Fixture','shop.example.com',false)",
  );
  const now = Date.now(),
    offer = {
      external_id: "1",
      name: "Fixture only",
      category: "Jackets",
      price_minor: 2500,
      currency: "USD",
      product_url: "https://shop.example.com/1",
      image_url: "https://images.example.com/1.jpg",
      price_checked_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 60000).toISOString(),
    };
  await assert.rejects(
    db.query("select import_catalog('test',$1)", [JSON.stringify([offer])]),
    /RETAILER_APPROVAL_REQUIRED/,
  );
  await db.exec(
    "update catalog_retailers set feed_source='Fixture',permission_evidence='Test only',image_hosts=array['images.example.com'] where id='test'",
  );
  await db.query("select import_catalog('test',$1)", [JSON.stringify([offer])]);
  assert.equal(
    (await user("select * from catalog_page(p_live=>true)", [], other)).rows
      .length,
    1,
  );
  await assert.rejects(
    db.query("select import_catalog('test',$1)", [
      JSON.stringify([
        { ...offer, external_id: "2" },
        { ...offer, image_url: "https://evil.example/a" },
      ]),
    ]),
    /INVALID_FEED/,
  );
  assert.equal(
    (await db.query("select * from products where retailer_id='test'")).rows
      .length,
    1,
  );
  await db.exec(
    "update products set expires_at=now()-interval '1 second',price_checked_at=now()-interval '1 hour' where retailer_id='test'",
  );
  assert.equal(
    (await user("select * from catalog_page(p_live=>true)", [], other)).rows
      .length,
    0,
  );
  await db.query("select import_catalog('test',$1)", [
    JSON.stringify([{ ...offer, availability: "out_of_stock" }]),
  ]);
  assert.equal(
    (await user("select * from catalog_page(p_live=>true)", [], other)).rows
      .length,
    0,
  );
  await db.query("select import_catalog('test',$1)", ["[]"]);
  assert.equal(
    (
      await db.query<{ published: boolean }>(
        "select published from products where retailer_id='test'",
      )
    ).rows[0]?.published,
    false,
  );
  await assert.rejects(user("select import_catalog('test','[]')", [], other));
  await assert.rejects(
    user(
      "select feed_source,permission_evidence from catalog_retailers",
      [],
      other,
    ),
  );
});
test("profile photos are owner-only and found by account deletion", async () => {
  await db.exec(
    "grant insert,update,delete on storage.objects to authenticated",
  );
  // Earlier tests start deleting the owner account, so use a fresh person.
  const me = randomUUID();
  await db.query("insert into auth.users values($1)", [me]);
  const mine = me + "/avatar.jpg";
  await user(
    "insert into storage.objects(bucket_id,name) values('avatars',$1)",
    [mine],
    me,
  );
  const insert =
    "insert into storage.objects(bucket_id,name) values('avatars',$1)";
  await assert.rejects(user(insert, [other + "/avatar.jpg"], me));
  await assert.rejects(user(insert, [me + "/other.jpg"], me));
  assert.equal(
    (
      await user(
        "select name from storage.objects where bucket_id='avatars'",
        [],
        other,
      )
    ).rows.length,
    0,
  );
  assert.deepEqual(
    (
      await db.query("select name from account_storage_paths($1,'avatars')", [
        me,
      ])
    ).rows,
    [{ name: mine }],
  );
});
test("saved try-on photos are owner-only and found by account deletion", async () => {
  const me = randomUUID();
  await db.query("insert into auth.users values($1)", [me]);
  const insert =
    "insert into storage.objects(bucket_id,name) values('saved-photos',$1)";
  await user(insert, [me + "/person.jpg"], me);
  await assert.rejects(user(insert, [other + "/person.jpg"], me));
  await assert.rejects(user(insert, [me + "/avatar.jpg"], me));
  assert.deepEqual(
    (
      await db.query(
        "select name from account_storage_paths($1,'saved-photos')",
        [me],
      )
    ).rows,
    [{ name: me + "/person.jpg" }],
  );
});
