import type { ActivitySnapshot, Season } from "../types.js";

const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

// Meteorological seasons of the northern hemisphere, by UTC month (0-11). */
export function seasonOfMonth(month: number): Season {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

/**
 * The season in which the profile committed the most. Ties keep the earlier
 * season in spring-to-winter order; profiles without commits fall back to
 * the season of the snapshot date.
 */
export function seasonFor(snapshot: ActivitySnapshot): Season {
  const totals = new Map<Season, number>();
  for (const [day, count] of Object.entries(snapshot.commitsByDay)) {
    const month = Number(day.slice(5, 7)) - 1;
    if (!Number.isInteger(month) || month < 0 || month > 11 || count <= 0)
      continue;
    const season = seasonOfMonth(month);
    totals.set(season, (totals.get(season) ?? 0) + count);
  }
  let best: Season | null = null;
  for (const season of SEASONS) {
    const total = totals.get(season) ?? 0;
    if (total > 0 && (best === null || total > totals.get(best)!))
      best = season;
  }
  return best ?? seasonOfMonth(new Date(snapshot.fetchedAt).getUTCMonth());
}
