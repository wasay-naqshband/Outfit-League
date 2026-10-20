import { decode } from "npm:fast-png@6.4.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { MAX_IMAGE_BYTES, validateJpeg } from "./domain.ts";

export async function normalizeResult(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    validateJpeg(bytes);
    return bytes;
  } catch {
    /* PNG output is converted before private JPEG storage. */
  }
  // Check PNG dimensions before decoding to bound image memory use.
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    bytes.length > MAX_IMAGE_BYTES ||
    !signature.every((value, i) => bytes[i] === value)
  )
    throw new Error("INVALID_RESULT");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (
    width < 64 ||
    height < 64 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 8000000
  )
    throw new Error("INVALID_RESULT");
  try {
    const image = decode(bytes);
    if (image.depth !== 8 || image.palette) throw new Error("INVALID_RESULT");
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const source = i * image.channels,
        target = i * 4;
      const gray = image.channels < 3;
      const alpha =
        image.channels === 2 || image.channels === 4
          ? image.data[source + image.channels - 1]! / 255
          : 1;
      for (let channel = 0; channel < 3; channel++)
        rgba[target + channel] = Math.round(
          image.data[source + (gray ? 0 : channel)]! * alpha +
            255 * (1 - alpha),
        );
      rgba[target + 3] = 255;
    }
    const result = jpeg.encode({ data: rgba, width, height }, 90).data;
    validateJpeg(result);
    return result;
  } catch {
    throw new Error("INVALID_RESULT");
  }
}
