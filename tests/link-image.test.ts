import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPublicAsset } from "../supabase/functions/_shared/link-image.ts";

const publicDns = async (_host: string, type: "A" | "AAAA") =>
  type === "A" ? ["93.184.216.34"] : [];

test("server-side image fetch rejects private DNS results before connecting", async () => {
  let requested = false;
  await assert.rejects(
    fetchPublicAsset(
      "https://images.example.com/item.jpg",
      100,
      (async () => {
        requested = true;
        return new Response("no");
      }) as typeof fetch,
      async () => ["10.0.0.8"],
    ),
  );
  assert.equal(requested, false);
});

test("server-side image fetch rechecks every redirect destination", async () => {
  let requests = 0;
  await assert.rejects(
    fetchPublicAsset(
      "https://images.example.com/item.jpg",
      100,
      (async () => {
        requests += 1;
        return new Response(null, {
          status: 302,
          headers: { location: "https://redirect.example.com/item.jpg" },
        });
      }) as typeof fetch,
      async (host, type) =>
        type === "AAAA"
          ? []
          : host === "images.example.com"
            ? ["93.184.216.34"]
            : ["127.0.0.1"],
    ),
  );
  assert.equal(requests, 1);
});

test("server-side image fetch stops reading once the byte cap is exceeded", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    fetchPublicAsset(
      "https://images.example.com/item.jpg",
      10,
      (async () =>
        new Response(body, {
          headers: { "content-type": "image/jpeg" },
        })) as typeof fetch,
      publicDns,
    ),
  );
  assert.equal(cancelled, true);
});

test("server-side image fetch accepts bounded HTTPS images on public hosts", async () => {
  const asset = await fetchPublicAsset(
    "https://images.example.com/item.jpg",
    10,
    (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      })) as typeof fetch,
    publicDns,
  );
  assert.equal(asset.type, "image/jpeg");
  assert.deepEqual([...asset.data], [1, 2, 3]);
});

test("server-side image fetch rejects HTTP destinations", async () => {
  await assert.rejects(
    fetchPublicAsset(
      "http://images.example.com/item.jpg",
      10,
      (async () => new Response("no")) as typeof fetch,
      publicDns,
    ),
  );
});
