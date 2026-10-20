import { test } from "node:test";
import assert from "node:assert/strict";
import { createSecureStorage } from "../src/lib/secure-storage.ts";
function fixture() {
  const items = new Map<string, string>();
  const raw = {
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      assert.ok(value.length <= 1500);
      items.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      items.delete(key);
    },
  };
  return { items, raw, storage: createSecureStorage(raw) };
}
test("large sessions round-trip through bounded secure chunks and sign-out removes them", async () => {
  const { items, storage } = fixture(),
    session = JSON.stringify({ token: "abc".repeat(4000) });
  await storage.setItem("session", session);
  assert.equal(await storage.getItem("session"), session);
  await storage.setItem("session", "next-token");
  assert.equal(await storage.getItem("session"), "next-token");
  assert.equal(items.size, 2);
  await storage.removeItem("session");
  assert.equal(items.size, 0);
});
test("a partially missing session fails closed; legacy sessions still load", async () => {
  const { items, storage } = fixture();
  items.set("session", "legacy");
  assert.equal(await storage.getItem("session"), "legacy");
  await storage.setItem("session", "a".repeat(4000));
  const chunk = [...items.keys()].find((key) => key.endsWith(".1"))!;
  items.delete(chunk);
  assert.equal(await storage.getItem("session"), null);
});
