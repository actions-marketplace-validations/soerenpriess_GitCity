import type { ActivitySnapshot, CityLayout, CityMonument } from "../types.js";
import { project } from "./grid.js";

/** Shortest longest-streak (in days) that earns a lighthouse. */
export const MONUMENT_MIN_STREAK = 3;
const STREAK_FOR_FULL_HEIGHT = 100;

/**
 * Streak lighthouse on a rock at the back end of the river. Its height and
 * red bands record the longest streak; a running streak lights the beacon.
 */
export function createMonument(
  snapshot: ActivitySnapshot,
  layout: CityLayout,
  random: () => number,
): CityMonument | null {
  const longest = snapshot.longestStreak;
  if (longest < MONUMENT_MIN_STREAK) return null;
  const x = layout.waterStart + (layout.size - layout.waterStart) / 2;
  const y = 1.2;
  const growth = Math.min(
    1,
    Math.log1p(longest) / Math.log1p(STREAK_FOR_FULL_HEIGHT),
  );
  // Leave room above the lantern so the tower never leaves the canvas.
  const headroom = project(layout, x, y).y - layout.tile * 1.5;
  return {
    x,
    y,
    height: Math.round(
      Math.max(
        layout.tile * 1.5,
        Math.min(headroom, layout.tile * (1.8 + growth * 3.6)),
      ),
    ),
    rings: Math.min(6, Math.ceil(longest / 7)),
    lit: snapshot.currentStreak > 0,
    phase: random(),
  };
}
