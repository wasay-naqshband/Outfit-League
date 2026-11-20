import { test } from "node:test";
import assert from "node:assert/strict";
import { productDetails, productPrice } from "../src/lib/product-detail";

test("product details only expose supported prefixed tags", () => {
  assert.deepEqual(
    productDetails(
      "26fa internal tag color_brown fabric_italian-textured-flannel silhouette_mini-belfast",
      "Y2K",
    ),
    {
      fabric: "Italian textured flannel",
      cut: "Mini Belfast",
      color: "Brown",
      style: "Y2K",
    },
  );
  assert.deepEqual(productDetails("26fa category_jackets", ""), {
    fabric: undefined,
    cut: undefined,
    color: undefined,
    style: "",
  });
  assert.equal(
    productDetails("color_navy,color_white fabric_cotton", "Casual").color,
    "Navy",
  );
});

test("product price preserves currency and cents, without inventing missing prices", () => {
  assert.equal(productPrice("USD 378.00")?.sticker, "$378");
  assert.equal(productPrice("USD 378.50")?.sticker, "$378.50");
  assert.equal(productPrice("USD 1,200.00")?.store, "USD 1,200.00");
  assert.equal(productPrice("GBP 120.00")?.sticker, "GBP 120");
  assert.equal(productPrice("PKR 5,490")?.currency, "PKR");
  for (const price of [
    "",
    "See price",
    "Sample",
    "$0",
    "USD -1",
    "USD 1,2",
    "USD 20–40",
  ])
    assert.equal(productPrice(price), null);
});
