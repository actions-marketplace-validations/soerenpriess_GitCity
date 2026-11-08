import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateCity } from "../src/city/cityGenerator.js";
import { renderPixels } from "../src/render/canvasRenderer.js";
import { encodeGif } from "../src/render/gifExporter.js";
import { validateGifBytes } from "../src/render/gifValidator.js";
import { PixelBuffer } from "../src/render/pixelArt.js";
import { drawZeppelin, IsoPainter } from "../src/render/sprites.js";
import { drawRepositoryBadges } from "../src/render/repositoryBadges.js";
import type { ActivitySnapshot } from "../src/types.js";
import lively from "../assets/examples/lively.json";
import quiet from "../assets/examples/quiet.json";

describe("rendering", () => {
  it.each([
    [160, 90],
    [480, 270],
    [1200, 675],
  ])(
    "keeps the zeppelin visible at a fixed horizontal position at %ix%i",
    (width, height) => {
      const bounds = (buffer: PixelBuffer) => {
        let minX = width;
        let maxX = -1;
        let minY = height;
        let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (buffer.data[(y * width + x) * 4 + 3] !== 255) continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
        return { minX, maxX, minY, maxY };
      };
      const first = new PixelBuffer(width, height);
      drawZeppelin(first, height, 0, 24, "test-city");
      const initial = bounds(first);
      const amplitude = Math.max(1, Math.round(height * 0.008));
      expect(initial.maxX - initial.minX).toBeGreaterThan(60);
      for (let frame = 0; frame <= 24; frame += 1) {
        const buffer = new PixelBuffer(width, height);
        drawZeppelin(buffer, height, frame, 24, "test-city");
        const current = bounds(buffer);
        expect(current.minX).toBe(initial.minX);
        expect(current.maxX).toBe(initial.maxX);
        expect(Math.abs(current.minY - initial.minY)).toBeLessThanOrEqual(
          amplitude,
        );
        expect(current.maxY - current.minY).toBe(initial.maxY - initial.minY);
        expect(current.minY).toBeGreaterThanOrEqual(0);
        expect(current.maxY).toBeLessThan(height);
        if (frame === 24)
          expect(Buffer.from(buffer.data).equals(Buffer.from(first.data))).toBe(
            true,
          );
      }
      const still = new PixelBuffer(width, height);
      drawZeppelin(still, height, 0, 1, "test-city");
      expect(Buffer.from(still.data).equals(Buffer.from(first.data))).toBe(
        true,
      );
    },
  );

  it("draws distinction badges without rendering names or topic symbols", () => {
    const city = generateCity(quiet as ActivitySnapshot);
    const base = city.buildings.find(({ repository }) => repository !== null)!;
    const renderBadges = (
      name: string,
      topic: string | null,
      distinctions: NonNullable<typeof base.repository>["distinctions"],
    ) => {
      const buffer = new PixelBuffer(city.width, city.height);
      drawRepositoryBadges(new IsoPainter(buffer, city.layout), {
        ...base,
        w: 2,
        h: 2,
        repository: {
          name,
          fullName: `developer/${name}`,
          topics: topic ? [topic] : [],
          topic,
          distinctions,
        },
      });
      return buffer.data;
    };
    expect(
      renderBadges("api-tool", "api", []).every((byte) => byte === 0),
    ).toBe(true);
    const decorated = renderBadges("api-tool", "api", [
      "active",
      "newest",
      "forked",
    ]);
    expect(
      Buffer.from(decorated).equals(
        Buffer.from(
          renderBadges("other-repo", "cli", ["active", "newest", "forked"]),
        ),
      ),
    ).toBe(true);
    for (const hex of ["ffd66b", "7be08a", "a7d9ff"]) {
      const rgb = Number.parseInt(hex, 16);
      expect(
        decorated.some(
          (_, index) =>
            index % 4 === 0 &&
            decorated[index] === ((rgb >> 16) & 255) &&
            decorated[index + 1] === ((rgb >> 8) & 255) &&
            decorated[index + 2] === (rgb & 255) &&
            decorated[index + 3] === 255,
        ),
      ).toBe(true);
    }
    const blank = new PixelBuffer(city.width, city.height);
    drawRepositoryBadges(new IsoPainter(blank, city.layout), {
      ...base,
      repository: null,
    });
    expect(blank.data.every((channel) => channel === 0)).toBe(true);
  });

  it("keeps badges but ignores repo names and topics in city frames", () => {
    const city = generateCity(quiet as ActivitySnapshot);
    const renamed = {
      ...city,
      buildings: city.buildings.map((building) => ({
        ...building,
        repository: building.repository
          ? {
              ...building.repository,
              name: "different-name",
              fullName: "different-owner/different-name",
              topics: ["different-topic"],
              topic: "different-topic",
            }
          : null,
      })),
    };
    const withoutBadges = {
      ...city,
      buildings: city.buildings.map((building) => ({
        ...building,
        repository: building.repository
          ? { ...building.repository, distinctions: [] }
          : null,
      })),
    };
    for (const frame of [0, Math.floor(city.frameCount / 2)]) {
      const original = Buffer.from(renderPixels(city, frame).data);
      expect(
        original.equals(Buffer.from(renderPixels(renamed, frame).data)),
      ).toBe(true);
      expect(
        original.equals(Buffer.from(renderPixels(withoutBadges, frame).data)),
      ).toBe(false);
    }
  });

  it("renders and writes an animated GIF with a transparent background", async () => {
    const city = generateCity(quiet as ActivitySnapshot, {
      width: 240,
      height: 135,
      frames: 3,
    });
    const frames = Array.from({ length: city.frameCount }, (_, frame) =>
      renderPixels(city, frame),
    );
    expect(frames[0]!.data[3]).toBe(0);
    const center = ((city.height >> 1) * city.width + (city.width >> 1)) * 4;
    expect(frames[0]!.data[center + 3]).toBe(255);
    expect(
      frames[0]!.data.every(
        (value, index) => index % 4 !== 3 || value === 0 || value === 255,
      ),
    ).toBe(true);

    const bytes = encodeGif(frames, city.width, city.height, city.fps);
    const directory = await mkdtemp(join(tmpdir(), "git-city-"));
    const output = join(directory, "city.gif");
    try {
      await writeFile(output, bytes);
      const saved = await readFile(output);
      expect(saved.subarray(0, 6).toString("ascii")).toBe("GIF89a");
      expect(saved[saved.length - 1]).toBe(0x3b);
      expect(validateGifBytes(saved)).toBe(city.frameCount);
      // Graphic control extension: disposal 2 (restore to background) + transparency flag.
      const gce = saved.indexOf(Buffer.from([0x21, 0xf9, 0x04]));
      expect(gce).toBeGreaterThan(0);
      expect(saved[gce + 3]! & 0x01).toBe(1);
      expect((saved[gce + 3]! >> 2) & 0x07).toBe(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loops seamlessly including the zeppelin", () => {
    const city = generateCity(lively as ActivitySnapshot);
    const first = renderPixels(city, 0).data;
    const wrapped = renderPixels(city, city.frameCount).data;
    expect(Buffer.from(wrapped).equals(Buffer.from(first))).toBe(true);
    const middle = renderPixels(city, city.frameCount / 2).data;
    expect(Buffer.from(middle).equals(Buffer.from(first))).toBe(false);
  });

  it("draws the zeppelin in the animated and single-frame previews", () => {
    const city = generateCity(lively as ActivitySnapshot);
    const animatedFrame = Math.floor(city.frameCount / 2);
    const animated = renderPixels(city, animatedFrame).data;
    const withoutAnimatedAirship = renderPixels(
      { ...city, zeppelin: null },
      animatedFrame,
    ).data;
    expect(
      Buffer.from(animated).equals(Buffer.from(withoutAnimatedAirship)),
    ).toBe(false);

    const stillCity = generateCity(lively as ActivitySnapshot, { frames: 1 });
    const still = renderPixels(stillCity, 0).data;
    const withoutStillAirship = renderPixels(
      { ...stillCity, zeppelin: null },
      0,
    ).data;
    expect(Buffer.from(still).equals(Buffer.from(withoutStillAirship))).toBe(
      false,
    );
  });

  it("draws co-author bridges across the river", () => {
    const city = generateCity({
      ...(lively as ActivitySnapshot),
      coAuthors: ["pair-programmer"],
    });
    const frame = Math.floor(city.frameCount / 2);
    const connected = renderPixels(city, frame).data;
    const solo = renderPixels({ ...city, bridge: false }, frame).data;
    expect(Buffer.from(connected).equals(Buffer.from(solo))).toBe(false);
  });
});
