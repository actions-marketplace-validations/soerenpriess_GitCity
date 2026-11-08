import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { outputChanged } from "../src/action/main.js";

describe("action output check", () => {
  it("only requests a commit when output bytes differ", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-city-action-"));
    const file = join(directory, "city.gif");
    try {
      await writeFile(file, Buffer.from([1, 2, 3]));
      expect(await outputChanged(file, Buffer.from([1, 2, 3]))).toBe(false);
      expect(await outputChanged(file, Buffer.from([1, 2, 4]))).toBe(true);
      expect(await outputChanged(file, undefined)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
