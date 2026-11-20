import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const { wearable, classifyKind, classifyStyle } = createRequire(
  import.meta.url,
)("../scripts/catalog-classify.cjs");
const kind = (title: string, productType = "", tags = "") =>
  wearable({ title, productType, tags })
    ? classifyKind({ title, productType, tags })
    : "HIDDEN";

test("art prints and home goods are not wearable", () => {
  assert.equal(
    kind("Mt Hood Art Print by Tomi Lahdesmaki", "accessory"),
    "HIDDEN",
  );
  assert.equal(kind("Summit Poster", "decor"), "HIDDEN");
  assert.equal(kind("Soy Candle - Cedar"), "HIDDEN");
  // Real clothes that merely contain a trigger word stay.
  assert.equal(kind("Cotton Canvas Jacket", "outerwear"), "Jackets");
  assert.equal(kind("Blanket Shirt - Outerworn", "shirts"), "Shirts");
  assert.equal(kind("Angel Girl Sweatshirt", "sweatshirt"), "Hoodies");
});

test("footwear is never a top, and colourways do not decide the garment", () => {
  assert.equal(
    kind("VANS Premium Old Skool 36 - Pearlized White", "low top sneakers"),
    "Shoes",
  );
  assert.equal(
    kind("Nike Kobe 8 Protro", "low top sneakers", "footwear"),
    "Shoes",
  );
  assert.equal(kind("High Twist Zip Parka - Top Blue", "parkas"), "Jackets");
  assert.equal(kind("Cap Sleeve Top", "tops"), "Tops");
});

test("garment type follows the head noun", () => {
  assert.equal(kind("Insulated Work Jacket Raw Denim"), "Jackets");
  assert.equal(kind("Low Rise Baggy Jeans", "jeans"), "Denim");
  assert.equal(kind("Lynea Halter Bikini Top", "swimwear"), "Swimwear");
  assert.equal(kind("Corset Hoodie", "outerwear"), "Hoodies");
  assert.equal(kind("Canvas Market Tote", "accessory"), "Accessories");
});

test("explicit style words beat the brand default; weak ones do not", () => {
  const s = (title: string, brandStyle: string) =>
    classifyStyle({ title, productType: "", tags: "", brandStyle });
  assert.equal(s("Vintage Wash Tee", "Streetwear").style, "Vintage");
  assert.equal(s("Seamless Training Legging", "Casual").style, "Athleisure");
  // "Oversized" alone must not pull a Y2K brand's item into Streetwear.
  assert.deepEqual(s("Oversized Cami", "Y2K"), {
    style: "Y2K",
    explicit: true,
  });
  assert.equal(s("Duffle Bag", "Streetwear").explicit, false);
});

let db: PGlite;
before(async () => {
  db = new PGlite();
  const base = await readFile(
    "supabase/migrations/202610190004_explore.sql",
    "utf8",
  );
  await db.exec(`create role anon;create role authenticated;`);
  await db.exec(
    base.slice(
      base.indexOf("create table public.explore_outfits"),
      base.indexOf("alter table public.explore_outfits enable"),
    ),
  );
  await db.exec(
    `alter table public.explore_outfits drop constraint explore_outfits_style_check;
     alter table public.explore_outfits add column photo_url text, add column price_label text not null default '';`,
  );
  for (const file of [
    "202611200034_us_explore.sql",
    "202611200035_explore_quality.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
});
after(() => db.close());

async function feed(filter: string, search = "") {
  const out: any[] = [];
  let cursor = -1;
  for (;;) {
    const { rows } = await db.query<any>(
      "select * from public.explore_page($1,$2,$3,40)",
      [search, filter, cursor],
    );
    out.push(...rows);
    if (rows.length < 40) return out;
    cursor = rows.at(-1).rank;
  }
}

test("Trending is wearable apparel and shoes only, mixed across brands", async () => {
  const trending = await feed("");
  assert.ok(trending.length > 1000);
  assert.ok(trending.every((x) => x.category !== "Accessories"));
  assert.ok(trending.every((x) => !/art print/i.test(x.name)));
  assert.ok(new Set(trending.slice(0, 40).map((x) => x.brand)).size >= 25);
  assert.equal((await feed("", "mt hood")).length, 0);
});

test("garment tabs match category exactly, so shoes never appear under Tops", async () => {
  for (const category of [
    "Tops",
    "Shirts",
    "Knitwear",
    "Hoodies",
    "Jackets",
    "Denim",
    "Bottoms",
    "Dresses",
    "Shoes",
  ]) {
    const rows = await feed(category);
    assert.ok(rows.length > 50, category);
    assert.ok(
      rows.every((x) => x.category === category),
      category,
    );
  }
  const tops = await feed("Tops");
  assert.ok(!tops.some((x) => /\b(vans|sneaker|old skool)\b/i.test(x.name)));
  assert.ok((await feed("Shoes")).some((x) => /old skool/i.test(x.name)));
});

test("style tabs match style exactly and accessories need explicit evidence", async () => {
  for (const style of [
    "Streetwear",
    "Y2K",
    "Minimal",
    "Casual",
    "Vintage",
    "Athleisure",
    "Formal",
  ]) {
    const rows = await feed(style);
    assert.ok(rows.length > 50, style);
    assert.ok(
      rows.every((x) => x.style === style),
      style,
    );
    assert.ok(
      rows.every((x) => x.category !== "Accessories" || x.style_explicit),
      style,
    );
  }
});
