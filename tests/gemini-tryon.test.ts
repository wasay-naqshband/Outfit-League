import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { geminiTryOn } from "../supabase/functions/_shared/provider.ts";
import { toBase64 } from "../supabase/functions/_shared/domain.ts";

test("Gemini try-on sends the person first, then every garment, and returns the image", async () => {
  const jpeg = new Uint8Array(await readFile("tests/fixtures/sample.jpg"));
  const photo = "data:image/jpeg;base64," + toBase64(jpeg);
  let calls = 0;
  const image = await geminiTryOn("k", photo, [photo, photo], (async (
    url: string,
    options: RequestInit,
  ) => {
    calls++;
    assert.match(url, /gemini-3-pro-image:generateContent$/);
    const body = JSON.parse(String(options.body));
    const parts = body.contents[0].parts;
    assert.equal(parts.length, 4); // person + 2 garments + prompt
    assert.equal(parts[0].inline_data.data, photo.slice(23));
    assert.equal(body.generationConfig.imageConfig.imageSize, "2K");
    return Response.json({
      candidates: [
        { content: { parts: [{ inlineData: { data: toBase64(jpeg) } }] } },
      ],
    });
  }) as typeof fetch);
  assert.deepEqual(image, jpeg);
  assert.equal(calls, 1);
});

test("Gemini try-on fails cleanly on refusals and rate limits, without retrying", async () => {
  const photo = "data:image/jpeg;base64,AAAA";
  await assert.rejects(
    geminiTryOn("k", photo, [photo], (async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "no" }] } }],
      })) as typeof fetch),
    /GENERATION_FAILED/,
  );
  let calls = 0;
  await assert.rejects(
    geminiTryOn("k", photo, [photo], (async () => {
      calls++;
      return new Response("busy", { status: 429 });
    }) as typeof fetch),
    /PROVIDER_BUSY/,
  );
  assert.equal(calls, 1);
});
