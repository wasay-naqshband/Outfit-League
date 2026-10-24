import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  findProductImage,
  linkImage,
  publicUrl,
} from "../supabase/functions/_shared/link-image.ts";
import { toBase64 } from "../supabase/functions/_shared/domain.ts";

const db = new PGlite();
const owner = randomUUID();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
  for (const file of [
    "202610190001_tryon.sql",
    "202610220017_outfits_stylist.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1)", [owner]);
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
const reserve = (
  key: string,
  person: string,
  garments: string[],
  parts: string[],
) =>
  db.query<{ r: { job: { id: string; credits: number }; created: boolean } }>(
    "select reserve_tryon($1,$2,$3,$4,'tryon-v1',$5::uuid[],$6::text[]) r",
    [owner, key, person, garments[0], garments.slice(1), parts],
  );

test("an outfit reserves one credit per piece and refunds them all on failure", async () => {
  await db.query("select initialize_account($1)", [owner]);
  const person = await asset("person");
  const pieces = [
    await asset("garment"),
    await asset("garment"),
    await asset("garment"),
  ];
  const key = randomUUID();
  const job = (await reserve(key, person, pieces, ["top", "bottom", "outer"]))
    .rows[0]!.r;
  assert.equal(job.created, true);
  assert.equal(job.job.credits, 3);
  assert.deepEqual(await wallet(), { available: 0, reserved: 3 });
  // Retrying the same request is idempotent and free.
  assert.equal(
    (await reserve(key, person, pieces, ["top", "bottom", "outer"])).rows[0]!.r
      .created,
    false,
  );
  await db.query("select finish_tryon($1,null,'GENERATION_FAILED')", [
    job.job.id,
  ]);
  assert.deepEqual(await wallet(), { available: 3, reserved: 0 });
  const refund = await db.query<{ amount: number }>(
    "select amount from credit_transactions where job_id=$1 and kind='refund'",
    [job.job.id],
  );
  assert.equal(refund.rows[0]!.amount, 3);
});

test("outfits reject reused, duplicate or foreign pieces and too few credits", async () => {
  const person = await asset("person");
  const a = await asset("garment"),
    b = await asset("garment");
  await assert.rejects(
    reserve(randomUUID(), person, [a, a], []),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    reserve(randomUUID(), person, [a, b], ["top", "top"]),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    reserve(randomUUID(), person, [a, b], ["top"]),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    reserve(randomUUID(), person, [a, person], []),
    /INVALID_ASSETS/,
  );
  await db.query("update credit_wallets set available=1 where owner_id=$1", [
    owner,
  ]);
  await assert.rejects(
    reserve(randomUUID(), person, [a, b], ["top", "bottom"]),
    /NO_CREDITS/,
  );
  // A single piece still works with one credit.
  const one = (await reserve(randomUUID(), person, [a], [])).rows[0]!.r;
  assert.equal(one.job.credits, 1);
  await db.query("select finish_tryon($1,null,'GENERATION_FAILED')", [
    one.job.id,
  ]);
  // A piece already used by a job can't join another outfit.
  await db.query("update credit_wallets set available=3 where owner_id=$1", [
    owner,
  ]);
  await assert.rejects(
    reserve(randomUUID(), person, [b, a], []),
    /INVALID_ASSETS/,
  );
});

test("store links: product photo found, private addresses refused", async () => {
  assert.equal(
    findProductImage(
      `<head><meta content="https://cdn.shop.com/a.jpg?w=1&amp;h=2" property="og:image"></head>`,
    ),
    "https://cdn.shop.com/a.jpg?w=1&h=2",
  );
  assert.equal(
    findProductImage(
      `<script type="application/ld+json">{"@type":"Product","image":["https:\\/\\/x.com\\/p.png"]}</script>`,
    ),
    "https://x.com/p.png",
  );
  assert.equal(findProductImage("<p>nothing</p>"), null);
  for (const bad of [
    "http://localhost/x",
    "http://127.0.0.1/x",
    "http://169.254.169.254/latest",
    "http://[::1]/x",
    "https://shop.com:8443/x",
    "https://user:pw@shop.com/x",
    "file:///etc/passwd",
    "http://intranet/x",
    "http://printer.local/x",
  ])
    assert.throws(() => publicUrl(bad), /LINK_FAILED/, bad);
  assert.equal(publicUrl("https://www.zara.com/p").hostname, "www.zara.com");

  const publicDns = async (hostname: string, type: "A" | "AAAA") => {
    if (hostname === "private.shop.com")
      return type === "A" ? ["10.1.2.3"] : [];
    if (hostname === "v6-private.shop.com")
      return type === "AAAA" ? ["fd00::1"] : [];
    if (type === "A") return ["93.184.216.34"];
    const missing = new Error("no AAAA record");
    missing.name = "NotFound";
    throw missing;
  };

  // A redirect to a private address is refused before it's fetched.
  const seen: string[] = [];
  const request = (async (url: string) => {
    seen.push(url);
    if (url === "https://shop.com/p")
      return new Response(`<meta property="og:image" content="/img/p.webp">`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    if (url === "https://shop.com/img/p.webp")
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/webp" },
      });
    if (url === "https://shop.com/dns-redirect")
      return new Response(null, {
        status: 302,
        headers: { location: "https://private.shop.com/admin" },
      });
    return new Response(null, {
      status: 302,
      headers: { location: "http://10.0.0.1/admin" },
    });
  }) as typeof fetch;
  const found = await linkImage("https://shop.com/p", request, publicDns);
  assert.equal(found.type, "image/webp");
  assert.deepEqual([...found.data], [1, 2, 3]);
  await assert.rejects(
    linkImage("https://shop.com/r", request, publicDns),
    /LINK_FAILED/,
  );
  assert.ok(!seen.some((url) => url.includes("10.0.0.1")));
  const beforeDnsBlock = seen.length;
  await assert.rejects(
    linkImage("https://private.shop.com/p", request, publicDns),
    /LINK_FAILED/,
  );
  await assert.rejects(
    linkImage("https://v6-private.shop.com/p", request, publicDns),
    /LINK_FAILED/,
  );
  await assert.rejects(
    linkImage("https://shop.com/dns-redirect", request, publicDns),
    /LINK_FAILED/,
  );
  assert.equal(seen.length, beforeDnsBlock + 1);
  assert.ok(!seen.some((url) => url.includes("private.shop.com")));
});
