import { normalizeMetrics } from "../analysis/metrics.js";
import {
  DEFAULT_OPTIONS,
  METRICS_SNAPSHOT_VERSION,
  validateOptions,
} from "../config.js";
import type {
  ActivitySnapshot,
  CityBoat,
  CityLayout,
  CityModel,
  CityPerson,
  CityTree,
  GenerateOptions,
  WaterfrontKind,
} from "../types.js";
import { languageStyle } from "../analysis/languagePalette.js";
import { createDistrict } from "./buildings.js";
import {
  coastalTiles,
  createLayout,
  GRID_SIZE,
  isLand,
  MIN_GRID_SIZE,
} from "./grid.js";
import { createMonument } from "./monument.js";
import { seasonFor } from "./seasons.js";
import { hashString, mulberry32 } from "./seed.js";
import { createTraffic } from "./traffic.js";

// The airship advertises the application itself. */
export const AIRSHIP_LABEL = "GIT CITY";

const PEOPLE_COLORS = [
  "#e04f5f",
  "#4f8fe0",
  "#f2c94c",
  "#f7f3ea",
  "#9b6bd6",
  "#3fb39d",
];
const BOAT_COLORS = ["#f7f3ea", "#e04f5f", "#f2c94c", "#4f8fe0"];

function waterfrontFor(language: string | null): WaterfrontKind {
  const architecture = languageStyle(language).architecture;
  if (architecture === "data" || architecture === "operations") return "harbor";
  if (architecture === "eco" || architecture === "creative") return "garden";
  return "canal";
}

// Trees along the platform rim and the riverside promenade. */
function edgeTrees(layout: CityLayout, random: () => number): CityTree[] {
  const trees: CityTree[] = [];
  const add = (x: number, y: number): void => {
    trees.push({ x, y, size: 0.75 + random() * 0.35, tone: trees.length % 3 });
  };
  for (let index = 1; index < layout.waterStart - 1; index += 2) {
    if (random() < 0.7) add(index + 0.5, 0.5);
    if (random() < 0.7) add(index + 0.5, layout.size - 0.5);
  }
  for (let index = 2; index < layout.size - 1; index += 2) {
    if (random() < 0.7) add(0.5, index + 0.5);
  }
  for (let index = 2; index < layout.size - 2; index += 3) {
    add(layout.waterStart - 0.5, index + 0.5);
  }
  return trees.filter(({ x, y }) =>
    isLand(layout, Math.floor(x), Math.floor(y)),
  );
}

// Small woods on the seeded outcrops beyond the base square. */
function coastalTrees(layout: CityLayout, seed: number): CityTree[] {
  const random = mulberry32(seed ^ 0x7ee5);
  const trees: CityTree[] = [];
  for (const { x, y } of coastalTiles(layout)) {
    if (random() >= 0.42) continue;
    trees.push({
      x: x + 0.3 + random() * 0.4,
      y: y + 0.3 + random() * 0.4,
      size: 0.7 + random() * 0.45,
      tone: Math.floor(random() * 3),
    });
  }
  return trees;
}

// A handful of trees scattered across an untouched meadow. */
function meadowTrees(layout: CityLayout, random: () => number): CityTree[] {
  return Array.from({ length: 9 }, (_, index) => ({
    x: 1.5 + random() * (layout.waterStart - 3.5),
    y: 1.5 + random() * (layout.size - 3),
    size: 0.8 + random() * 0.5,
    tone: index % 3,
  }));
}

// Platform edge length: tiny accounts get a village, busy ones a metropolis. */
export function platformSize(
  metrics: ReturnType<typeof normalizeMetrics>,
  empty: boolean,
): number {
  if (empty) return MIN_GRID_SIZE;
  const growth = Math.min(
    1,
    metrics.activity * 0.6 +
      metrics.projectCount * 0.25 +
      metrics.popularity * 0.25 +
      metrics.community * 0.1,
  );
  return Math.round(
    MIN_GRID_SIZE + 2 + (GRID_SIZE - MIN_GRID_SIZE - 2) * growth,
  );
}

function createPeople(
  layout: CityLayout,
  count: number,
  random: () => number,
): CityPerson[] {
  return Array.from({ length: count }, (_, index) => {
    const color = PEOPLE_COLORS[index % PEOPLE_COLORS.length]!;
    const phase = random() * Math.PI * 2;
    if (index % 3 === 0) {
      return {
        x: layout.waterStart - 0.2,
        y: 2 + random() * (layout.size - 4),
        dx: 0,
        dy: 0.8,
        phase,
        color,
      };
    }
    const alongX = random() < 0.5;
    const road = alongX
      ? layout.roadsY[Math.floor(random() * layout.roadsY.length)]!
      : layout.roadsX[Math.floor(random() * layout.roadsX.length)]!;
    const side = random() < 0.5 ? -0.42 : 0.42;
    const span = alongX ? layout.waterStart - 2 : layout.size - 2;
    const position = 2 + random() * (span - 3);
    return {
      x: alongX ? position : road + 0.5 + side,
      y: alongX ? road + 0.5 + side : position,
      dx: alongX ? 0.8 : 0,
      dy: alongX ? 0 : 0.8,
      phase,
      color,
    };
  });
}

function createBoats(
  layout: CityLayout,
  count: number,
  random: () => number,
): CityBoat[] {
  const step = (layout.size - 4) / Math.max(1, count);
  return Array.from({ length: count }, (_, index) => ({
    x: layout.waterStart + 1.6 + random() * 0.9,
    y: 2.5 + step * index + random() * Math.max(0, step - 3),
    length: 1.3 + random() * 0.8,
    color: BOAT_COLORS[index % BOAT_COLORS.length]!,
    phase: random() * Math.PI * 2,
  }));
}

export function generateCity(
  snapshot: ActivitySnapshot,
  options: Partial<GenerateOptions> = {},
): CityModel {
  const resolved: GenerateOptions = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(resolved);
  const metrics = normalizeMetrics(snapshot);
  const snapshotKey = JSON.stringify({
    commits: snapshot.totalCommits,
    days: snapshot.commitsByDay,
    repos: snapshot.repositories.map(({ id, commits, primaryLanguage }) => [
      id,
      commits,
      primaryLanguage,
    ]),
  });
  const seed =
    resolved.seed === undefined
      ? hashString(
          `${snapshot.username}:${resolved.days}:${METRICS_SNAPSHOT_VERSION}:${snapshotKey}`,
        )
      : hashString(resolved.seed);
  const random = mulberry32(seed ^ 0x51de);
  const empty =
    snapshot.repositories.length === 0 && snapshot.totalCommits === 0;
  const layout = createLayout(
    resolved.width,
    resolved.height,
    platformSize(metrics, empty),
    !empty,
    seed,
    resolved.scale,
  );
  const width = resolved.width * resolved.scale;
  const height = resolved.height * resolved.scale;
  const season = seasonFor(snapshot);
  if (empty) {
    return {
      width,
      height,
      username: snapshot.username,
      seed,
      frameCount: resolved.frames,
      fps: resolved.fps,
      metrics,
      layout,
      lots: [],
      buildings: [],
      trees: [
        ...edgeTrees(layout, random),
        ...meadowTrees(layout, random),
        ...coastalTrees(layout, seed),
      ],
      people: [],
      boats: [],
      cranes: [],
      traffic: [],
      plane: false,
      bridge: false,
      zeppelin: null,
      waterLanguage: null,
      waterAccent: "#a6dcf7",
      waterfront: "garden",
      season,
      monument: null,
      scale: resolved.scale,
      empty,
    };
  }
  const district = createDistrict(snapshot, metrics, layout, seed);
  const waterLanguage = metrics.languageMix[0]?.name ?? null;
  const waterStyle = languageStyle(waterLanguage);
  const waterfront = waterfrontFor(waterLanguage);
  const trafficDensity = Math.max(
    metrics.recentActivity,
    metrics.maintenance * 0.8,
    0.1,
  );
  const peopleCount = Math.round(
    5 +
      metrics.popularity * 14 +
      metrics.continuity * 8 +
      metrics.community * 16,
  );
  const pullRequests = snapshot.openPullRequests;
  const truckShare =
    pullRequests > 0
      ? Math.min(0.8, 0.25 + Math.log1p(pullRequests) * 0.12)
      : 0;
  const boatCount = Math.min(
    4,
    1 +
      Math.round(metrics.collaboration * 2) +
      (snapshot.totalForks > 0 ? 1 : 0),
  );

  return {
    width,
    height,
    username: snapshot.username,
    seed,
    frameCount: resolved.frames,
    fps: resolved.fps,
    metrics,
    layout,
    lots: district.lots,
    buildings: district.buildings,
    trees: [
      ...edgeTrees(layout, random),
      ...district.trees,
      ...coastalTrees(layout, seed),
    ],
    people: createPeople(layout, peopleCount, random),
    boats: createBoats(layout, boatCount, random),
    cranes: district.cranes,
    traffic: createTraffic(
      layout,
      trafficDensity,
      resolved.frames,
      seed,
      truckShare,
    ),
    plane: snapshot.totalStars > 0 || metrics.popularity > 0.1,
    bridge: snapshot.coAuthors.length > 0,
    zeppelin: AIRSHIP_LABEL,
    waterLanguage,
    waterAccent: waterStyle.accent,
    waterfront,
    season,
    monument: createMonument(snapshot, layout, mulberry32(seed ^ 0x11e7)),
    scale: resolved.scale,
    empty,
  };
}

export function createQuietSnapshot(
  username: string,
  warning: string,
): ActivitySnapshot {
  return {
    username,
    fetchedAt: new Date().toISOString(),
    periodDays: 365,
    repositories: [],
    totalCommits: 0,
    commitsByDay: {},
    lastCommitAt: null,
    currentStreak: 0,
    longestStreak: 0,
    totalStars: 0,
    totalForks: 0,
    openIssues: 0,
    openPullRequests: 0,
    languages: {},
    coAuthors: [],
    followers: 0,
    warnings: [warning],
  };
}
