import { test } from "node:test";
import assert from "node:assert/strict";
import { battleImage, battlePreview } from "../src/lib/battle-preview.ts";

const id = "24743d15-8235-4a89-8857-dad778265ea5";

test("social metadata uses revocable app-origin image URLs", async () => {
  const request = new Request(`https://chutni.store/battle/${id}`, {
    headers: { "user-agent": "WhatsApp" },
  });
  const response = await battlePreview(
    request,
    async () => new Response("fallback"),
    (async () =>
      Response.json({
        title: "Date night",
        kind: "choose",
        sides: ["a", "b"],
      })) as typeof fetch,
  );
  const html = await response.text();
  assert.match(
    html,
    new RegExp(
      `og:image" content="https://chutni\\.store/battle/${id}/image/a`,
    ),
  );
  assert.match(
    html,
    new RegExp(
      `twitter:image" content="https://chutni\\.store/battle/${id}/image/a`,
    ),
  );
  assert.doesNotMatch(html, /supabase\.co\/storage\/v1\/object\/sign/);
});

test("preview image proxy requests a publication-checked image and caches briefly", async () => {
  let payload: Record<string, unknown> | undefined;
  const response = await battleImage(
    new Request(`https://chutni.store/battle/${id}/image/a`),
    id,
    "a",
    (async (_input, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(new Uint8Array([255, 216, 255]), {
        headers: { "content-type": "image/jpeg" },
      });
    }) as typeof fetch,
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=300, s-maxage=300",
  );
  assert.equal(payload?.action, "share-image");
  assert.equal(payload?.side, "a");
});

test("preview image proxy rejects invalid sides and unavailable unpublished images", async () => {
  assert.equal(
    (await battleImage(new Request("https://chutni.store"), id, "z")).status,
    404,
  );
  const response = await battleImage(
    new Request("https://chutni.store"),
    id,
    "a",
    (async () => new Response("Not found", { status: 404 })) as typeof fetch,
  );
  assert.equal(response.status, 404);
});
