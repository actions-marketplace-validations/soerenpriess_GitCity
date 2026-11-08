import { describe, expect, it, vi } from "vitest";
import {
  AIRSHIP_LABEL,
  createQuietSnapshot,
  generateCity,
} from "../src/city/cityGenerator.js";
import type { ActivitySnapshot, GridRect } from "../src/types.js";
import empty from "../assets/examples/empty.json";
import lively from "../assets/examples/lively.json";
import polyglot from "../assets/examples/polyglot.json";
import quiet from "../assets/examples/quiet.json";

const overlaps = (a: GridRect, b: GridRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("city generation", () => {
  it("is deterministic for identical input", () => {
    const inputA = lively as ActivitySnapshot;
    expect(generateCity(inputA)).toEqual(generateCity(inputA));
  });

  it("keeps a snapshot unchanged when rendered on a different date", () => {
    const inputA = lively as ActivitySnapshot;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const first = generateCity(inputA);
      vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
      expect(generateCity(inputA)).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("places non-overlapping buildings on land, off the roads", () => {
    const city = generateCity(lively as ActivitySnapshot);
    const { roadsX, roadsY, waterStart, size } = city.layout;
    city.buildings.forEach((building, index) => {
      expect(building.x).toBeGreaterThanOrEqual(0);
      expect(building.y).toBeGreaterThanOrEqual(0);
      expect(building.x + building.w).toBeLessThanOrEqual(waterStart);
      expect(building.y + building.h).toBeLessThanOrEqual(size);
      for (const x of roadsX) {
        expect(overlaps(building, { x, y: 0, w: 1, h: size })).toBe(false);
      }
      for (const y of roadsY) {
        expect(overlaps(building, { x: 0, y, w: size, h: 1 })).toBe(false);
      }
      for (const other of city.buildings.slice(index + 1)) {
        expect(overlaps(building, other)).toBe(false);
      }
    });
  });

  it("creates distinct neighborhoods, parks, and construction sites", () => {
    const city = generateCity(lively as ActivitySnapshot);
    const zones = new Set(city.buildings.map(({ zone }) => zone));
    expect(zones.size).toBeGreaterThanOrEqual(2);
    expect(city.lots.some(({ kind }) => kind === "park")).toBe(true);
    expect(city.buildings.some(({ construction }) => construction)).toBe(true);
    expect(city.cranes.length).toBeGreaterThan(0);
    const tallest = Math.max(...city.buildings.map(({ height }) => height));
    expect(tallest).toBeGreaterThan(city.layout.tile * 4);
  });

  it("fits the platform inside the canvas", () => {
    const city = generateCity(lively as ActivitySnapshot);
    const { originX, originY, size, tile, thickness } = city.layout;
    expect(originX - (size * tile) / 2).toBeGreaterThanOrEqual(0);
    expect(originX + (size * tile) / 2).toBeLessThanOrEqual(city.width);
    expect(originY + (size * tile) / 2 + thickness).toBeLessThanOrEqual(
      city.height,
    );
  });

  it("renders an empty profile as a bare meadow island", () => {
    for (const snapshot of [
      empty as ActivitySnapshot,
      createQuietSnapshot("no-data", "fixture"),
    ]) {
      const city = generateCity(snapshot);
      expect(city.empty).toBe(true);
      expect(city.buildings).toHaveLength(0);
      expect(city.traffic).toHaveLength(0);
      expect(city.people).toHaveLength(0);
      expect(city.layout.roadsX).toHaveLength(0);
      expect(city.plane).toBe(false);
      expect(city.zeppelin).toBeNull();
      expect(city.trees.length).toBeGreaterThan(0);
    }
  });

  it("grows the platform with the profile", () => {
    const sizes = [empty, quiet, lively, polyglot].map(
      (snapshot) => generateCity(snapshot as ActivitySnapshot).layout.size,
    );
    expect(sizes[0]).toBeLessThan(sizes[1]!);
    expect(sizes[1]).toBeLessThan(sizes[2]!);
    expect(sizes[2]).toBeLessThanOrEqual(sizes[3]!);
  });

  it("gives the polyglot fixture each original architecture family", () => {
    const city = generateCity(polyglot as ActivitySnapshot);
    const families = new Set(
      city.buildings
        .filter(({ construction }) => !construction)
        .map(({ architecture }) => architecture),
    );
    expect(families.size).toBe(10);
  });

  it("uses the dominant language to theme water and optionally build a harbor", () => {
    const base = lively as ActivitySnapshot;
    const sqlCity = generateCity({
      ...base,
      languages: { SQL: 9000, TypeScript: 100 },
      repositories: base.repositories.map((repository, index) =>
        index === 0
          ? {
              ...repository,
              id: 987,
              primaryLanguage: "SQL",
              languages: { SQL: 900, Vue: 800, Bash: 200 },
            }
          : repository,
      ),
    });
    expect(sqlCity.waterLanguage).toBe("SQL");
    expect(sqlCity.waterfront).toBe("harbor");
    expect(sqlCity.boats.length).toBeGreaterThan(0);
    expect(
      sqlCity.buildings.find(({ id }) => id === "repo-987")?.architecture,
    ).toBe("data");
    expect(
      sqlCity.buildings.find(({ id }) => id === "repo-987")?.secondaryLanguages,
    ).toEqual(["Vue", "Bash"]);

    const vueCity = generateCity({
      ...base,
      languages: { Vue: 9000, Shell: 100 },
    });
    expect(vueCity.waterLanguage).toBe("Vue");
    expect(vueCity.waterfront).toBe("garden");

    const shellCity = generateCity({
      ...base,
      languages: { Shell: 9000, Vue: 100 },
    });
    expect(shellCity.waterfront).toBe("harbor");
  });

  it("brands populated cities with the Git City zeppelin", () => {
    expect(generateCity(lively as ActivitySnapshot).zeppelin).toBe(AIRSHIP_LABEL);
    expect(generateCity(empty as ActivitySnapshot).zeppelin).toBeNull();
  });

  it("puts repo identity on buildings, including distinguished nature-zone repos", () => {
    const base = lively as ActivitySnapshot;
    const repositories = Array.from({ length: 4 }, (_, index) => ({
      ...base.repositories[0]!,
      id: 100 + index,
      name: `project-${index}`,
      fullName: `developer/project-${index}`,
      commits: 40 - index * 10,
      stars: index === 0 ? 10 : 0,
      forks: index === 3 ? 20 : 0,
      topics: index === 3 ? ["game-engine"] : [],
      pushedAt: null,
      createdAt: index === 3 ? "2020-01-01T00:00:00Z" : "2019-01-01T00:00:00Z",
    }));
    const city = generateCity({ ...base, repositories });
    const distinguished = city.buildings.find(({ id }) => id === "repo-103");
    expect(distinguished?.zone).toBe("nature");
    expect(distinguished?.repository).toEqual({
      name: "project-3",
      fullName: "developer/project-3",
      topics: ["game-engine"],
      topic: "game",
      distinctions: ["newest", "forked"],
    });
    expect(city.buildings.find(({ id }) => id === "repo-100")?.landmark).toBe(
      true,
    );
    expect(
      city.buildings
        .filter(({ repositoryIds }) => repositoryIds.length === 0)
        .every(({ repository }) => repository === null),
    ).toBe(true);
  });

  it("adds a bridge when the profile has co-authors", () => {
    expect(
      generateCity({
        ...(lively as ActivitySnapshot),
        coAuthors: ["pair-programmer"],
      }).bridge,
    ).toBe(true);
    expect(
      generateCity({
        ...(lively as ActivitySnapshot),
        coAuthors: [],
      }).bridge,
    ).toBe(false);
  });

  it("marks the most-starred repository as a landmark", () => {
    const city = generateCity(polyglot as ActivitySnapshot);
    const landmarks = city.buildings.filter(({ landmark }) => landmark);
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]!.architecture).toBe("glass");
  });

  it("builds a stadium for profiles with many followers", () => {
    const stadium = (snapshot: ActivitySnapshot): boolean =>
      generateCity(snapshot).buildings.some(({ form }) => form === "stadium");
    expect(stadium(polyglot as ActivitySnapshot)).toBe(true);
    expect(stadium({ ...(polyglot as ActivitySnapshot), followers: 2 })).toBe(
      false,
    );
  });

  it("sends delivery trucks for open pull requests", () => {
    const trucks = (snapshot: ActivitySnapshot): number =>
      generateCity(snapshot)
        .traffic.flatMap(({ vehicles }) => vehicles)
        .filter(({ kind }) => kind === "truck").length;
    expect(trucks(polyglot as ActivitySnapshot)).toBeGreaterThan(0);
    expect(
      trucks({ ...(polyglot as ActivitySnapshot), openPullRequests: 0 }),
    ).toBe(0);
  });
});
