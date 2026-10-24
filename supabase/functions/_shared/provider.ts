import { MAX_IMAGE_BYTES } from "./domain.ts";

export type Prediction = {
  state: "queued" | "processing" | "completed" | "failed";
  image?: string;
  error?: string;
};
export interface TryOnProvider {
  submit(person: string, garment: string): Promise<string>;
  status(id: string): Promise<Prediction>;
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

// Google Gemini image editing: the person photo is edited in place, so face,
// pose, background and the rest of the outfit stay as they were. One
// synchronous call (~25 s, about $0.13 at 2K). No retries: a repeat costs twice.
export const GEMINI_TRYON_MODEL = "gemini-3-pro-image";
const TRYON_PROMPT =
  "Virtual try-on. The first image is a real photo of a person. The following image(s) show clothing items. " +
  "Edit the first image so the person wears the clothing item(s), replacing only the garment each item would cover. " +
  "Reproduce each item exactly: colour, fabric, texture, collar, pockets, stitching, logos, and the same fastenings " +
  "(buttons, snaps or zips only where the item has them). Fit and drape it naturally on their body and pose. " +
  "Keep everything else identical to the first image: the face and facial features, expression, hair, skin tone, " +
  "body shape, pose, hands, background, lighting and camera framing. " +
  "Every piece of clothing the items do not replace must stay exactly as it is, with the same colour, length and style: " +
  "a jacket or top never changes the trousers, shalwar, skirt or shoes, and a long shirt or kurta keeps its full length and hem. " +
  "Do not beautify, restyle, crop or change the person. Photorealistic, sharp, high detail.";
export async function geminiTryOn(
  key: string,
  person: string,
  garments: string[],
  request: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await request(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRYON_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              // Inputs are validated JPEG data URIs from private storage.
              ...[person, ...garments].map((uri) => ({
                inline_data: { mime_type: "image/jpeg", data: uri.slice(23) },
              })),
              { text: TRYON_PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { imageSize: "2K" },
        },
      }),
    },
  );
  const data = await responseJson(response);
  const parts = (
    data.candidates as
      { content?: { parts?: Record<string, unknown>[] } }[] | undefined
  )?.[0]?.content?.parts;
  const image = parts
    ?.map(
      (part) =>
        (part.inlineData ?? part.inline_data) as { data?: unknown } | undefined,
    )
    .find((inline) => typeof inline?.data === "string");
  // No image back means the model declined (e.g. safety) or failed.
  if (!image || (image.data as string).length > MAX_IMAGE_BYTES * 1.4)
    throw new Error("GENERATION_FAILED");
  return Uint8Array.from(atob(image.data as string), (c) => c.charCodeAt(0));
}
