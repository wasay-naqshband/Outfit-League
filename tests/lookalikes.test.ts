import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pieceOptions,
  rank,
  usStorePage,
  shopping,
  usd,
  verifiedOffers,
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

test("shop the look: every option opens the store's own page", async () => {
  const { directOptions } =
    await import("../supabase/functions/_shared/lookalikes.ts");
  const g = (store: string, price: number): Lookalike => ({
    title: store + " pants",
    store,
    price,
    url: "https://www.google.com/search?ibp=oshop&q=" + store,
    image: "https://x.com/i.jpg",
  });
  const pages: Record<string, string> = {
    "Zara USA": "https://www.zara.com/us/en/pants-p1.html",
    Walmart: "https://www.walmart.com/ip/pants/123",
    "H&M": "https://www2.hm.com/en_us/productpage.1.html",
  };
  const request = (async (_: string, init: RequestInit) => {
    const q = JSON.parse(String(init.body)).q as string;
    const store = Object.keys(pages).find((s) => q.endsWith(s));
    return Response.json({ organic: store ? [{ link: pages[store] }] : [] });
  }) as unknown as typeof fetch;
  const got = await directOptions(
    "k",
    [g("Zara USA", 99), g("Tiny Shop", 10), g("Walmart", 65), g("H&M", 50)],
    request,
  );
  assert.deepEqual(
    got.map((i) => i.url),
    [pages["Zara USA"], pages["H&M"], pages.Walmart],
  ); // "Tiny Shop" had no store page, so it is dropped
});

test("Try On keeps priced product pages and drops duplicate images and links", async () => {
  const offer = (
    url: string,
    image = "https://img.com/sweater.jpg",
  ): Lookalike => ({
    title: "Dark brown ribbed turtleneck sweater",
    store: "ASOS",
    price: 49,
    url,
    image,
  });
  const asos = offer("https://www.asos.com/brand/sweater/prd/123");
  const hm = offer(
    "https://www2.hm.com/en_us/productpage.123.html",
    "https://img.com/hm.jpg",
  );
  const got = await verifiedOffers("key", [
    offer("https://www.framer.com/@dainel"),
    offer("https://www.piclumen.com/products/ai-photography"),
    offer("https://www.pinterest.com/p/123"),
    offer("https://www.asos.com/search/?q=sweater"),
    { ...asos, price: null },
    asos,
    offer(asos.url + "?tracking=1", "https://img.com/different.jpg"),
    offer("https://www.example.com/products/2", asos.image + "?w=300"),
    hm,
  ]);
  assert.deepEqual(got, [asos, hm]);
});

test("Try On resolves a Shopping redirect only to a merchant product page", async () => {
  const item: Lookalike = {
    title: "Ribbed turtleneck sweater",
    store: "ASOS",
    price: 49,
    url: "https://www.google.com/shopping/product/123",
    image: "https://img.com/sweater.jpg",
  };
  const product = "https://www.asos.com/brand/sweater/prd/123";
  const search =
    (...links: string[]): typeof fetch =>
    async () =>
      Response.json({ organic: links.map((link) => ({ link })) });
  const category = "https://www.asos.com/women/sweaters";
  assert.deepEqual(await verifiedOffers("key", [item], search(category)), []);
  assert.deepEqual(
    await verifiedOffers("key", [item], search(category, product)),
    [{ ...item, url: product }],
  );
});

test("Fit report extracts exact USD Product offers and rejects estimated or invalid prices", async () => {
  const { productPrice } =
    await import("../supabase/functions/_shared/lookalikes.ts");
  const schema = (value: unknown) =>
    '<script type="application/ld+json">' + JSON.stringify(value) + "</script>";
  const product = (
    price: unknown,
    currency = "USD",
    availability = "https://schema.org/InStock",
  ) => ({
    "@type": "Product",
    offers: { "@type": "Offer", price, priceCurrency: currency, availability },
  });
  assert.equal(productPrice(schema({ "@graph": [product("41.29")] })), 41.29);
  assert.equal(productPrice(schema(product(59.95))), 59.95);
  for (const value of [
    product(null),
    product(0),
    product(-3),
    product("Free"),
    product(41, "CAD"),
    product(41, "USD", "OutOfStock"),
    {
      "@type": "Product",
      offers: { lowPrice: 30, highPrice: 60, priceCurrency: "USD" },
    },
  ]) {
    assert.equal(productPrice(schema(value)), null);
  }
  assert.equal(
    productPrice("<html>Sign in for wholesale pricing</html>"),
    null,
  );
  assert.equal(
    productPrice(
      '<script type="application/ld+json">bad</script>' +
        schema(product("42.50")),
    ),
    42.5,
  );
});

test("Fit report excludes wholesale, login redirects, broken pages and unpriced listings", async () => {
  const { retailOffers, shoppingProductPage } =
    await import("../supabase/functions/_shared/lookalikes.ts");
  assert.equal(
    shoppingProductPage("https://www.faire.com/products/hoodie"),
    false,
  );
  assert.equal(
    shoppingProductPage("https://shop.com:8443/products/hoodie"),
    false,
  );
  assert.equal(
    shoppingProductPage("https://www.pacsun.com/arc/fleece-012345.html"),
    true,
  );
  const item = (host: string, price: number | null = 39): Lookalike => ({
    title: "Vintage heavyweight hoodie",
    store: host,
    price,
    url: "https://" + host + "/products/hoodie",
    image: "https://images.com/" + host + ".jpg",
  });
  const requests: string[] = [];
  const request = (async (input: string) => {
    requests.push(input);
    if (input.includes("broken.com")) return new Response("", { status: 404 });
    if (input.includes("redirect.com"))
      return new Response("", {
        status: 302,
        headers: { Location: "https://faire.com/products/hoodie" },
      });
    if (input.includes("faire.com"))
      return new Response("<html>Sign in to shop wholesale</html>", {
        headers: { "Content-Type": "text/html" },
      });
    return new Response(
      '<script type="application/ld+json">' +
        JSON.stringify({
          "@type": "Product",
          offers: { price: "41.29", priceCurrency: "USD" },
        }) +
        "</script>",
      { headers: { "Content-Type": "text/html" } },
    );
  }) as typeof fetch;
  const resolve = async (_host: string, type: "A" | "AAAA") =>
    type === "A" ? ["93.184.216.34"] : [];
  const got = await retailOffers(
    "key",
    [
      item("faire.com"),
      item("noprice.com", null),
      item("broken.com"),
      item("redirect.com"),
      item("joesusa.com"),
    ],
    request,
    resolve,
  );
  assert.deepEqual(got, [{ ...item("joesusa.com"), price: 41.29 }]);
  assert.ok(!requests.some((url) => url.includes("noprice.com")));
});
