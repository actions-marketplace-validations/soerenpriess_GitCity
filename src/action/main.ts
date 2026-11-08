import { readFile } from "node:fs/promises";

export async function outputChanged(
  path: string,
  previous: Uint8Array | undefined,
): Promise<boolean> {
  const current = await readFile(path);
  if (!previous || current.byteLength !== previous.byteLength) return true;
  return current.some((byte, index) => byte !== previous[index]);
}
