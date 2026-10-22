import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSourceUrl } from "../src/lib/source-url.ts";
import { redirectSystemPath } from "../app/+native-intent.ts";

test("source import accepts web links and rejects executable, credential-bearing or oversized URLs", () => {
  assert.equal(
    cleanSourceUrl("  https://example.com/look?q=red  "),
    "https://example.com/look?q=red",
  );
  assert.equal(cleanSourceUrl(""), null);
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private/photo.jpg",
    "https://name:secret@example.com/",
    "/relative/post",
    "https://example.com/" + "a".repeat(2050),
  ])
    assert.throws(() => cleanSourceUrl(value));
});

test("incoming native shares route to import while auth callback parameters remain intact", () => {
  assert.match(
    redirectSystemPath({ path: "outfitleague://expo-sharing", initial: true }),
    /^\/try-on\?shared=\d+$/,
  );
  const callback = "outfitleague://auth-callback?code=test&recovery=1";
  assert.equal(redirectSystemPath({ path: callback, initial: true }), callback);
  assert.equal(
    redirectSystemPath({ path: "/closet", initial: false }),
    "/closet",
  );
});
