import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pieceOptions,
  rank,
  usStorePage,
  shopping,
  usd,
  type Lookalike,
} from "../supabase/functions/_shared/lookalikes.ts";

test("prices: dollars parse, junk is refused", () => {
  assert.equal(usd("$49.99"), 49.99);
  assert.equal(usd("$1,249.00 now"), 1249);
  assert.equal(usd("39"), 39);
  for (const bad of ["", "Free", "$0", null, 12]) assert.equal(usd(bad), null);
});

test("shopping: US search, only priced items with secure links and photos", async () => {
  let body: Record<string, unknown> = {};
  const item = (
    source: string,
    price: string,
    link = "https://shop.com/p",
  ) => ({
    title: `${source} zip knit`,
    source,
    price,
    link,
    imageUrl: "https://img.com/a.jpg",
  });
  const items = await shopping("k", "grey zip knit", (async (
    _url: string,
    options: RequestInit,
  ) => {
    body = JSON.parse(String(options.body));
    return Response.json({
      shopping: [
        item("H&M", "$49.99"),
        item("Shady", "$5.00", "http://insecure.com/p"),
        item("NoPrice", "Free"),
      ],
    });
  }) as typeof fetch);
  assert.equal(body.gl, "us");
  assert.deepEqual(
    items.map((i) => i.store),
    ["H&M"],
  );
});

test("rank: weak matches dropped, closest first, then cheapest, one per store", () => {
  const l = (store: string, price: number, score?: number): Lookalike => ({
    title: store,
    store,
    price,
    url: `https://${store}.com/${price}`,
    image: "https://img.com/a.jpg",
    score,
  });
  assert.deepEqual(
    rank([
      l("Walmart", 12, 3), // plain knit: dropped
      l("Shein", 18, 9),
      l("Shein", 15, 7), // same store, lower score: dropped
      l("Target", 25, 7),
      l("H&M", 49, 10),
    ]).map((i) => [i.store, i.price]),
    [
      ["H&M", 49], // closest match
      ["Shein", 18],
      ["Target", 25],
    ],
  );
  // No scores (AI unavailable): cheapest first, nothing dropped.
  assert.deepEqual(
    rank([l("A", 30), l("B", 10)]).map((i) => i.store),
    ["B", "A"],
  );
});

test("lens: only US store pages, not social, wholesale or foreign storefronts", () => {
  for (const ok of [
    "https://us.shein.com/Zip-Knit-p-1.html",
    "https://www.shein.com/Zip-Knit-p-2.html",
    "https://piccoclothing.com/products/dnd-sweater-brown",
  ])
    assert.equal(usStorePage(ok), true, ok);
  for (const bad of [
    "https://au.shein.com/Zip-Knit-p-1.html",
    "https://www.temu.com/is-en/zip-knit.html",
    "https://emestudios.com/au/en/product/thrill",
    "https://www.instagram.com/reel/abc/",
    "https://www.dhgate.com/wholesale/sweater.html",
    "https://www.mercadolibre.com.ar/campera",
    "https://piccoclothing.com/",
    null,
  ])
    assert.equal(usStorePage(bad), false, String(bad));
});

test("rank: tops up with similar styles when there are few close matches; unpriced last", () => {
  const l = (
    store: string,
    price: number | null,
    score: number,
  ): Lookalike => ({
    title: store,
    store,
    price,
    url: `https://${store}.com/p`,
    image: "https://img.com/a.jpg",
    score,
  });
  assert.deepEqual(
    rank([
      l("Shein", null, 9),
      l("Walmart", 22, 5),
      l("Target", 30, 6),
      l("Amazon", 15, 4), // too different
    ]).map((i) => i.store),
    ["Shein", "Walmart", "Target"],
  );
});

test("buy: a Google Shopping link becomes the store's own product page", async () => {
  const { storeLink } =
    await import("../supabase/functions/_shared/lookalikes.ts");
  const item = {
    title: "Relaxed-Fit Polo Sweater",
    store: "H&M",
    price: 49.99,
    url: "https://www.google.com/search?ibp=oshop&q=x",
    image: "https://img.com/a.jpg",
  };
  const results = (links: string[]) =>
    (async () =>
      Response.json({
        organic: links.map((link) => ({ link })),
      })) as unknown as typeof fetch;
  assert.equal(
    await storeLink(
      "k",
      item,
      results([
        "https://poshmark.com/listing/HM-Relaxed-Polo", // name inside another domain
        "https://www2.hm.com/en_us/search-results.html", // H&M, but a search page
        "https://www2.hm.com/en_us/productpage.1368430001.html",
      ]),
    ),
    "https://www2.hm.com/en_us/productpage.1368430001.html",
  );
  assert.equal(
    await storeLink("k", item, results(["https://www.walmart.com/browse/x"])),
    item.url, // nothing on the store's own site: keep the Google link
  );
  const direct = { ...item, url: "https://us.shein.com/p-1.html" };
  assert.equal(await storeLink("k", direct, results([])), direct.url);
});

test("shop the look: closest first, then cheapest, then next closest, one per store", () => {
  const item = (store: string, price: number): Lookalike => ({
    title: store,
    store,
    price,
    url: "https://x.com/" + store,
    image: "https://x.com/i.jpg",
  });
  const got = pieceOptions([
    item("Nordstrom", 60),
    item("nordstrom.com", 20),
    item("H&M", 25),
    item("Walmart", 12),
    item("Target", 30),
  ]).map((i) => i.store);
  assert.deepEqual(got, ["Nordstrom", "Walmart", "H&M"]);
  assert.deepEqual(pieceOptions([]), []);
});
