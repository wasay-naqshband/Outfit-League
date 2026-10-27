import { test } from "node:test";
import assert from "node:assert/strict";
import { trustedClientIp } from "../src/lib/trusted-client-ip.ts";

test("trusted client IP ignores caller-supplied X-Forwarded-For", () => {
  assert.equal(
    trustedClientIp(
      new Headers({
        "x-forwarded-for": "198.51.100.5",
        "x-real-ip": "198.51.100.6",
      }),
    ),
    null,
  );
});

test("trusted client IP normalizes valid IPv4 and accepts IPv6", () => {
  assert.equal(
    trustedClientIp(new Headers({ "cf-connecting-ip": "192.0.2.8" })),
    "192.0.2.8",
  );
  assert.equal(
    trustedClientIp(new Headers({ "cf-connecting-ip": "2001:DB8::1" })),
    "2001:db8::1",
  );
});

test("trusted client IP rejects malformed and list-valued header input", () => {
  for (const value of [
    "999.1.1.1",
    "1.2.3.4, 5.6.7.8",
    "not-an-ip",
    "fe80::1%eth0",
  ])
    assert.equal(
      trustedClientIp(new Headers({ "cf-connecting-ip": value })),
      null,
    );
});
