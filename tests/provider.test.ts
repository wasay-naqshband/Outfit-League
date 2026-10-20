import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FashnProvider,
  GenlookProvider,
} from "../supabase/functions/_shared/provider.ts";
import {
  decodeResult,
  toBase64,
  validateJpeg,
  readRequestJson,
} from "../supabase/functions/_shared/domain.ts";
test("control endpoints reject oversized and non-object request bodies", async () => {
  assert.deepEqual(
    await readRequestJson(
      new Request("http://local", {
        method: "POST",
        body: '{"action":"config"}',
      }),
    ),
    { action: "config" },
  );
  await assert.rejects(
    readRequestJson(
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({ data: "a".repeat(17000) }),
      }),
    ),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    readRequestJson(
      new Request("http://local", { method: "POST", body: "null" }),
    ),
    /INVALID_REQUEST/,
  );
});

// A bounded JPEG header is enough to test our metadata guard; provider fixtures
// are simulated responses and are never represented as generated user photos.
const jpeg = Uint8Array.from([
  255, 216, 255, 192, 0, 11, 8, 1, 0, 1, 0, 1, 1, 17, 0, 255, 217,
]);
test("JPEG guard rejects disguised files, tiny images, and malformed bytes", () => {
  assert.deepEqual(validateJpeg(jpeg), { width: 256, height: 256 });
  assert.throws(() =>
    validateJpeg(new TextEncoder().encode("<svg>not a jpeg</svg>")),
  );
  const tiny = jpeg.slice();
  tiny[7] = 0;
  tiny[8] = 1;
  assert.throws(() => validateJpeg(tiny), /IMAGE_DIMENSIONS/);
  assert.throws(
    () => decodeResult("https://cdn.example.com/photo.jpg"),
    /INVALID_RESULT/,
  );
  assert.deepEqual(
    decodeResult("data:image/jpeg;base64," + toBase64(jpeg)),
    jpeg,
  );
});
test("provider submits only a single upper-body output with private base64 delivery", async () => {
  let calls = 0;
  const request = async (url: RequestInfo | URL, options?: RequestInit) => {
    calls++;
    assert.equal(url, "https://api.fashn.ai/v1/run");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model_name, "tryon-v1.6");
    assert.equal(body.inputs.category, "tops");
    assert.equal(body.inputs.num_samples, 1);
    assert.equal(body.inputs.return_base64, true);
    assert.equal(body.inputs.moderation_level, "conservative");
    return Response.json({ id: "prediction-1", error: null });
  };
  assert.equal(
    await new FashnProvider("test-key", request as typeof fetch).submit(
      "person",
      "garment",
    ),
    "prediction-1",
  );
  assert.equal(calls, 1);
});
test("provider maps all async states and never fabricates a result", async () => {
  for (const [input, expected] of [
    ["starting", "queued"],
    ["in_queue", "queued"],
    ["processing", "processing"],
    ["failed", "failed"],
  ] as const) {
    const adapter = new FashnProvider(
      "test",
      async () => Response.json({ status: input }) as never,
    );
    assert.equal((await adapter.status("id")).state, expected);
  }
  const complete = new FashnProvider(
    "test",
    async () =>
      Response.json({
        status: "completed",
        output: ["data:image/jpeg;base64," + toBase64(jpeg)],
      }) as never,
  );
  assert.equal((await complete.status("id")).state, "completed");
  const missing = new FashnProvider(
    "test",
    async () => Response.json({ status: "completed", output: [] }) as never,
  );
  await assert.rejects(missing.status("id"), /INVALID_RESULT/);
});
test("provider errors do not leak credentials or raw error payloads", async () => {
  const adapter = new FashnProvider(
    "secret",
    async () => new Response("private diagnostic", { status: 401 }) as never,
  );
  await assert.rejects(
    adapter.submit("person", "garment"),
    /^Error: PROVIDER_UNAVAILABLE$/,
  );
});

test("Genlook sends private multipart inputs once with short retention and an AI label", async () => {
  let calls = 0;
  const adapter = new GenlookProvider("test-key", (async (url, options) => {
    calls++;
    assert.equal(url, "https://api.genlook.app/tryon/v1/try-on");
    assert.equal(
      (options?.headers as Record<string, string>)["x-api-key"],
      "test-key",
    );
    const form = options?.body as FormData;
    const body = JSON.parse(String(form.get("data")));
    assert.equal(body.output.keepForDays, 1);
    assert.equal(body.output.aiLabel, true);
    assert.equal(body.products[0].validForDays, 1);
    assert.equal(body.products[0].images[0].source.fileKey, "garment");
    assert.equal(body.person.image.source.fileKey, "person");
    assert.deepEqual(
      new Uint8Array(await (form.get("person") as Blob).arrayBuffer()),
      jpeg,
    );
    return Response.json({ generationId: "generation-1", status: "PENDING" });
  }) as typeof fetch);
  const photo = "data:image/jpeg;base64," + toBase64(jpeg);
  assert.equal(await adapter.submit(photo, photo), "generation-1");
  assert.equal(calls, 1);
});

test("Genlook handles states and copies a bounded CDN image without forwarding credentials", async () => {
  for (const [status, state] of [
    ["PENDING", "queued"],
    ["PROCESSING", "processing"],
    ["FAILED", "failed"],
  ]) {
    const adapter = new GenlookProvider("secret", (async () =>
      Response.json({ status })) as typeof fetch);
    assert.equal((await adapter.status("id")).state, state);
  }
  let calls = 0;
  const adapter = new GenlookProvider("secret", (async (url, options) => {
    calls++;
    if (calls === 1)
      return Response.json({
        status: "COMPLETED",
        resultImageUrl: "https://storage.googleapis.com/test/result.jpg",
      });
    assert.equal(url, "https://storage.googleapis.com/test/result.jpg");
    assert.equal(options?.headers, undefined);
    assert.equal(options?.redirect, "error");
    return new Response(jpeg);
  }) as typeof fetch);
  assert.deepEqual(decodeResult((await adapter.status("id")).image!), jpeg);
  assert.equal(calls, 2);
});

test("Genlook rejects private-network URLs, redirects, missing images and oversized results", async () => {
  for (const url of [
    "http://127.0.0.1/private",
    "https://evil.example/photo.jpg",
    "https://storage.googleapis.com.evil.example/a",
    "https://user:pass@storage.googleapis.com/a",
  ]) {
    let calls = 0;
    const adapter = new GenlookProvider("secret", (async () => {
      calls++;
      return Response.json({ status: "COMPLETED", resultImageUrl: url });
    }) as typeof fetch);
    await assert.rejects(adapter.status("id"), /INVALID_RESULT/);
    assert.equal(calls, 1);
  }
  const missing = new GenlookProvider("secret", (async () =>
    Response.json({ status: "COMPLETED" })) as typeof fetch);
  await assert.rejects(missing.status("id"), /INVALID_RESULT/);
  let calls = 0;
  const huge = new GenlookProvider("secret", (async () =>
    ++calls === 1
      ? Response.json({
          status: "COMPLETED",
          resultImageUrl: "https://storage.googleapis.com/test/a",
        })
      : new Response(new Uint8Array(8 * 1024 * 1024 + 1))) as typeof fetch);
  await assert.rejects(huge.status("id"), /INVALID_RESULT/);
});

test("Genlook exhausted credits do not retry or expose upstream diagnostics", async () => {
  let calls = 0;
  const adapter = new GenlookProvider("secret", (async () => {
    calls++;
    return new Response("private account information", { status: 402 });
  }) as typeof fetch);
  const photo = "data:image/jpeg;base64," + toBase64(jpeg);
  await assert.rejects(
    adapter.submit(photo, photo),
    /^Error: PROVIDER_UNAVAILABLE$/,
  );
  assert.equal(calls, 1);
});
