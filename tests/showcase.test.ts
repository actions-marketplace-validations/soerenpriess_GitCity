import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_SEED,
  LIFECYCLE_STAGES,
  SHOWCASE_EXAMPLES,
  SHOWCASE_SNAPSHOTS,
  type ExampleName,
} from "../scripts/showcase-config.js";
import { calculateStreaks } from "../src/analysis/streaks.js";
import { AIRSHIP_LABEL, generateCity } from "../src/city/cityGenerator.js";
import { DEFAULT_OPTIONS } from "../src/config.js";
import { renderPixels } from "../src/render/canvasRenderer.js";
import { validateGifBytes } from "../src/render/gifValidator.js";
import type { Architecture, WaterfrontKind } from "../src/types.js";

const snapshots = SHOWCASE_SNAPSHOTS;
const examplesDirectory = join(process.cwd(), "assets", "examples");

describe("showcase snapshots", () => {
  it.each([...SHOWCASE_EXAMPLES, ...LIFECYCLE_STAGES])(
    "keeps %s internally consistent",
    (name) => {
      const snapshot = snapshots[name];
      const fetchedAt = Date.parse(snapshot.fetchedAt);
      const periodStart = fetchedAt - snapshot.periodDays * 86_400_000;
      const languages: Record<string, number> = {};
      const days: Record<string, number> = {};
      const coAuthors = new Set<string>();
      for (const repository of snapshot.repositories) {
        expect(repository.fullName).toBe(
          `${snapshot.username}/${repository.name}`,
        );
        expect(Date.parse(repository.createdAt)).toBeLessThanOrEqual(fetchedAt);
        expect(
          Object.values(repository.commitsByDay).reduce(
            (sum, count) => sum + count,
            0,
          ),
        ).toBe(repository.commits);
        for (const [language, bytes] of Object.entries(repository.languages)) {
          languages[language] = (languages[language] ?? 0) + bytes;
        }
        for (const [day, count] of Object.entries(repository.commitsByDay)) {
          expect(Number.isInteger(count) && count > 0).toBe(true);
          expect(Date.parse(`${day}T00:00:00Z`)).toBeGreaterThanOrEqual(
            periodStart,
          );
          expect(Date.parse(`${day}T00:00:00Z`)).toBeLessThan(fetchedAt);
          days[day] = (days[day] ?? 0) + count;
          expect(day >= repository.createdAt.slice(0, 10)).toBe(true);
          expect(day <= snapshot.fetchedAt.slice(0, 10)).toBe(true);
          expect(repository.pushedAt).not.toBeNull();
          expect(day <= repository.pushedAt!.slice(0, 10)).toBe(true);
          expect(Date.parse(repository.pushedAt!)).toBeLessThanOrEqual(
            fetchedAt,
          );
        }
        repository.coAuthors.forEach((author) => coAuthors.add(author));
      }
      expect(snapshot.languages).toEqual(languages);
      expect(snapshot.commitsByDay).toEqual(days);
      expect([...coAuthors].sort()).toEqual([...snapshot.coAuthors].sort());
      for (const [field, repositoryField] of [
        ["totalCommits", "commits"],
        ["totalStars", "stars"],
        ["totalForks", "forks"],
        ["openIssues", "openIssues"],
        ["openPullRequests", "openPullRequests"],
      ] as const) {
        expect(snapshot[field]).toBe(
          snapshot.repositories.reduce(
            (sum, repository) => sum + repository[repositoryField],
            0,
          ),
        );
      }
      const streaks = calculateStreaks(
        snapshot.commitsByDay,
        new Date(snapshot.fetchedAt),
      );
      expect(snapshot.currentStreak).toBe(streaks.current);
      expect(snapshot.longestStreak).toBe(streaks.longest);
      const latestDay = Object.keys(days).sort().at(-1);
      expect(snapshot.lastCommitAt?.slice(0, 10) ?? null).toBe(
        latestDay ?? null,
      );
    },
  );

  it("renders distinct Vue, Shell, and SQL neighborhoods and waterfronts", () => {
    const expectations: Array<
      [ExampleName, string, Architecture, WaterfrontKind]
    > = [
      ["vue-garden", "Vue", "creative", "garden"],
      ["shell-harbor", "Shell", "operations", "harbor"],
      ["sql-harbor", "SQL", "data", "harbor"],
    ];
    for (const [name, language, architecture, waterfront] of expectations) {
      const city = generateCity(snapshots[name]);
      expect(city.waterLanguage).toBe(language);
      expect(city.waterfront).toBe(waterfront);
      expect(
        city.buildings.some(
          (building) =>
            building.language === language &&
            building.architecture === architecture,
        ),
      ).toBe(true);
    }
  });

  it("grows one profile from an empty island to an active city", () => {
    const progression = LIFECYCLE_STAGES.map((name) => snapshots[name]);
    const cities = progression.map((snapshot) =>
      generateCity(snapshot, { seed: LIFECYCLE_SEED }),
    );
    expect(new Set(progression.map(({ username }) => username)).size).toBe(1);
    expect(new Set(cities.map(({ seed }) => seed)).size).toBe(1);
    expect(cities[0]!.empty).toBe(true);
    expect(cities[0]!.buildings).toHaveLength(0);
    expect(cities[0]!.zeppelin).toBeNull();
    expect(cities[1]!.zeppelin).toBe(AIRSHIP_LABEL);
    expect(cities[2]!.bridge).toBe(true);
    expect(cities.at(-1)!.empty).toBe(false);
    expect(
      cities.at(-1)!.buildings.some(({ form }) => form === "stadium"),
    ).toBe(true);
    for (let index = 1; index < progression.length; index += 1) {
      const previous = progression[index - 1]!;
      const current = progression[index]!;
      expect(Date.parse(current.fetchedAt)).toBeGreaterThan(
        Date.parse(previous.fetchedAt),
      );
      expect(current.totalCommits).toBeGreaterThan(previous.totalCommits);
      expect(current.followers ?? 0).toBeGreaterThan(previous.followers ?? 0);
      expect(cities[index]!.layout.size).toBeGreaterThan(
        cities[index - 1]!.layout.size,
      );
      expect(cities[index]!.buildings.length).toBeGreaterThan(
        cities[index - 1]!.buildings.length,
      );
      for (const earlier of previous.repositories) {
        const later = current.repositories.find(({ id }) => id === earlier.id);
        expect(later).toBeDefined();
        expect(later).toMatchObject({
          name: earlier.name,
          fullName: earlier.fullName,
          createdAt: earlier.createdAt,
        });
        expect(later!.commits).toBeGreaterThanOrEqual(earlier.commits);
        expect(later!.stars).toBeGreaterThanOrEqual(earlier.stars);
        expect(later!.forks).toBeGreaterThanOrEqual(earlier.forks);
      }
    }
  });

  it.each([
    ...SHOWCASE_EXAMPLES.map((name) => ({ name, lifecycle: false })),
    ...LIFECYCLE_STAGES.map((name) => ({ name, lifecycle: true })),
  ])("reproduces the first frame of $name", async ({ name, lifecycle }) => {
    const city = generateCity(
      snapshots[name],
      lifecycle ? { seed: LIFECYCLE_SEED } : {},
    );
    const canvas = createCanvas(city.width, city.height);
    const context = canvas.getContext("2d");
    const png = await loadImage(join(examplesDirectory, `${name}.png`));
    context.drawImage(png, 0, 0);
    const actual = context.getImageData(0, 0, city.width, city.height).data;
    const expected = renderPixels(city, 0).data;
    expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
  });

  it("ships valid animated examples and a four-stage lifecycle GIF", async () => {
    for (const name of [...SHOWCASE_EXAMPLES, ...LIFECYCLE_STAGES]) {
      const gif = await readFile(join(examplesDirectory, `${name}.gif`));
      expect(validateGifBytes(gif, name)).toBe(DEFAULT_OPTIONS.frames);
      expect(gif.readUInt16LE(6)).toBe(DEFAULT_OPTIONS.width * DEFAULT_OPTIONS.scale);
      expect(gif.readUInt16LE(8)).toBe(DEFAULT_OPTIONS.height * DEFAULT_OPTIONS.scale);
      const png = await readFile(join(examplesDirectory, `${name}.png`));
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(png.readUInt32BE(16)).toBe(DEFAULT_OPTIONS.width * DEFAULT_OPTIONS.scale);
      expect(png.readUInt32BE(20)).toBe(DEFAULT_OPTIONS.height * DEFAULT_OPTIONS.scale);
    }
    const lifecycle = await readFile(
      join(examplesDirectory, "growth-lifecycle.gif"),
    );
    expect(validateGifBytes(lifecycle, "growth lifecycle")).toBe(
      DEFAULT_OPTIONS.frames * LIFECYCLE_STAGES.length,
    );
    expect(lifecycle.readUInt16LE(6)).toBe(DEFAULT_OPTIONS.width * DEFAULT_OPTIONS.scale);
    expect(lifecycle.readUInt16LE(8)).toBe(DEFAULT_OPTIONS.height * DEFAULT_OPTIONS.scale);
  });
});
