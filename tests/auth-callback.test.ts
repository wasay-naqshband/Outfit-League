import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAuthCallback } from "../src/lib/auth-callback.ts";

test("auth callback reads PKCE code and recovery marker from query", () => {
  assert.deepEqual(
    parseAuthCallback(
      "https://chutni.store/auth-callback?code=single-use&recovery=1&next=account",
      {},
    ),
    { code: "single-use", recovery: true, next: "account" },
  );
});

test("auth callback ignores session tokens in URL fragments", () => {
  assert.deepEqual(
    parseAuthCallback(
      "outfitleague://auth-callback#access_token=attacker&refresh_token=attacker&type=recovery",
      {},
    ),
    { code: null, recovery: true, next: null },
  );
});

test("router PKCE parameters take precedence over URL parsing", () => {
  assert.deepEqual(
    parseAuthCallback("https://chutni.store/auth-callback", {
      code: "router-code",
      recovery: "1",
      next: "account",
    }),
    { code: "router-code", recovery: true, next: "account" },
  );
});
