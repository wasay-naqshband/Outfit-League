import { test } from "node:test";
import assert from "node:assert/strict";
import { notify } from "../supabase/functions/_shared/push.ts";

// A fake database: an hourly cap and two saved tokens.
function fakeDb(capped = false) {
  const deleted: string[][] = [];
  const db = {
    rpc: async () => ({ error: capped ? { message: "RATE_LIMIT" } : null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({
            data: [
              { token: "ExponentPushToken[a]" },
              { token: "ExponentPushToken[b]" },
            ],
          }),
        }),
      }),
      delete: () => ({
        in: async (_: string, t: string[]) => void deleted.push(t),
      }),
    }),
  };
  return { db, deleted };
}
const push = {
  title: "Your look is ready ✨",
  body: "Tap",
  url: "/generation/1",
  kind: "look_ready" as const,
};

test("push goes to every token and forgets uninstalled phones", async () => {
  const { db, deleted } = fakeDb();
  let sent: { to: string; data: unknown }[] = [];
  await notify(db, "owner", push, (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return Response.json({
      data: [
        { status: "ok" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
      ],
    });
  }) as unknown as typeof fetch);
  assert.deepEqual(
    sent.map((m) => m.to),
    ["ExponentPushToken[a]", "ExponentPushToken[b]"],
  );
  assert.deepEqual(sent[0]!.data, { url: "/generation/1", kind: "look_ready" });
  assert.deepEqual(deleted, [["ExponentPushToken[b]"]]);
});

test("push stays quiet over the hourly cap and never throws", async () => {
  const { db } = fakeDb(true);
  let called = false;
  await notify(
    db,
    "owner",
    push,
    (async () => (
      (called = true),
      Response.json({})
    )) as unknown as typeof fetch,
  );
  assert.equal(called, false);
  await notify(fakeDb().db, "owner", push, (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch);
});
