export type Zone = "residential" | "research" | "workshop" | "nature";

export interface RepositoryActivity {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  openIssues: number;
  openPullRequests: number;
  commits: number;
  commitsByDay: Record<string, number>;
  createdAt: string;
  pushedAt: string | null;
  topics: string[];
  coAuthors: string[];
}

export interface ActivitySnapshot {
  username: string;
  fetchedAt: string;
  periodDays: number;
  repositories: RepositoryActivity[];
  totalCommits: number;
  commitsByDay: Record<string, number>;
  lastCommitAt: string | null;
  currentStreak: number;
  longestStreak: number;
  totalStars: number;
  totalForks: number;
  openIssues: number;
  openPullRequests: number;
  languages: Record<string, number>;
  coAuthors: string[];
  // Public follower count; optional for snapshots created before v0.2.
  followers?: number;
  warnings: string[];
}

export interface NormalizedMetrics {
  activity: number;
  recentActivity: number;
  continuity: number;
  projectCount: number;
  popularity: number;
  maintenance: number;
  collaboration: number;
  // Followers, log-scaled.
  community: number;
  buildingCount: number;
  litRatio: number;
  languageMix: Array<{ name: string; share: number }>;
}

// Axis-aligned rectangle on the isometric ground grid (tile units).
export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Architectural family derived from a programming language.
export type Architecture =
  | "glass"
  | "eco"
  | "industrial"
  | "functional"
  | "monolith"
  | "tech"
  | "creative"
  | "neon"
  | "library"
  | "operations"
  | "data"
  | "brick";

export type WaterfrontKind = "harbor" | "garden" | "canal";

export type BuildingForm =
  "tower" | "midrise" | "house" | "workshop" | "stadium";

export type RepositoryDistinction = "active" | "newest" | "forked";

export interface RepositoryIdentity {
  name: string;
  fullName: string;
  topics: string[];
  topic: string | null;
  distinctions: RepositoryDistinction[];
}

export interface CityBuilding extends GridRect {
  id: string;
  // Wall height in pixels.
  height: number;
  zone: Zone;
  language: string;
  secondaryLanguages: string[];
  repositoryIds: number[];
  repository: RepositoryIdentity | null;
  architecture: Architecture;
  form: BuildingForm;
  color: string;
  roofColor: string;
  accent: string;
  // Under construction: rendered as a scaffold with a crane.
  construction: boolean;
  // The most-starred repository: crowned with a golden star.
  landmark: boolean;
  // Repository without a push for a year: rendered as an overgrown ruin.
  abandoned: boolean;
  // Seeded variation used for small details (windows, rooftop props).
  variant: number;
}

export type LotKind = "building" | "park" | "plaza" | "construction" | "grass";

export interface CityLot extends GridRect {
  kind: LotKind;
}

export interface CityTree {
  x: number;
  y: number;
  size: number;
  tone: number;
}

export interface CityPerson {
  x: number;
  y: number;
  // Walking axis in grid units; people walk back and forth seamlessly.
  dx: number;
  dy: number;
  phase: number;
  color: string;
}

export interface CityBoat {
  x: number;
  y: number;
  length: number;
  color: string;
  phase: number;
}

export interface CityCrane {
  x: number;
  y: number;
  height: number;
  jib: number;
  angle: number;
  phase: number;
  color: string;
}

export interface GridPoint {
  x: number;
  y: number;
}

export type Season = "spring" | "summer" | "autumn" | "winter";

// Streak lighthouse standing on a rock in the river.
export interface CityMonument {
  x: number;
  y: number;
  // Tower height in pixels, grows with the longest streak.
  height: number;
  // One red band per started week of the longest streak (max 6).
  rings: number;
  // A running streak keeps the beacon turning.
  lit: boolean;
  phase: number;
}

/**
 * Seeded coastline. Each array stores, per tile along one land edge, how far
 * the island reaches beyond the base square (negative values are bays).
 */

export interface Coastline {
  // Maximum reach beyond the base square in tiles.
  margin: number;
  // Edge y < 0, indexed by x + margin.
  north: number[];
  // Edge x < 0, indexed by y + margin.
  west: number[];
  // Edge y >= size, indexed by x + margin.
  south: number[];
}

export type VehicleKind = "car" | "bus" | "truck";

export interface TrafficLoop {
  // Closed polygon of road-center corners, traversed in order.
  corners: GridPoint[];
  carCount: number;
  /**
   * Vehicle styles repeat with this cycle. Each car advances exactly one cycle
   * of spacings per animation loop, so the last frame flows into the first.
   */
  vehicles: Array<{ color: string; kind: VehicleKind }>;
}

export interface CityLayout {
  // Grid size (tiles per platform edge).
  size: number;
  // First grid column (x) that is water.
  waterStart: number;
  roadsX: number[];
  roadsY: number[];
  // Width of one tile in pixels (tile height is half).
  tile: number;
  originX: number;
  originY: number;
  thickness: number;
  // Size of one sprite pixel in output pixels (the detail scale).
  unit: number;
  coast: Coastline;
}

export interface CityModel {
  width: number;
  height: number;
  username: string;
  seed: number;
  frameCount: number;
  fps: number;
  metrics: NormalizedMetrics;
  layout: CityLayout;
  lots: CityLot[];
  buildings: CityBuilding[];
  trees: CityTree[];
  people: CityPerson[];
  boats: CityBoat[];
  cranes: CityCrane[];
  traffic: TrafficLoop[];
  plane: boolean;
  bridge: boolean;
  // Label printed on the animated airship, or null for empty cities.
  zeppelin: string | null;
  // Dominant language also colors the river's small highlights.
  waterLanguage: string | null;
  waterAccent: string;
  waterfront: WaterfrontKind;
  // Season of the most active quarter: tints trees and ground.
  season: Season;
  monument: CityMonument | null;
  // Detail scale: the scene is drawn natively at `scale` times the base size.
  scale: number;
  // No public activity at all: an empty meadow island.
  empty: boolean;
}

export interface GenerateOptions {
  width: number;
  height: number;
  frames: number;
  fps: number;
  days: number;
  // Detail scale (1-4): output is width × scale by height × scale with finer pixels.
  scale: number;
  seed?: string;
}
