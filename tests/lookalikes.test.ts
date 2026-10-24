import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchLookalikes,
  usd,
} from "../supabase/functions/_shared/lookalikes.ts";

test("prices: dollars parse, junk is refused", () => {
  assert.equal(usd("$49.99"), 49.99);
  assert.equal(usd("$1,249.00 now"), 1249);
  assert.equal(usd("39"), 39);
  for (const bad of ["", "Free", "$0", null, 12]) assert.equal(usd(bad), null);
});

test("lookalikes: US shopping search, cleaned, one per store, cheapest first", async () => {
  let body: Record<string, unknown> = {};
  const item = (store: string, price: string, link = "https://shop.com/p") => ({
    title: `${store} zip knit`,
    source: store,
    price,
    link,
    imageUrl: "https://img.com/a.jpg",
  });
  const items = await searchLookalikes("k", "grey zip knit", (async (
    _url: string,
    options: RequestInit,
  ) => {
    body = JSON.parse(String(options.body));
    return Response.json({
      shopping: [
        item("H&M", "$49.99"),
        item("Target", "$39.59"),
        item("Target", "$12.00"), // cheaper item from the same store wins
        item("Shady", "$5.00", "http://insecure.com/p"), // not https: dropped
        item("NoPrice", "Free"), // no price: dropped
        item("PacSun", "$36.39"),
      ],
    });
  }) as typeof fetch);
  assert.equal(body.gl, "us");
  assert.deepEqual(
    items.map((i) => [i.store, i.price]),
    [
      ["Target", 12],
      ["PacSun", 36.39],
      ["H&M", 49.99],
    ],
  );
});
