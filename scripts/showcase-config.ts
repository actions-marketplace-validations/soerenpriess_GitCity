import vueGarden from "../assets/examples/vue-garden.json" with { type: "json" };
import shellHarbor from "../assets/examples/shell-harbor.json" with { type: "json" };
import sqlHarbor from "../assets/examples/sql-harbor.json" with { type: "json" };
import oldTown from "../assets/examples/old-town.json" with { type: "json" };
import growthEmpty from "../assets/examples/growth-empty.json" with { type: "json" };
import growthVillage from "../assets/examples/growth-village.json" with { type: "json" };
import growthTown from "../assets/examples/growth-town.json" with { type: "json" };
import growthActive from "../assets/examples/growth-active.json" with { type: "json" };
import type { ActivitySnapshot } from "../src/types.js";

export const SHOWCASE_EXAMPLES = [
  "vue-garden",
  "shell-harbor",
  "sql-harbor",
  "old-town",
] as const;

export const LIFECYCLE_STAGES = [
  "growth-empty",
  "growth-village",
  "growth-town",
  "growth-active",
] as const;

export const LIFECYCLE_SEED = "growth-lifecycle";

export type ExampleName =
  (typeof SHOWCASE_EXAMPLES)[number] | (typeof LIFECYCLE_STAGES)[number];

export const SHOWCASE_SNAPSHOTS: Record<ExampleName, ActivitySnapshot> = {
  "vue-garden": vueGarden,
  "shell-harbor": shellHarbor,
  "sql-harbor": sqlHarbor,
  "old-town": oldTown,
  "growth-empty": growthEmpty,
  "growth-village": growthVillage,
  "growth-town": growthTown,
  "growth-active": growthActive,
};
