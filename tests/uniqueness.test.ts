import { describe, expect, it } from "vitest";
import { generateCity } from "../src/city/cityGenerator.js";
import { isLand, landTiles, project } from "../src/city/grid.js";
import { MONUMENT_MIN_STREAK } from "../src/city/monument.js";
import { seasonFor } from "../src/city/seasons.js";
import { isAbandoned } from "../src/city/zoning.js";
import { DEFAULT_OPTIONS, MAX_SCALE, validateOptions } from "../src/config.js";
import { renderPixels } from "../src/render/canvasRenderer.js";
import type { ActivitySnapshot } from "../src/types.js";
import empty from "../assets/examples/empty.json";
import lively from "../assets/examples/lively.json";
import oldTown from "../assets/examples/old-town.json";
import quiet from "../assets/examples/quiet.json";

const withDays = (
  commitsByDay: Record<string, number>,
  fetchedAt = "2026-01-01T00:00:00.000Z",
): ActivitySnapshot => ({
  ...(empty as ActivitySnapshot),
  fetchedAt,
  commitsByDay,
});

describe("seeded coastline", () => {
  const sizes: Array<[number, number]> = [
    [160, 90],
    [480, 270],
    [1200, 675],
  ];

  it.each(sizes)("keeps every island inside a %ix%i canvas", (width, height) => {
    for (let index = 0; index < 40; index += 1) {
      const { layout } = generateCity(lively as ActivitySnapshot, {
        width,
        height,
        scale: 1,
        seed: `coast-${index}`,
      });
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const { x, y } of landTiles(layout)) {
        for (const [cx, cy] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ] as const) {
          const point = project(layout, cx, cy);
          left = Math.min(left, point.x);
          right = Math.max(right, point.x);
          top = Math.min(top, point.y);
          bottom = Math.max(bottom, point.y + layout.thickness);
        }
      }
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(height);
    }
  });

  it("is deterministic per seed and differs between seeds", () => {
    const shape = (seed: string): string =>
      JSON.stringify(
        generateCity(lively as ActivitySnapshot, { seed }).layout.coast,
      );
    expect(shape("a")).toBe(shape("a"));
    const shapes = new Set(
      Array.from({ length: 8 }, (_, index) => shape(`island-${index}`)),
    );
    expect(shapes.size).toBeGreaterThan(1);
  });

  it("never cuts into roads, lots, or buildings", () => {
    for (let index = 0; index < 40; index += 1) {
      const city = generateCity(lively as ActivitySnapshot, {
        seed: `bay-${index}`,
      });
      const { layout } = city;
      for (let x = 1; x < layout.waterStart; x += 1) {
        for (let y = 1; y < layout.size - 1; y += 1) {
          expect(isLand(layout, x, y)).toBe(true);
        }
      }
      for (const building of city.buildings) {
        for (let x = Math.floor(building.x); x < building.x + building.w; x += 1)
          for (let y = Math.floor(building.y); y < building.y + building.h; y += 1)
            expect(isLand(layout, x, y)).toBe(true);
      }
      for (const tree of city.trees) {
        expect(isLand(layout, Math.floor(tree.x), Math.floor(tree.y))).toBe(
          true,
        );
      }
    }
  });
});

describe("seasons", () => {
  it("follows the season with the most commits", () => {
    expect(seasonFor(withDays({ "2025-04-02": 3, "2025-07-01": 9 }))).toBe(
      "summer",
    );
    expect(seasonFor(withDays({ "2025-10-10": 5, "2025-12-01": 2 }))).toBe(
      "autumn",
    );
    expect(seasonFor(withDays({ "2025-01-10": 4, "2025-12-01": 2 }))).toBe(
      "winter",
    );
    expect(seasonFor(withDays({ "2025-03-01": 4, "2025-08-01": 4 }))).toBe(
      "spring",
    );
  });

  it("falls back to the snapshot date without commits", () => {
    expect(seasonFor(withDays({}, "2026-05-01T00:00:00.000Z"))).toBe("spring");
    expect(generateCity(empty as ActivitySnapshot).season).toBe("winter");
    expect(generateCity(oldTown as ActivitySnapshot).season).toBe("summer");
  });
});

describe("streak lighthouse", () => {
  it("needs a streak of at least three days", () => {
    expect((quiet as ActivitySnapshot).longestStreak).toBeLessThan(
      MONUMENT_MIN_STREAK,
    );
    expect(generateCity(quiet as ActivitySnapshot).monument).toBeNull();
    expect(generateCity(empty as ActivitySnapshot).monument).toBeNull();
  });

  it("grows with the longest streak and is lit only during a streak", () => {
    const base = lively as ActivitySnapshot;
    const short = generateCity({ ...base, longestStreak: 5 }).monument!;
    const long = generateCity({ ...base, longestStreak: 90 }).monument!;
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.rings).toBeGreaterThan(short.rings);
    expect(short.lit).toBe(true);
    expect(generateCity({ ...base, currentStreak: 0 }).monument!.lit).toBe(
      false,
    );
  });

  it("stays inside the canvas", () => {
    for (const [width, height] of [
      [160, 90],
      [480, 270],
      [1200, 675],
    ] as const) {
      const city = generateCity(
        { ...(lively as ActivitySnapshot), longestStreak: 365 },
        { width, height },
      );
      const base = project(city.layout, city.monument!.x, city.monument!.y);
      expect(base.y - city.monument!.height).toBeGreaterThan(0);
    }
  });
});

describe("abandoned repositories", () => {
  const snapshot = oldTown as ActivitySnapshot;
  const reference = new Date(snapshot.fetchedAt);
  const buildingFor = (name: string) => {
    const repository = snapshot.repositories.find((repo) => repo.name === name)!;
    return generateCity(snapshot).buildings.find((building) =>
      building.repositoryIds.includes(repository.id),
    );
  };

  it("detects repositories without a push for a year", () => {
    const [active, , portal] = snapshot.repositories;
    expect(isAbandoned(active!, reference)).toBe(false);
    expect(isAbandoned(portal!, reference)).toBe(true);
    expect(isAbandoned({ ...portal!, pushedAt: null }, reference)).toBe(false);
  });

  it("turns them into ruins instead of parks, except for landmarks", () => {
    expect(buildingFor("legacy-portal")?.abandoned).toBe(true);
    expect(buildingFor("perl-reports")?.abandoned).toBe(true);
    expect(buildingFor("garden-api")?.abandoned).toBe(false);
    const landmark = buildingFor("jquery-carousel");
    expect(landmark?.landmark).toBe(true);
    expect(landmark?.abandoned).toBe(false);
  });
});

describe("resolution scale", () => {
  it("validates the scale option", () => {
    expect(() => validateOptions({ ...DEFAULT_OPTIONS, scale: 2 })).not.toThrow();
    for (const scale of [0, 1.5, MAX_SCALE + 1]) {
      expect(() => validateOptions({ ...DEFAULT_OPTIONS, scale })).toThrow(
        /Scale/,
      );
    }
  });

  it("renders finer native detail instead of upscaling", () => {
    const options = { width: 240, height: 135, frames: 2 };
    const base = generateCity(lively as ActivitySnapshot, { ...options, scale: 1 });
    const detailed = generateCity(lively as ActivitySnapshot, { ...options, scale: 2 });
    expect([detailed.width, detailed.height]).toEqual([480, 270]);
    expect(detailed.layout.unit).toBe(2);
    expect(detailed.layout.tile).toBe(base.layout.tile * 2);
    const footprint = (city: typeof base) =>
      city.buildings.map(({ id, x, y, w, h, form }) => ({ id, x, y, w, h, form }));
    expect(footprint(detailed)).toEqual(footprint(base));
    detailed.buildings.forEach((building, index) =>
      expect(
        Math.abs(building.height - base.buildings[index]!.height * 2),
      ).toBeLessThanOrEqual(2),
    );

    const small = renderPixels(base, 0);
    const large = renderPixels(detailed, 0);
    expect([large.width, large.height]).toEqual([480, 270]);
    let differs = false;
    for (let y = 0; y < large.height && !differs; y += 1) {
      for (let x = 0; x < large.width; x += 1) {
        const a = ((y >> 1) * small.width + (x >> 1)) * 4;
        const b = (y * large.width + x) * 4;
        if (
          small.data[a] !== large.data[b] ||
          small.data[a + 1] !== large.data[b + 1] ||
          small.data[a + 2] !== large.data[b + 2] ||
          small.data[a + 3] !== large.data[b + 3]
        ) {
          differs = true;
          break;
        }
      }
    }
    expect(differs).toBe(true);
  });
});
