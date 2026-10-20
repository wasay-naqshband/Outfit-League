import { test } from "node:test";
import assert from "node:assert/strict";
import {
  creditActivity,
  UnavailableStoreAdapter,
} from "../src/lib/credits-domain";
test("credit activity explains reservation completion without a second charge", () => {
  assert.equal(creditActivity("reserve").badge, "Reserved 1");
  assert.equal(creditActivity("consume").badge, "Used 1");
  assert.match(creditActivity("consume").detail, /No additional credit/);
  assert.equal(creditActivity("refund").badge, "+1");
  assert.equal(creditActivity("grant").badge, "+3");
});
test("unconfigured purchase adapter fails closed for purchases and restoration", async () => {
  const store = new UnavailableStoreAdapter();
  assert.equal((await store.availability()).available, false);
  await assert.rejects(store.purchase("anything"), /PURCHASES_UNAVAILABLE/);
  await assert.rejects(store.restore(), /PURCHASES_UNAVAILABLE/);
});
