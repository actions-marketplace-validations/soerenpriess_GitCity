import { describe, expect, it } from "vitest";
import { normalizeMetrics } from "../src/analysis/metrics.js";
import { languageStyle } from "../src/analysis/languagePalette.js";
import { calculateStreaks } from "../src/analysis/streaks.js";
import { createQuietSnapshot } from "../src/city/cityGenerator.js";

describe("activity analysis", () => {
  it("normalizes empty and high activity to bounded visual metrics", () => {
    const empty = normalizeMetrics(createQuietSnapshot("empty", "no data"));
    expect(empty.activity).toBe(0);
    expect(empty.buildingCount).toBe(6);
    const active = createQuietSnapshot("active", "fixture");
    active.totalCommits = 1_000_000;
    active.currentStreak = 90;
    active.repositories = Array.from({ length: 60 }, (_, id) => ({
      id,
      name: `repo-${id}`,
      fullName: `active/repo-${id}`,
      description: null,
      primaryLanguage: "TypeScript",
      languages: {},
      stars: 0,
      forks: 0,
      openIssues: 0,
      openPullRequests: 0,
      commits: 0,
      commitsByDay: {},
      createdAt: "2025-01-01T00:00:00Z",
      pushedAt: null,
      topics: [],
      coAuthors: [],
    }));
    const full = normalizeMetrics(active);
    expect(full.buildingCount).toBe(48);
    expect(full.litRatio).toBeLessThanOrEqual(0.94);
    expect(full.continuity).toBe(1);
  });

  it("maps supported and unknown languages to architecture", () => {
    const families = {
      TypeScript: "glass",
      JavaScript: "glass",
      Python: "eco",
      Julia: "eco",
      Rust: "industrial",
      Go: "functional",
      Swift: "functional",
      Java: "monolith",
      C: "tech",
      "C++": "tech",
      HTML: "creative",
      CSS: "creative",
      Vue: "creative",
      GLSL: "neon",
      Markdown: "library",
      Shell: "operations",
      Bash: "operations",
      PowerShell: "operations",
      SQL: "data",
      GraphQL: "data",
    } as const;
    for (const [language, architecture] of Object.entries(families)) {
      expect(languageStyle(language).architecture).toBe(architecture);
    }
    expect(languageStyle("NotALanguage").architecture).toBe("brick");
    expect(languageStyle("NotALanguage")).toEqual(languageStyle(null));
  });

  it("keeps every measured language in the normalized profile mix", () => {
    const snapshot = createQuietSnapshot("polyglot", "fixture");
    snapshot.languages = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [
        `Language-${index}`,
        100 - index,
      ]),
    );
    const mix = normalizeMetrics(snapshot).languageMix;
    expect(mix).toHaveLength(12);
    expect(mix[0]?.name).toBe("Language-0");
    expect(mix.reduce((total, { share }) => total + share, 0)).toBeCloseTo(1);
  });

  it("calculates current and longest streaks", () => {
    const days = {
      "2026-01-01": 1,
      "2026-01-02": 2,
      "2026-01-04": 1,
      "2026-01-05": 1,
    };
    expect(calculateStreaks(days, new Date("2026-01-05T12:00:00Z"))).toEqual({
      current: 2,
      longest: 2,
    });
  });
});
