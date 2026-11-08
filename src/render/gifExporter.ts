import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const gifenc: typeof import("gifenc") = require("gifenc");
const { applyPalette, GIFEncoder, quantize } = gifenc;

// RGBA pixels of one frame; alpha 0 marks transparent background pixels. */
export interface FrameSource {
  data: Uint8ClampedArray | Uint8Array;
}

const TRANSPARENT_INDEX = 0;
const MAX_OPAQUE_COLORS = 255;

function opaqueKey(data: FrameSource["data"], offset: number): number {
  return (data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!;
}

/**
 * Build one global palette for all frames. Index 0 is reserved for
 * transparency; when the scene has more than 255 distinct colors the opaque
 * pixels are quantized.
 */
function buildPalette(frames: FrameSource[], maxColors: number) {
  const unique = new Map<number, number>();
  for (const { data } of frames) {
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3]! < 128) continue;
      const key = opaqueKey(data, offset);
      if (!unique.has(key)) unique.set(key, unique.size + 1);
      if (unique.size > maxColors) break;
    }
    if (unique.size > maxColors) break;
  }
  if (unique.size <= maxColors) {
    const palette = [[0, 0, 0]];
    for (const key of unique.keys()) {
      palette.push([(key >> 16) & 255, (key >> 8) & 255, key & 255]);
    }
    return { palette, exact: unique };
  }
  const samples: number[] = [];
  frames.forEach(({ data }, frame) => {
    if (frame % 2 === 1) return;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3]! >= 128)
        samples.push(data[offset]!, data[offset + 1]!, data[offset + 2]!, 255);
    }
  });
  const colors = quantize(new Uint8Array(samples), maxColors);
  return { palette: [[0, 0, 0], ...colors], exact: null };
}

export function encodeGif(
  frames: FrameSource[],
  width: number,
  height: number,
  fps: number,
  maxColors = MAX_OPAQUE_COLORS,
): Uint8Array {
  if (frames.length === 0)
    throw new Error("Cannot encode a GIF without frames.");
  const limit = Math.min(MAX_OPAQUE_COLORS, Math.max(2, maxColors));
  const { palette, exact } = buildPalette(frames, limit);
  const quantized = palette.slice(1);
  const encoder = GIFEncoder();
  const delay = Math.round(1000 / fps);
  frames.forEach(({ data }, index) => {
    if (data.length !== width * height * 4) {
      throw new Error("Frame size does not match the GIF dimensions.");
    }
    const indexed = new Uint8Array(width * height);
    const mapped = exact ? null : applyPalette(new Uint8Array(data), quantized);
    for (let pixel = 0; pixel < indexed.length; pixel += 1) {
      const offset = pixel * 4;
      if (data[offset + 3]! < 128) {
        indexed[pixel] = TRANSPARENT_INDEX;
      } else if (exact) {
        indexed[pixel] = exact.get(opaqueKey(data, offset))!;
      } else {
        indexed[pixel] = mapped![pixel]! + 1;
      }
    }
    encoder.writeFrame(indexed, width, height, {
      ...(index === 0 ? { palette, first: true, repeat: 0 } : {}),
      delay,
      transparent: true,
      transparentIndex: TRANSPARENT_INDEX,
      dispose: 2,
    });
  });
  encoder.finish();
  return encoder.bytes();
}
