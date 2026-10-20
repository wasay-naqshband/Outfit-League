import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalytics, type SafeEvent } from "../src/lib/analytics";
test("analytics strips arbitrary fields and rejects non-enum values", () => {
  const events: SafeEvent[] = [];
  const tracker = createAnalytics((event) => {
    events.push(event);
  });
  tracker.track("product_clicked", {
    link: "retailer",
    email: "private@example.com",
    image: "signed-url",
  } as any);
  tracker.track("product_clicked", { link: "https://private-image" } as any);
  assert.deepEqual(events, [
    { name: "product_clicked", properties: { link: "retailer" } },
  ]);
});
test("analytics defaults off, deduplicates in memory and isolates provider failures", async () => {
  assert.equal(createAnalytics().enabled, false);
  let count = 0;
  const tracker = createAnalytics(() => {
    count++;
    throw new Error("provider down");
  });
  tracker.track("try_on_completed", { mode: "live" }, "local-only-job-key");
  tracker.track("try_on_completed", { mode: "live" }, "local-only-job-key");
  assert.equal(count, 1);
  tracker.reset();
  tracker.track("try_on_completed", { mode: "live" }, "local-only-job-key");
  assert.equal(count, 2);
  const asyncFailure = createAnalytics(async () => {
    throw new Error("offline");
  });
  asyncFailure.track("paywall_viewed", { screen: "credit_packs" });
  await new Promise((resolve) => setImmediate(resolve));
});
