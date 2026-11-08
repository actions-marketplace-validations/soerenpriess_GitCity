import type { ActivitySnapshot, Zone } from "../types.js";

// Days without a push after which a repository's building falls into ruin. */
export const ABANDONED_AFTER_DAYS = 365;

export function isAbandoned(
  repository: ActivitySnapshot["repositories"][number],
  referenceDate: Date,
): boolean {
  if (!repository.pushedAt) return false;
  const pushed = Date.parse(repository.pushedAt);
  return (
    Number.isFinite(pushed) &&
    referenceDate.getTime() - pushed > ABANDONED_AFTER_DAYS * 86_400_000
  );
}

export function zoneForRepository(
  repository: ActivitySnapshot["repositories"][number],
  index: number,
  referenceDate: Date,
): Zone {
  const referenceTime = referenceDate.getTime();
  const ageDays =
    (referenceTime - new Date(repository.createdAt).getTime()) / 86_400_000;
  if (
    repository.pushedAt &&
    referenceTime - new Date(repository.pushedAt).getTime() < 45 * 86_400_000
  ) {
    return repository.openIssues > 0 ? "workshop" : "research";
  }
  if (
    ageDays < 120 ||
    repository.topics.some((topic) => /ai|research|experiment|ml/i.test(topic))
  ) {
    return "research";
  }
  return index % 4 === 3 ? "nature" : "residential";
}
