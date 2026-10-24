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

test("360° view: studio still first, then a 1080p spin that starts and ends on it", async () => {
  const { generateSpinVideo } =
    await import("../supabase/functions/_shared/spin.ts");
  const look = "data:image/jpeg;base64,AAAA";
  const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 1, 2]);
  const seen: string[] = [];
  const video = await generateSpinVideo("k", look, (async (
    url: string,
    options: RequestInit,
  ) => {
    seen.push(url);
    const body = JSON.parse(String(options.body));
    if (url.includes("gemini-3-pro-image"))
      return Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { data: "STILL" } }] } },
        ],
      });
    assert.deepEqual(
      body.input.slice(0, 2).map((p: { data: string }) => p.data),
      ["STILL", "STILL"],
    );
    assert.equal(body.response_format.resolution, "1080p");
    return Response.json({
      steps: [
        {
          type: "model_output",
          content: [
            {
              type: "video",
              mime_type: "video/mp4",
              data: btoa(String.fromCharCode(...mp4)),
            },
          ],
        },
      ],
    });
  }) as typeof fetch);
  assert.deepEqual(video, mp4);
  assert.equal(seen.length, 2);
});

test("OpenAI try-on sends the person first, then the garment, to the Flare edit endpoint", async () => {
  const { openAiTryOn } =
    await import("../supabase/functions/_shared/provider.ts");
  const jpeg = new Uint8Array(await readFile("tests/fixtures/sample.jpg"));
  const photo = "data:image/jpeg;base64," + toBase64(jpeg);
  const image = await openAiTryOn("k", photo, [photo], (async (
    url: string,
    options: RequestInit,
  ) => {
    assert.equal(url, "https://api.openai.com/v1/images/edits");
    const form = options.body as FormData;
    assert.equal(form.get("model"), "gpt-image-2.5-flare");
    const images = form.getAll("image[]") as File[];
    assert.deepEqual(
      images.map((f) => f.name),
      ["person.jpg", "garment-1.jpg"],
    );
    return Response.json({ data: [{ b64_json: toBase64(jpeg) }] });
  }) as typeof fetch);
  assert.deepEqual(image, jpeg);
});
