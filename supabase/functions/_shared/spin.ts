import { MAX_IMAGE_BYTES } from "./domain.ts";

// Seconds at the start of the clip the viewer skips: Omni opens on the input
// photo for ~1.4 s before cutting to the studio turntable.
export const SPIN_START = 1.5;

const PROMPT =
  "Fashion turntable shot. The exact person from the image stands still in a relaxed neutral pose on a slowly rotating platform and turns a full 360 degrees at constant speed, " +
  "starting facing the camera, then showing the left side, the back, the right side, and ending facing the camera again. Locked-off static camera, full body head to toe always in frame, centered. " +
  "Keep the face, hair, body and every clothing detail identical to the image. Plain light grey seamless studio background, soft even lighting. " +
  "No camera movement, no cuts, no talking, no music, silent.";

// One synchronous call (~40 s, ~$1 for 10 s of 720p). No retries: a repeat may cost twice.
export async function generateSpinVideo(
  key: string,
  person: string,
  request: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await request(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(140000),
      body: JSON.stringify({
        model: "gemini-omni-1.1-flash",
        input: [
          // Input is a validated JPEG data URI from private storage.
          { type: "image", data: person.slice(23), mime_type: "image/jpeg" },
          { type: "text", text: PROMPT },
        ],
        response_format: {
          type: "video",
          aspect_ratio: "9:16",
          resolution: "720p",
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
