import { MAX_IMAGE_BYTES } from "./domain.ts";

// The clip opens on the studio still itself, so the viewer starts at 0.
export const SPIN_START = 0;

const STUDIO_PROMPT =
  "Turn this photo into a clean full-length fashion studio photo of the exact same person in the exact same outfit. " +
  "Full body from head to shoes, standing straight and relaxed, facing the camera, arms by their sides, centred, with space above the head and below the feet. " +
  "Plain seamless light grey studio background, soft even lighting. " +
  "Keep the face, facial features, hair, skin tone and body identical, and keep every clothing item and detail identical. " +
  "If the shoes are not visible, add simple shoes that suit the outfit. Photorealistic, sharp.";
const SPIN_PROMPT =
  "Fashion turntable. The person stands still in a relaxed neutral pose on a slowly rotating platform and turns one full 360 degrees at constant speed: " +
  "facing the camera, then their left side, their back, their right side, and facing the camera again, ending exactly on the final image. " +
  "Locked-off static camera, full body head to toe always in frame, centred. The face, hair, body and every clothing detail stay identical to the images throughout. " +
  "Plain light grey seamless studio background, soft even lighting. No camera movement, no cuts, no talking, no music, silent.";

// Step 1: the try-on result as a full-length studio photo (~25 s, ~$0.13), so
// the spin never cuts from the real background to a studio.
async function studioStill(
  key: string,
  look: string,
  request: typeof fetch,
): Promise<string> {
  const response = await request(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              // Input is a validated JPEG data URI from private storage.
              {
                inline_data: { mime_type: "image/jpeg", data: look.slice(23) },
              },
              { text: STUDIO_PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { imageSize: "2K", aspectRatio: "9:16" },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_UNAVAILABLE",
    );
  const data = await response.json();
  const image = data?.candidates?.[0]?.content?.parts
    ?.map(
      (part: Record<string, { data?: string; mimeType?: string }>) =>
        part.inlineData ?? part.inline_data,
    )
    .find((inline: { data?: string } | undefined) => inline?.data);
  if (
    typeof image?.data !== "string" ||
    image.data.length > MAX_IMAGE_BYTES * 1.34
  )
    throw new Error("GENERATION_FAILED");
  return image.data;
}

// Step 2: a 1080p turntable that starts and ends on that still (~55 s, ~$1).
// No retries: a repeat may cost twice.
export async function generateSpinVideo(
  key: string,
  look: string,
  request: typeof fetch = fetch,
): Promise<Uint8Array> {
  const still = await studioStill(key, look, request);
  const frame = { type: "image", data: still, mime_type: "image/jpeg" };
  const response = await request(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: "gemini-omni-1.1-flash",
        // Same first and last frame: the face comes back to the real one and
        // the spin loops cleanly.
        input: [frame, frame, { type: "text", text: SPIN_PROMPT }],
        response_format: {
          type: "video",
          aspect_ratio: "9:16",
          resolution: "1080p",
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_UNAVAILABLE",
    );
  const data = await response.json();
  const video = data?.steps
    ?.find((step: { type?: string }) => step.type === "model_output")
    ?.content?.find(
      (part: { type?: string; mime_type?: string }) =>
        part.type === "video" && part.mime_type === "video/mp4",
    );
  if (
    typeof video?.data !== "string" ||
    video.data.length > MAX_IMAGE_BYTES * 1.34
  )
    throw new Error("GENERATION_FAILED");
  const bytes = Uint8Array.from(atob(video.data), (c) => c.charCodeAt(0));
  // MP4 files carry "ftyp" at bytes 4–7.
  if (String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp")
    throw new Error("INVALID_RESULT");
  return bytes;
}
