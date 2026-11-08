import { languageStyle } from "../analysis/languagePalette.js";
import { shade } from "../render/pixelArt.js";
import type {
  ActivitySnapshot,
  Architecture,
  BuildingForm,
  CityBuilding,
  CityCrane,
  CityLayout,
  CityLot,
  CityTree,
  GridRect,
  NormalizedMetrics,
  Zone,
} from "../types.js";
import { cityBlocks, subdivide } from "./grid.js";
import { mulberry32 } from "./seed.js";
import { isAbandoned, zoneForRepository } from "./zoning.js";
import { repositoryIdentities } from "./repositoryIdentity.js";

const CRANE_COLORS = ["#f2b632", "#e8743b", "#e04f5f"];
// Followers needed before the city gets a stadium. */
export const STADIUM_FOLLOWERS = 20;

// Facade variations per architectural family (the language color comes first). */
const FACADE_VARIANTS: Partial<Record<Architecture, string[]>> = {
  eco: ["#efe2c4", "#e9cfa8", "#f3e9d2", "#dcbf98"],
  industrial: ["#9aa3ad", "#8b9098", "#a7a097"],
  functional: ["#e8f1f4", "#cfe6ee", "#f4f7f8", "#bcd7e6"],
  creative: ["#f07aa0", "#ffb04a", "#7ad3f0", "#9b7bea", "#7be08a"],
  library: ["#efe4cc", "#e6d6b4", "#f3ead8"],
  brick: ["#b5654a", "#a8553f", "#c07a5a", "#a9a59c", "#bdb8ad"],
};

const ROOF_COLORS: Record<Architecture, string[]> = {
  glass: ["#dfe7ef"],
  eco: ["#5aa84a", "#4c9a52"],
  industrial: ["#c4562a", "#a8482a"],
  functional: ["#d6e2e8"],
  monolith: ["#8a5a3c", "#6e4a36"],
  tech: ["#454c58"],
  creative: ["#ffe066", "#7ad3f0", "#f07aa0"],
  neon: ["#1f1b33"],
  library: ["#8a4b3a", "#3f6e8a", "#5c7f4a"],
  operations: ["#4d596b", "#38546a", "#76634a"],
  data: ["#316b7b", "#3b647e", "#6c4b78"],
  brick: ["#d9604c", "#5c7bd9", "#7a7368", "#e58a3a"],
};

export interface District {
  lots: CityLot[];
  buildings: CityBuilding[];
  cranes: CityCrane[];
  trees: CityTree[];
}

interface Candidate {
  lot: GridRect;
  distance: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Infill language, weighted by the profile's language shares. */
function pickLanguage(metrics: NormalizedMetrics, roll: number): string {
  let accumulated = 0;
  for (const { name, share } of metrics.languageMix) {
    accumulated += share;
    if (roll <= accumulated) return name;
  }
  return metrics.languageMix[0]?.name ?? "";
}

function inset(rect: GridRect, amount: number): GridRect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    w: rect.w - amount * 2,
    h: rect.h - amount * 2,
  };
}

// Narrow tall towers to a slender footprint centred on their lot. */
function towerFootprint(rect: GridRect, maxSide: number): GridRect {
  const w = Math.min(rect.w, maxSide);
  const h = Math.min(rect.h, maxSide);
  return {
    x: rect.x + (rect.w - w) / 2,
    y: rect.y + (rect.h - h) / 2,
    w,
    h,
  };
}

function scatterTrees(
  lot: GridRect,
  count: number,
  random: () => number,
  trees: CityTree[],
): void {
  for (let index = 0; index < count; index += 1) {
    trees.push({
      x: lot.x + 0.4 + random() * (lot.w - 0.8),
      y: lot.y + 0.4 + random() * (lot.h - 0.8),
      size: 0.8 + random() * 0.5,
      tone: Math.floor(random() * 3),
    });
  }
}

function chooseForm(
  zone: Zone,
  architecture: Architecture,
  isRepository: boolean,
  weight: number,
  centrality: number,
  roll: number,
): BuildingForm {
  if (zone === "workshop") return "workshop";
  let form: BuildingForm;
  if (zone === "research") form = "tower";
  else if (isRepository)
    form = weight > 0.5 || centrality > 0.65 ? "tower" : "midrise";
  else form = centrality > 0.42 || roll < 0.2 ? "midrise" : "house";
  // Libraries and shops stay low; industrial outskirts become workshops.
  if (architecture === "library" && form === "tower") form = "midrise";
  if (architecture === "industrial" && form === "house" && roll < 0.5)
    form = "workshop";
  return form;
}

function heightFor(
  form: BuildingForm,
  architecture: Architecture,
  tile: number,
  tower: number,
  weight: number,
  centrality: number,
  random: () => number,
): number {
  switch (form) {
    case "tower": {
      const scale =
        (0.55 + weight * 0.45) *
        (0.7 + centrality * 0.3) *
        (0.8 + random() * 0.3);
      const family =
        architecture === "creative" ? 0.8 : architecture === "eco" ? 0.85 : 1;
      return Math.max(tile * 3, tower * scale * family);
    }
    case "midrise": {
      const base = tile * (1.4 + random() * 1.1) * (0.75 + centrality * 0.45);
      if (architecture === "library") return Math.min(base, tile * 2.2);
      if (architecture === "monolith") return base * 1.2;
      return base;
    }
    case "workshop":
      return tile * (1.2 + weight * 1.1 + random() * 0.4);
    default:
      return tile * (0.9 + random() * 0.6);
  }
}

export function createDistrict(
  snapshot: ActivitySnapshot,
  metrics: NormalizedMetrics,
  layout: CityLayout,
  seed: number,
): District {
  const random = mulberry32(seed ^ 0xc17e);
  const centerX = layout.waterStart * 0.48;
  const centerY = layout.size * 0.44;
  const candidates: Candidate[] = cityBlocks(layout)
    .flatMap((block) => subdivide(block, random))
    .map((lot) => ({
      lot,
      distance:
        Math.hypot(lot.x + lot.w / 2 - centerX, lot.y + lot.h / 2 - centerY) +
        random() * 1.6,
    }))
    .sort((a, b) => a.distance - b.distance);
  const lots: CityLot[] = [];
  const buildings: CityBuilding[] = [];
  const cranes: CityCrane[] = [];
  const trees: CityTree[] = [];
  if (candidates.length === 0) return { lots, buildings, cranes, trees };

  const maxDistance = Math.max(...candidates.map(({ distance }) => distance));
  const referenceDate = new Date(snapshot.fetchedAt);
  const repositories = [...snapshot.repositories].sort(
    (a, b) => b.commits - a.commits || a.name.localeCompare(b.name),
  );
  const maxCommits = Math.max(1, ...repositories.map(({ commits }) => commits));
  const identities = repositoryIdentities(repositories);
  const landmarkId = [...snapshot.repositories]
    .filter(({ stars }) => stars > 0)
    .sort((a, b) => b.stars - a.stars || a.id - b.id)[0]?.id;
  // Busier profiles develop more of the platform; the rest becomes parkland.
  const fill = clamp(
    Math.max((metrics.buildingCount - 6) / 42, metrics.activity * 0.85),
    0,
    1,
  );
  const developed = Math.min(
    Math.max(1, candidates.length - 3),
    Math.max(
      repositories.length,
      Math.round(candidates.length * (0.28 + 0.62 * fill)),
    ),
  );
  // Open issues become construction sites; open pull requests become trucks.
  const constructionSites = clamp(
    Math.round(
      Math.log1p(snapshot.openIssues) * 1.1 + metrics.recentActivity * 1.2,
    ),
    snapshot.openIssues > 0 ? 1 : 0,
    4,
  );
  const tower = layout.tile * (4 + metrics.activity * 8);
  const undeveloped = candidates.slice(developed);
  const stadiumLot =
    (snapshot.followers ?? 0) >= STADIUM_FOLLOWERS
      ? ([...undeveloped].sort(
          (a, b) => b.lot.w * b.lot.h - a.lot.w * a.lot.h,
        )[0]?.lot ?? null)
      : null;

  // Keep rooftops inside the canvas: the back corner of a lot limits height.
  const maxHeightFor = (rect: GridRect): number =>
    Math.max(
      layout.tile,
      layout.originY +
        ((rect.x + rect.y) * layout.tile) / 4 -
        layout.tile * 1.5,
    );

  let constructionIndex = 0;
  candidates.forEach(({ lot, distance }, index) => {
    const centrality = 1 - distance / maxDistance;
    const repository = repositories[index];
    if (index >= developed) {
      if (lot === stadiumLot) {
        lots.push({ ...lot, kind: "plaza" });
        buildings.push({
          ...inset(lot, 0.12),
          id: "stadium",
          height: Math.round(layout.tile * 0.9),
          zone: "residential",
          language: "",
          secondaryLanguages: [],
          repositoryIds: [],
          repository: null,
          architecture: "functional",
          form: "stadium",
          color: "#e8ecef",
          roofColor: "#5fb85a",
          accent: "#e04f5f",
          construction: false,
          landmark: false,
          abandoned: false,
          variant: Math.floor(random() * 1000),
        });
        return;
      }
      if (constructionIndex < constructionSites) {
        lots.push({ ...lot, kind: "construction" });
        buildings.push({
          ...inset(lot, 0.25),
          id: `site-${constructionIndex}`,
          height: Math.round(layout.tile * (1 + random() * 1.5)),
          zone: "workshop",
          language: "",
          secondaryLanguages: [],
          repositoryIds: [],
          repository: null,
          architecture: "brick",
          form: "midrise",
          color: "#b9b2a6",
          roofColor: "#9a9284",
          accent: "#f2b632",
          construction: true,
          landmark: false,
          abandoned: false,
          variant: Math.floor(random() * 1000),
        });
        cranes.push({
          x: lot.x + 0.12,
          y: lot.y + lot.h - 0.12,
          height: Math.round(
            Math.min(
              maxHeightFor(lot) - layout.tile * 0.5,
              layout.tile * (5 + random() * 2.5),
            ),
          ),
          jib: 2.6 + random() * 1.2,
          angle: random() * Math.PI * 2,
          phase: random() * Math.PI * 2,
          color: CRANE_COLORS[constructionIndex % CRANE_COLORS.length]!,
        });
        constructionIndex += 1;
        return;
      }
      const park = random() < 0.45 + (1 - metrics.activity) * 0.25;
      lots.push({ ...lot, kind: park ? "park" : "grass" });
      scatterTrees(
        lot,
        park
          ? 2 + Math.floor(random() * (lot.w * lot.h * 0.5))
          : Math.floor(random() * 2.5),
        random,
        trees,
      );
      return;
    }

    const weight = repository
      ? Math.log1p(repository.commits) / Math.log1p(maxCommits)
      : random() * 0.6;
    const language = repository
      ? (repository.primaryLanguage ?? "")
      : pickLanguage(metrics, random());
    const roll = random();
    let zone: Zone;
    if (repository) {
      zone = zoneForRepository(repository, index, referenceDate);
    } else if (centrality > 0.68) {
      zone = roll < 0.15 + metrics.activity * 0.7 ? "research" : "residential";
    } else if (centrality > 0.38 || roll < 0.72) {
      zone = "residential";
    } else {
      zone = "workshop";
    }
    const landmark = repository !== undefined && repository.id === landmarkId;
    const identity = repository ? identities.get(repository.id)! : null;
    // Forgotten repositories stay on the map as ruins instead of parkland.
    const abandoned =
      repository !== undefined &&
      !landmark &&
      isAbandoned(repository, referenceDate);
    if (
      zone === "nature" &&
      !abandoned &&
      !landmark &&
      !identity?.distinctions.length
    ) {
      lots.push({ ...lot, kind: "park" });
      scatterTrees(lot, 3 + Math.floor(random() * 3), random, trees);
      return;
    }

    const style = languageStyle(language);
    const { architecture } = style;
    const variant = Math.floor(random() * 1000);
    let form = chooseForm(
      zone,
      architecture,
      repository !== undefined,
      weight,
      centrality,
      roll,
    );
    if (landmark && architecture !== "library") form = "tower";
    let height = heightFor(
      form,
      architecture,
      layout.tile,
      tower,
      landmark ? 1 : weight,
      landmark ? Math.max(centrality, 0.8) : centrality,
      random,
    );
    if (landmark) height *= 1.15;
    if (abandoned) {
      form = weight > 0.4 ? "midrise" : "house";
      height = layout.tile * (1.1 + weight + random() * 0.5);
    }

    const variants = FACADE_VARIANTS[architecture];
    const color =
      variants && (!repository || variant % 3 === 0)
        ? variants[variant % variants.length]!
        : shade(style.facade, (random() - 0.5) * 0.14);
    const roofs = ROOF_COLORS[architecture];
    let footprint = inset(lot, architecture === "monolith" ? 0.1 : 0.18);
    if (form === "tower" && height > layout.tile * 4.5) {
      footprint = towerFootprint(
        footprint,
        architecture === "monolith" ? 2.6 : 2,
      );
    }
    lots.push({ ...lot, kind: abandoned ? "grass" : "plaza" });
    buildings.push({
      ...footprint,
      id: repository ? `repo-${repository.id}` : `infill-${index}`,
      height: Math.round(clamp(height, layout.tile * 0.8, maxHeightFor(lot))),
      zone,
      language,
      secondaryLanguages: repository
        ? Object.entries(repository.languages)
            .filter(([name, bytes]) => name !== language && bytes > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)
        : [],
      repositoryIds: repository ? [repository.id] : [],
      repository: identity,
      architecture,
      form,
      color,
      roofColor: roofs[variant % roofs.length]!,
      accent: style.accent,
      construction: false,
      landmark,
      abandoned,
      variant,
    });
  });

  return { lots, buildings, cranes, trees };
}
