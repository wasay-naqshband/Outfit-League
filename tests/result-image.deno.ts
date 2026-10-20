import { encode } from "npm:fast-png@6.4.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { normalizeResult } from "../supabase/functions/_shared/result-image.ts";

Deno.test(
  "PNG result conversion preserves colors and composites transparency on white",
  async () => {
    for (const alpha of [0, 255]) {
      const pixels = new Uint8Array(64 * 64 * 4);
      for (let i = 0; i < pixels.length; i += 4)
        pixels.set([255, 0, 0, alpha], i);
      const png = encode({
        width: 64,
        height: 64,
        data: pixels,
        channels: 4,
        depth: 8,
      });
      const result = jpeg.decode(await normalizeResult(png), {
        useTArray: true,
      });
      if (
        result.width !== 64 ||
        result.height !== 64 ||
        result.data[0] < 245 ||
        (alpha === 0 ? result.data[1] < 245 : result.data[1] > 10)
      )
        throw new Error("Incorrect result conversion");
    }
  },
);

Deno.test(
  "result conversion rejects corrupt images and oversized dimensions",
  async () => {
    const png = encode({
      width: 64,
      height: 64,
      data: new Uint8Array(64 * 64 * 3),
      channels: 3,
      depth: 8,
    });
    new DataView(png.buffer, png.byteOffset, png.byteLength).setUint32(
      16,
      100000,
    );
    for (const input of [new Uint8Array([1, 2, 3]), png]) {
      let rejected = false;
      try {
        await normalizeResult(input);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error("Unsafe output accepted");
    }
  },
);
