import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  owner = randomUUID(),
  other = randomUUID(),
  a = randomUUID(),
  b = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to public;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
 create table public.try_on_jobs(id uuid primary key,owner_id uuid,status text);
 create table public.profiles(id uuid primary key,deleting_at timestamptz);`);
  await db.exec(
    await readFile("supabase/migrations/202610190003_library.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/migrations/202610190004_explore.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/migrations/202610190005_battles.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/migrations/202610220015_battle_modes.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610220016_battle_comments.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610260025_comment_safety.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/202610260026_push.sql", "utf8"),
  );
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("insert into public.profiles values($1,null),($2,null)", [
    owner,
    other,
  ]);
  await db.query(
    "insert into public.library_items(id,owner_id,kind,name,explore_image) values($1,$3,'inspiration','Sample A','navy'),($2,$3,'inspiration','Sample B','green')",
    [a, b, owner],
  );
});
after(() => db.close());
async function service(sql: string, args: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return tx.query<Record<string, any>>(sql, args);
  });
}
async function user(
  sql: string,
  args: unknown[] = [],
  id: string | null = owner,
) {
  return db.transaction(async (tx) => {
    await tx.exec(id ? "set local role authenticated" : "set local role anon");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    return tx.query(sql, args);
  });
}
async function create(mode = "anonymous") {
  const id = randomUUID();
  await service(
    "select public.create_battle($1,$2,'Test battle',$3,'library',$4,'library',$5)",
    [owner, id, mode, a, b],
  );
  return id;
}
async function publish(id: string) {
  await service(
    "update public.battles set ready=true,a_sample='navy',b_sample='green' where id=$1",
    [id],
  );
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
}
test("private drafts require owned distinct sources and an image-ready publish transition", async () => {
  const id = await create();
  assert.equal(
    (await user("select * from public.battles where id=$1", [id])).rows.length,
    1,
  );
  assert.equal(
    (await user("select * from public.battles where id=$1", [id], other)).rows
      .length,
    0,
  );
  await assert.rejects(
    user("select * from public.battles", [], null),
    /permission denied/,
  );
  await assert.rejects(
    service(
      "select public.create_battle($1,$2,'Foreign','anonymous','library',$3,'library',$4)",
      [other, randomUUID(), a, b],
    ),
    /INVALID_SOURCE/,
  );
  await assert.rejects(
    service(
      "select public.create_battle($1,$2,'Same','anonymous','library',$3,'library',$3)",
      [owner, randomUUID(), a],
    ),
    /check constraint/,
  );
  await assert.rejects(
    service("select public.manage_battle($1,$2,'publish')", [owner, id]),
    /INVALID_STATE/,
  );
  await publish(id);
  await assert.rejects(
    service("select public.manage_battle($1,$2,'unpublish')", [other, id]),
    /NOT_FOUND/,
  );
});
test("anonymous votes discard names, persist once and cannot change with repeated calls", async () => {
  const id = await create();
  await publish(id);
  await service(
    "select public.cast_battle_vote($1,'opaque-key','A','Do not store me',false)",
    [id],
  );
  const repeat = await service(
    "select public.cast_battle_vote($1,'opaque-key','B','Again',false) as pick",
    [id],
  );
  assert.equal(repeat.rows[0]!.pick, "A");
  const rows = (
    await service("select * from public.battle_votes where battle_id=$1", [id])
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.display_name, null);
  assert.deepEqual(
    (await service("select public.battle_counts($1) as counts", [id])).rows[0]!
      .counts,
    { A: 1, B: 0, C: 0, D: 0 },
  );
  await assert.rejects(
    user("select * from public.battle_votes"),
    /permission denied/,
  );
  await assert.rejects(
    user("select public.cast_battle_vote($1,'forged','A',null,false)", [id]),
    /permission denied/,
  );
  await assert.rejects(
    user("update public.battles set voting_mode='public' where id=$1", [id]),
    /permission denied/,
  );
});
test("public votes require authenticated consent and a bounded display name", async () => {
  const id = await create("public");
  await publish(id);
  await assert.rejects(
    service("select public.cast_battle_vote($1,'guest','B','Guest',false)", [
      id,
    ]),
    /PUBLIC_IDENTITY_REQUIRED/,
  );
  await assert.rejects(
    service("select public.cast_battle_vote($1,'user','B',' ',true)", [id]),
    /PUBLIC_IDENTITY_REQUIRED/,
  );
  await service(
    "select public.cast_battle_vote($1,'user','B','  Style friend  ',true)",
    [id],
  );
  assert.equal(
    (
      await service(
        "select display_name from public.battle_votes where battle_id=$1",
        [id],
      )
    ).rows[0]!.display_name,
    "Style friend",
  );
  await assert.rejects(
    service("select public.cast_battle_vote($1,'invalid','E','Friend',true)", [
      id,
    ]),
    /check constraint/,
  );
});
test("closing and unpublishing stop votes without deleting results or permitting republish", async () => {
  const id = await create();
  await publish(id);
  await service("select public.cast_battle_vote($1,'one','B',null,false)", [
    id,
  ]);
  await service("select public.manage_battle($1,$2,'close')", [owner, id]);
  await assert.rejects(
    service("select public.cast_battle_vote($1,'two','A',null,false)", [id]),
    /VOTING_CLOSED/,
  );
  await service("select public.manage_battle($1,$2,'unpublish')", [owner, id]);
  assert.deepEqual(
    (await service("select public.battle_counts($1) as counts", [id])).rows[0]!
      .counts,
    { A: 0, B: 1, C: 0, D: 0 },
  );
  await assert.rejects(
    service("select public.manage_battle($1,$2,'publish')", [owner, id]),
    /INVALID_STATE/,
  );
});
test("reports are deduplicated and private; hidden battles cannot receive votes", async () => {
  const id = await create();
  await publish(id);
  await service("select public.report_battle($1,'network','Privacy concern')", [
    id,
  ]);
  await service("select public.report_battle($1,'network','Other')", [id]);
  assert.equal(
    (
      await service("select * from public.battle_reports where battle_id=$1", [
        id,
      ])
    ).rows.length,
    1,
  );
  await assert.rejects(
    user("select * from public.battle_reports"),
    /permission denied/,
  );
  await service("update public.battles set status='hidden' where id=$1", [id]);
  await assert.rejects(
    service("select public.cast_battle_vote($1,'any','A',null,false)", [id]),
    /VOTING_CLOSED/,
  );
  await assert.rejects(
    service("select public.manage_battle($1,$2,'publish')", [owner, id]),
    /INVALID_STATE/,
  );
});
test("server rate limits are atomic and clients cannot bypass them", async () => {
  await service("select public.battle_rate('test-rate',2)");
  await service("select public.battle_rate('test-rate',2)");
  await assert.rejects(
    service("select public.battle_rate('test-rate',2)"),
    /RATE_LIMIT/,
  );
  await assert.rejects(
    user("select public.battle_rate('forged',9999)"),
    /permission denied/,
  );
  const bucket = (
    await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='battle-images'",
    )
  ).rows[0]!;
  assert.equal(bucket.public, false);
});

const jobs = async (who: string, n: number) => {
  const ids = Array.from({ length: n }, () => randomUUID());
  for (const id of ids)
    await db.query("insert into public.try_on_jobs values($1,$2,'completed')", [
      id,
      who,
    ]);
  return ids;
};
const createN = async (kind: string, sources: string[], who = owner) => {
  const id = randomUUID();
  await service(
    "select public.create_battle_n($1,$2,'Date night?','anonymous',$3,$4)",
    [
      who,
      id,
      kind,
      JSON.stringify(sources.map((x) => ({ kind: "job", id: x }))),
    ],
  );
  return id;
};
test("choose battles take 2-4 distinct owned looks and accept votes for C and D", async () => {
  const [j1, j2, j3, j4, j5] = await jobs(owner, 5);
  const [theirs] = await jobs(other, 1);
  await assert.rejects(createN("choose", [j1!]));
  await assert.rejects(createN("choose", [j1!, j2!, j3!, j4!, j5!]));
  await assert.rejects(createN("choose", [j1!, j1!]));
  await assert.rejects(createN("choose", [j1!, theirs!]));
  const id = await createN("choose", [j1!, j2!, j3!]);
  await service(
    "update public.battles set ready=true,a_path=id||'/a.jpg',b_path=id||'/b.jpg',c_path=id||'/c.jpg' where id=$1",
    [id],
  );
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
  await service("select public.cast_battle_vote($1,'v1','C',null,false)", [id]);
  await assert.rejects(
    service("select public.cast_battle_vote($1,'v2','D',null,false)", [id]),
  );
  const counts = (await service("select public.battle_counts($1) c", [id]))
    .rows[0]!.c;
  assert.deepEqual(counts, { A: 0, B: 0, C: 1, D: 0 });
});
test("versus battles wait for one friend to join with their own look, then go live", async () => {
  const [mine, mine2] = await jobs(owner, 2);
  const [theirs] = await jobs(other, 1);
  await assert.rejects(createN("versus", [mine!, mine2!]));
  const id = await createN("versus", [mine!]);
  await service("update public.battles set ready=true where id=$1", [id]);
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
  assert.equal(
    (await service("select status from public.battles where id=$1", [id]))
      .rows[0]!.status,
    "waiting",
  );
  const join = (who: string, job: string) =>
    service("select public.join_battle($1,$2,'job',$3)", [who, id, job]);
  await assert.rejects(join(owner, mine2!));
  await assert.rejects(join(other, mine!));
  await join(other, theirs!);
  await join(other, theirs!);
  const third = randomUUID();
  await db.query("insert into auth.users values($1)", [third]);
  await db.query("insert into public.profiles values($1,null)", [third]);
  const [thirds] = await jobs(third, 1);
  await assert.rejects(join(third, thirds!));
  assert.equal(
    (await user("select id from public.battles where id=$1", [id], other)).rows
      .length,
    1,
  );
  await assert.rejects(
    service("select public.cast_battle_vote($1,'v1','A',null,false)", [id]),
  );
});

test("comments need a live battle; only the author or battle owner can delete", async () => {
  const [j1, j2] = await jobs(owner, 2);
  const id = await createN("choose", [j1!, j2!]);
  const add = (key: string) =>
    service("select public.add_battle_comment($1,$2,'Sam','Go with A!')", [
      id,
      key,
    ]);
  await assert.rejects(add("k1"));
  await service(
    "update public.battles set ready=true,a_path=id||'/a.jpg',b_path=id||'/b.jpg' where id=$1",
    [id],
  );
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
  await add("k1");
  await add("k2");
  const ids = (
    await service(
      "select id from public.battle_comments where battle_id=$1 order by id",
      [id],
    )
  ).rows.map((r) => r.id);
  const del = (who: string | null, key: string, c: unknown) =>
    service("select public.delete_battle_comment($1,$2,$3)", [who, key, c]);
  await assert.rejects(del(other, "k3", ids[0]));
  await del(null, "k1", ids[0]);
  await del(owner, "nobody", ids[1]);
  assert.equal(
    (
      await service("select * from public.battle_comments where battle_id=$1", [
        id,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(
    service("select public.add_battle_comment($1,'k1','Sam','   ')", [id]),
  );
});

test("two reports hide a comment; blocking records the author for that viewer only", async () => {
  const [j1, j2] = await jobs(owner, 2);
  const id = await createN("choose", [j1!, j2!]);
  await service(
    "update public.battles set ready=true,a_path=id||'/a.jpg',b_path=id||'/b.jpg' where id=$1",
    [id],
  );
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
  await service("select public.add_battle_comment($1,'troll','Tro','meh')", [
    id,
  ]);
  const c = (
    await service("select id from public.battle_comments where battle_id=$1", [
      id,
    ])
  ).rows[0]!.id;
  const hidden = async () =>
    (
      await service("select hidden from public.battle_comments where id=$1", [
        c,
      ])
    ).rows[0]!.hidden;
  const report = (key: string) =>
    service("select public.report_battle_comment($1,$2)", [c, key]);
  await report("r1");
  await report("r1"); // the same person twice still counts once
  assert.equal(await hidden(), false);
  await report("r2");
  assert.equal(await hidden(), true);
  await service("select public.block_comment_author($1,'r1')", [c]);
  await service("select public.block_comment_author($1,'troll')", [c]); // not yourself
  assert.deepEqual(
    (await service("select blocker_key,blocked_key from public.battle_blocks"))
      .rows,
    [{ blocker_key: "r1", blocked_key: "troll" }],
  );
  await assert.rejects(
    service("select public.report_battle_comment(999999,'r3')"),
  );
});

test("vote milestones notify once each; comment pushes wait 3 hours", async () => {
  const [j1, j2] = await jobs(owner, 2);
  const id = await createN("choose", [j1!, j2!]);
  await service(
    "update public.battles set ready=true,a_path=id||'/a.jpg',b_path=id||'/b.jpg' where id=$1",
    [id],
  );
  await service("select public.manage_battle($1,$2,'publish')", [owner, id]);
  const milestone = async () =>
    (await service("select public.battle_vote_milestone($1) m", [id])).rows[0]!
      .m;
  const vote = (k: string) =>
    service("select public.cast_battle_vote($1,$2,'A',null,false)", [id, k]);
  assert.equal(await milestone(), null);
  await vote("p1");
  assert.equal(await milestone(), 1);
  assert.equal(await milestone(), null); // already announced
  for (const k of ["p2", "p3", "p4"]) await vote(k);
  assert.equal(await milestone(), null);
  await vote("p5");
  assert.equal(await milestone(), 5);
  const comment = async () =>
    (await service("select public.battle_comment_push($1) ok", [id])).rows[0]!
      .ok;
  assert.equal(await comment(), true);
  assert.equal(await comment(), false);
  await service(
    "update public.battles set comment_pushed_at=now()-interval '4 hours' where id=$1",
    [id],
  );
  assert.equal(await comment(), true);
});
