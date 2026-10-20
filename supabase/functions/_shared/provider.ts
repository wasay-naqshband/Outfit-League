import {
  decodeResult,
  MAX_IMAGE_BYTES,
  toBase64,
  validateJpeg,
} from "./domain.ts";

export type Prediction = {
  state: "queued" | "processing" | "completed" | "failed";
  image?: string;
  error?: string;
};
export interface TryOnProvider {
  submit(person: string, garment: string): Promise<string>;
  status(id: string): Promise<Prediction>;
}

// No automatic submission retries: an uncertain POST may already cost a credit.
export class GenlookProvider implements TryOnProvider {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
    private normalize: (bytes: Uint8Array) => Promise<Uint8Array> = async (
      bytes,
    ) => {
      validateJpeg(bytes);
      return bytes;
    },
  ) {}
  async submit(person: string, garment: string): Promise<string> {
    const form = new FormData();
    form.set(
      "data",
      JSON.stringify({
        products: [
          {
            title: "Uploaded clothing item",
            description:
              "Reproduce the clothing in the supplied garment photo, including its color, pattern and cut.",
            validForDays: 1,
            images: [{ source: { fileKey: "garment" } }],
          },
        ],
        person: { image: { source: { fileKey: "person" } } },
        output: { keepForDays: 1, aiLabel: true },
      }),
    );
    form.set(
      "person",
      new Blob([decodeResult(person) as BlobPart], { type: "image/jpeg" }),
      "person.jpg",
    );
    form.set(
      "garment",
      new Blob([decodeResult(garment) as BlobPart], { type: "image/jpeg" }),
      "garment.jpg",
    );
    const data = await responseJson(
      await this.request("https://api.genlook.app/tryon/v1/try-on", {
        method: "POST",
        headers: { "x-api-key": this.key },
        body: form,
        signal: AbortSignal.timeout(20000),
      }),
    );
    if (
      typeof data.generationId !== "string" ||
      !data.generationId ||
      data.generationId.length > 200
    )
      throw new Error("PROVIDER_UNAVAILABLE");
    return data.generationId;
  }
  async status(id: string): Promise<Prediction> {
    const data = await responseJson(
      await this.request(
        "https://api.genlook.app/tryon/v1/generations/" +
          encodeURIComponent(id),
        {
          headers: { "x-api-key": this.key },
          signal: AbortSignal.timeout(15000),
        },
      ),
    );
    if (data.status === "PENDING") return { state: "queued" };
    if (data.status === "PROCESSING") return { state: "processing" };
    if (data.status === "FAILED")
      return { state: "failed", error: "GENERATION_FAILED" };
    if (data.status !== "COMPLETED") throw new Error("PROVIDER_UNAVAILABLE");
    if (typeof data.resultImageUrl !== "string")
      throw new Error("INVALID_RESULT");
    const url = new URL(data.resultImageUrl);
    // Only the documented result host. Never forward our API key to a CDN,
    // follow redirects, or fetch arbitrary URLs returned by an upstream service.
    if (
      url.protocol !== "https:" ||
      url.hostname !== "storage.googleapis.com" ||
      url.port ||
      url.username ||
      url.password
    )
      throw new Error("INVALID_RESULT");
    const response = await this.request(url.href, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("INVALID_RESULT");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_IMAGE_BYTES) throw new Error("INVALID_RESULT");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const jpeg = await this.normalize(bytes);
    validateJpeg(jpeg);
    return {
      state: "completed",
      image: "data:image/jpeg;base64," + toBase64(jpeg),
    };
  }
}
async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_UNAVAILABLE",
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("PROVIDER_UNAVAILABLE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12 * 1024 * 1024) throw new Error("INVALID_RESULT");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export class FashnProvider implements TryOnProvider {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
  ) {}
  async submit(person: string, garment: string): Promise<string> {
    const response = await this.request("https://api.fashn.ai/v1/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.key,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model_name: "tryon-v1.6",
        inputs: {
          model_image: person,
          garment_image: garment,
          category: "tops",
          garment_photo_type: "auto",
          mode: "balanced",
          num_samples: 1,
          output_format: "jpeg",
          return_base64: true,
          moderation_level: "conservative",
        },
      }),
    });
    const data = await responseJson(response);
    if (typeof data.id !== "string" || data.error)
      throw new Error("PROVIDER_UNAVAILABLE");
    return data.id;
  }
  async status(id: string): Promise<Prediction> {
    const response = await this.request(
      "https://api.fashn.ai/v1/status/" + encodeURIComponent(id),
      {
        headers: { Authorization: "Bearer " + this.key },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await responseJson(response);
    switch (data.status) {
      case "starting":
      case "in_queue":
        return { state: "queued" };
      case "processing":
        return { state: "processing" };
      case "completed": {
        const image = Array.isArray(data.output) ? data.output[0] : null;
        if (typeof image !== "string") throw new Error("INVALID_RESULT");
        return { state: "completed", image };
      }
      case "failed":
        return { state: "failed", error: "GENERATION_FAILED" };
      default:
        throw new Error("PROVIDER_UNAVAILABLE");
    }
  }
}
