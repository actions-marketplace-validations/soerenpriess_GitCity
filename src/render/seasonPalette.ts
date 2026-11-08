import type { Season } from "../types.js";

export interface SeasonPalette {
  grass: string;
  // Top band of the island's cliffs. */
  rim: string;
  park: string;
  meadow: string;
  // Canopy colors by tree tone. */
  trees: readonly string[];
  // Highlight drawn on the upper canopy (snow in winter, blossoms in spring). */
  highlight: string | null;
}

export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  spring: {
    grass: "#93d06a",
    rim: "#7cbd57",
    park: "#80c65a",
    meadow: "#a3d978",
    trees: ["#f2a3c2", "#7fcf5a", "#9be06a"],
    highlight: "#fde1ec",
  },
  summer: {
    grass: "#8fcb6b",
    rim: "#79b85a",
    park: "#7cc25c",
    meadow: "#98d070",
    trees: ["#4caf50", "#3d9a5c", "#6cbf4a"],
    highlight: null,
  },
  autumn: {
    grass: "#a9c062",
    rim: "#95ab55",
    park: "#9cb65a",
    meadow: "#b8c76e",
    trees: ["#e0892f", "#c8553a", "#e9b93c"],
    highlight: null,
  },
  winter: {
    grass: "#e4edf1",
    rim: "#c9d8e0",
    park: "#d6e3ea",
    meadow: "#edf3f6",
    trees: ["#3f8060", "#2f6f55", "#4c8a5e"],
    highlight: "#f4f8fa",
  },
};
