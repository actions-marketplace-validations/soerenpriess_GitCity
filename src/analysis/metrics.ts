import type { ActivitySnapshot, NormalizedMetrics } from "../types.js";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const logScale = (value: number, ceiling: number): number =>
  clamp(Math.log1p(Math.max(0, value)) / Math.log1p(ceiling), 0, 1);

export function countRecentCommits(
  snapshot: ActivitySnapshot,
  days = 30,
  referenceDate = new Date(snapshot.fetchedAt),
): number {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return Object.entries(snapshot.commitsByDay).reduce((sum, [day, count]) => {
    return new Date(`${day}T00:00:00Z`) >= cutoff ? sum + count : sum;
  }, 0);
}

export function normalizeMetrics(
  snapshot: ActivitySnapshot,
): NormalizedMetrics {
  const recent = countRecentCommits(snapshot);
  const projectCount = snapshot.repositories.length;
  const languageMix = Object.entries(snapshot.languages)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalBytes =
    languageMix.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const buildingCount = clamp(
    Math.round(
      6 +
        Math.log2(snapshot.totalCommits + 1) * 2 +
        Math.sqrt(projectCount) * 1.5,
    ),
    6,
    48,
  );
  const collaborations = snapshot.coAuthors.length;

  return {
    activity: logScale(snapshot.totalCommits, 5000),
    recentActivity: logScale(recent, 180),
    continuity: clamp(snapshot.currentStreak / 30, 0, 1),
    projectCount: logScale(projectCount, 50),
    popularity: logScale(snapshot.totalStars + snapshot.totalForks * 2, 1000),
    maintenance: logScale(snapshot.openIssues + snapshot.openPullRequests, 100),
    collaboration: logScale(collaborations, 30),
    community: logScale(snapshot.followers ?? 0, 2000),
    buildingCount,
    litRatio: clamp(
      0.18 +
        logScale(recent, 120) * 0.62 +
        (snapshot.currentStreak > 0 ? 0.12 : 0),
      0.12,
      0.94,
    ),
    languageMix: languageMix.map(([name, bytes]) => ({
      name,
      share: bytes / totalBytes,
    })),
  };
}
