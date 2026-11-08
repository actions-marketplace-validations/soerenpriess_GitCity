function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    const blockSize = bytes[offset++]!;
    if (blockSize === 0) return offset;
    offset += blockSize;
    if (offset > bytes.length)
      throw new Error("GIF contains a truncated data block.");
  }
  throw new Error("GIF is missing a data-block terminator.");
}

export function validateGifBytes(bytes: Uint8Array, label = "GIF"): number {
  const header = Buffer.from(bytes.subarray(0, 6)).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") {
    throw new Error(`${label} is not a valid GIF file (missing GIF header).`);
  }
  if (bytes.length < 14 || bytes[bytes.length - 1] !== 0x3b) {
    throw new Error(`${label} is incomplete (missing GIF trailer).`);
  }
  const screenPacked = bytes[10]!;
  let offset = 13;
  if (screenPacked & 0x80) offset += 3 * (1 << ((screenPacked & 0x07) + 1));
  let frames = 0;
  let hasTrailer = false;

  while (offset < bytes.length) {
    const marker = bytes[offset++]!;
    if (marker === 0x3b) {
      hasTrailer = true;
      break;
    }
    if (marker === 0x21) {
      if (offset >= bytes.length)
        throw new Error(`${label} contains a truncated extension.`);
      offset += 1;
      offset = skipSubBlocks(bytes, offset);
      continue;
    }
    if (marker !== 0x2c)
      throw new Error(`${label} contains an invalid block marker.`);
    if (offset + 9 > bytes.length)
      throw new Error(`${label} contains a truncated image descriptor.`);
    const imagePacked = bytes[offset + 8]!;
    offset += 9;
    if (imagePacked & 0x80) offset += 3 * (1 << ((imagePacked & 0x07) + 1));
    if (offset >= bytes.length)
      throw new Error(`${label} is missing image data.`);
    offset += 1;
    offset = skipSubBlocks(bytes, offset);
    frames += 1;
  }
  if (!hasTrailer || frames === 0)
    throw new Error(`${label} contains no complete image frames.`);
  return frames;
}
