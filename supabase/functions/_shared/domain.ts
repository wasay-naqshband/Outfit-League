export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const CONSENT_VERSION = "tryon-v1";
export async function readRequestJson(
  req: Request,
): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) throw new Error("INVALID_REQUEST");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("INVALID_REQUEST");
    return body;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export const terminal = (status: string) =>
  status === "completed" || status === "failed";
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
// Reject non-JPEG bytes and unbounded image dimensions before sending to a provider.
export function validateJpeg(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  if (
    bytes.length < 16 ||
    bytes.length > MAX_IMAGE_BYTES ||
    bytes[0] !== 255 ||
    bytes[1] !== 216
  )
    throw new Error("INVALID_IMAGE");
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 255) throw new Error("INVALID_IMAGE");
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++]!;
    if (marker === 217 || marker === 218) break;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) break;
    if (
      [
        192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
      ].includes(marker)
    ) {
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      if (width < 64 || height < 64 || width > 4096 || height > 4096)
        throw new Error("IMAGE_DIMENSIONS");
      return { width, height };
    }
    offset += length;
  }
  throw new Error("INVALID_IMAGE");
}
export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 16384)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(text);
}
export function decodeResult(uri: string): Uint8Array {
  if (
    !uri.startsWith("data:image/jpeg;base64,") ||
    uri.length > MAX_IMAGE_BYTES * 1.34 + 64
  )
    throw new Error("INVALID_RESULT");
  const raw = atob(uri.slice(23));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  validateJpeg(bytes);
  return bytes;
}
