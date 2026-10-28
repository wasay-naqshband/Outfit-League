import test from "node:test";
import assert from "node:assert/strict";
import { forDepartment } from "../supabase/functions/_shared/stylist.ts";

test("shop queries name the wearer's department only", () => {
  assert.equal(
    forDepartment("black wide leg pants", "men"),
    "men's black wide leg pants",
  );
  assert.equal(
    forDepartment("women's velvet crop top", "men"),
    "men's velvet crop top",
  );
  assert.equal(
    forDepartment("men's denim jacket", "women"),
    "women's denim jacket",
  );
  assert.equal(forDepartment("women's boots", "women"), "women's boots");
  assert.equal(forDepartment("white sneakers", null), "white sneakers");
});

test("shop rails drop products made for the other department", async () => {
  const { forShopper } =
    await import("../supabase/functions/_shared/lookalikes.ts");
  const item = (title: string) => ({
    title,
    store: "x",
    price: 1,
    url: "https://x.com",
    image: "https://x.com/i.jpg",
  });
  const items = [
    item("H&M Men's Lightweight Bomber Jacket"),
    item("Womens Princess Polly Jaxton Faux Leather Jacket"),
    item("Woman Zara Trf High-Rise Extra Wide-Leg Jeans"),
    item("Unisex Raglan Tee"),
  ];
  assert.deepEqual(
    forShopper(items, "men").map((i) => i.title),
    ["H&M Men's Lightweight Bomber Jacket", "Unisex Raglan Tee"],
  );
  assert.equal(forShopper(items, "women").length, 3);
  assert.equal(forShopper(items, null).length, 4);
});
