import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  MetadataGarmentIdentifier,
  budgetMinor,
  comparisonGroups,
  money,
  verifiedRetailerUrl,
} from "../src/lib/shopping-domain";
const db = new PGlite();
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.explore_outfits(id text primary key,published boolean);alter table public.explore_outfits enable row level security;
 grant select on public.explore_outfits to anon,authenticated;create policy published_explore on public.explore_outfits for select to anon,authenticated using(published);
 insert into public.explore_outfits values('navy',true),('rust',true),('green',true),('cream',true),('ivory',true),('hidden',false);`);
  await db.exec(
    await readFile("supabase/migrations/202610190006_catalog.sql", "utf8"),
  );
});
after(() => db.close());
async function guest(sql: string, args: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return tx.query<Record<string, any>>(sql, args);
  });
}
test("catalog pages are bounded, ordered, searchable and use strict budget boundaries", async () => {
  const first = (
    await guest(
      "select * from public.catalog_page('Jackets','','',null,'USD',-1,'',2)",
    )
  ).rows;
  // An empty exact identifier is deliberately a no-match request.
  assert.equal(first.length, 0);
  const page = (
    await guest(
      "select * from public.catalog_page('Jackets','',null,null,'USD',-1,'',2)",
    )
  ).rows;
  assert.equal(page.length, 2);
  assert.deepEqual(
    page.map((x) => x.price_minor),
    [3400, 3800],
  );
  const next = (
    await guest(
      "select * from public.catalog_page('Jackets','',null,null,'USD',$1,$2,2)",
      [page[1]!.price_minor, page[1]!.id],
    )
  ).rows;
  assert.ok(next.every((x) => !page.some((y) => x.id === y.id)));
  const budget = (
    await guest(
      "select * from public.catalog_page('Jackets','',null,4200,'USD')",
    )
  ).rows;
  assert.deepEqual(
    budget.map((x) => x.price_minor),
    [3400, 3800],
  );
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','NAVY')")).rows
      .length,
    2,
  );
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','%')")).rows
      .length,
    0,
  );
  assert.equal(
    (
      await guest(
        "select * from public.catalog_page('Jackets','',null,null,'PKR')",
      )
    ).rows.length,
    0,
  );
});
test("only verified non-demo products can be exact, and hidden sources never disclose matches", async () => {
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','','navy')")).rows
      .length,
    0,
  );
  await assert.rejects(
    db.exec(
      "insert into public.product_matches(explore_id,product_id,relation) values('navy','rust-jacket','exact')",
    ),
    /check constraint/,
  );
  await db.exec(
    "insert into public.product_matches(explore_id,product_id,relation,verification_type,evidence_url,verified_at) values('navy','rust-jacket','exact','manual_review','https://example.com/evidence',now())",
  );
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','','navy')")).rows
      .length,
    0,
  );
  await db.exec(
    "insert into public.catalog_retailers(id,name,domain,is_demo) values('fixture','Local test retailer','example.com',false)",
  );
  await db.exec(
    "insert into public.products(id,retailer_id,name,category,price_minor,currency,product_url,is_demo,published,price_checked_at) values('verified-fixture','fixture','Local test only','Jackets',1000,'USD','https://example.com/fixture',false,true,now())",
  );
  await db.exec(
    "insert into public.product_matches(explore_id,product_id,relation,verification_type,evidence_url,verified_at) values('navy','verified-fixture','exact','retailer_sku','https://example.com/evidence',now()),('hidden','verified-fixture','exact','retailer_sku','https://example.com/evidence',now())",
  );
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','','navy')"))
      .rows[0]!.id,
    "verified-fixture",
  );
  assert.equal(
    (await guest("select * from public.catalog_page('Jackets','','hidden')"))
      .rows.length,
    0,
  );
  await db.exec(
    "update public.catalog_retailers set active=false where id='fixture'",
  );
  assert.equal(
    (await guest("select * from public.products where id='verified-fixture'"))
      .rows.length,
    0,
  );
});
test("clients cannot fabricate prices, publish products, verify exact matches or inspect clicks", async () => {
  await assert.rejects(
    guest("update public.products set price_minor=1"),
    /permission denied/,
  );
  await assert.rejects(
    guest("insert into public.products(id) values('forged')"),
    /permission denied/,
  );
  await assert.rejects(
    guest("update public.product_matches set relation='exact'"),
    /permission denied/,
  );
  await assert.rejects(
    guest("select * from public.affiliate_clicks"),
    /permission denied/,
  );
  await assert.rejects(
    guest(
      "insert into public.affiliate_clicks(request_id,product_id,retailer_id,used_affiliate) values(gen_random_uuid(),'navy-bomber','sample-catalog',false)",
    ),
    /permission denied/,
  );
});
test("money and comparison never mix currency, sample/live data or clothing categories", () => {
  assert.equal(money(1500, "JPY"), "¥1,500");
  assert.match(money(1500, "KWD"), /1\.500/);
  assert.equal(budgetMinor(" 50.25 "), 5025);
  assert.equal(budgetMinor("50"), 5000);
  assert.equal(budgetMinor(""), null);
  for (const value of ["-1", "1e5", "NaN", "0.001", "50,25"])
    assert.throws(() => budgetMinor(value));
  assert.match(money(5025, "USD"), /50\.25/);
  assert.throws(() => money(-1, "USD"));
  assert.throws(() => money(1.5, "USD"));
  const rows = [
    {
      id: "a",
      category: "Tops",
      currency: "USD",
      price_minor: 2000,
      is_demo: true,
    },
    {
      id: "b",
      category: "Tops",
      currency: "USD",
      price_minor: 1000,
      is_demo: true,
    },
    {
      id: "c",
      category: "Tops",
      currency: "PKR",
      price_minor: 500,
      is_demo: true,
    },
    {
      id: "d",
      category: "Tops",
      currency: "USD",
      price_minor: 500,
      is_demo: false,
    },
    {
      id: "e",
      category: "Jackets",
      currency: "USD",
      price_minor: 500,
      is_demo: true,
    },
  ];
  const groups = comparisonGroups(rows);
  assert.equal(groups.length, 4);
  assert.deepEqual(
    groups[0]!.items.map((x) => x.id),
    ["b", "a"],
  );
});
test("external links require exact approved HTTPS hosts and cannot target private/network addresses", () => {
  assert.equal(
    verifiedRetailerUrl("https://shop.example.com/product?color=navy", [
      "shop.example.com",
    ]),
    "https://shop.example.com/product?color=navy",
  );
  for (const url of [
    "http://shop.example.com/x",
    "https://user:pass@shop.example.com/x",
    "https://shop.example.com:8443/x",
    "https://shop.example.com.evil.test/x",
    "javascript:alert(1)",
    "https://127.0.0.1/x",
    "https://localhost/x",
    "https://service.local/x",
  ])
    assert.throws(() =>
      verifiedRetailerUrl(url, [
        "shop.example.com",
        "127.0.0.1",
        "localhost",
        "service.local",
      ]),
    );
});
test("metadata identification is honest about its basis and does not invent missing garments", async () => {
  const adapter = new MetadataGarmentIdentifier();
  assert.deepEqual(await adapter.identify({ name: "An unknown image" }), []);
  assert.deepEqual(await adapter.identify({ category: "Other" }), []);
  const identified = await adapter.identify({
    category: "Jackets",
    color: "Navy",
    brand: "Saved brand",
  });
  assert.equal(identified.length, 1);
  assert.equal(identified[0]!.basis, "saved_details");
  assert.equal(identified[0]!.color, "Navy");
});
