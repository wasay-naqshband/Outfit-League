import { decodeResult } from "./domain.ts";

export const SPIN_ANGLES = 4; // front, left, back, right — left to right in one image

const PROMPT =
  "Image 1 is a person wearing an outfit. Image 2 is the exact garment they wear. " +
  "Create a fashion turnaround sheet: ONE image with FOUR full-body views of the SAME person side by side, " +
  "evenly spaced in four equal columns, same scale and height, from left to right: front view, left side profile, back view, right side profile. " +
  "Keep the identical face, hair, skin tone and build in every view; arms relaxed; standing straight; no phone. " +
  "Reproduce the garment from image 2 exactly — colors, prints, collar, zip, pockets and cut, with any text reading correctly — " +
  "and keep the rest of the outfit identical in all four views. Invent a plausible back of the garment in the same fabric and color. " +
  "Plain light grey studio background, soft even lighting, photorealistic. No labels, captions or watermarks.";

// One synchronous call (~20–30 s). No retries: a repeated call may cost twice.
export async function generateSheet(
  key: string,
  person: string,
  garment: string,
  request: typeof fetch = fetch,
): Promise<Uint8Array> {
  // Inputs are validated JPEG data URIs from private storage.
  const image = (uri: string) => ({
    inline_data: { mime_type: "image/jpeg", data: uri.slice(23) },
  });
  const response = await request(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        contents: [
          { parts: [image(person), image(garment), { text: PROMPT }] },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_UNAVAILABLE",
    );
  const data = await response.json();
  const part = data?.candidates?.[0]?.content?.parts?.find(
    (p: Record<string, unknown>) => p.inlineData || p.inline_data,
  );
  const inline = part?.inlineData ?? part?.inline_data;
  if (typeof inline?.data !== "string") throw new Error("GENERATION_FAILED");
  return decodeResult("data:image/jpeg;base64," + inline.data);
}
