import { calculateStreaks } from "../analysis/streaks.js";
import type { ActivitySnapshot, RepositoryActivity } from "../types.js";
import { GitHubClient } from "./client.js";
import { fetchLanguages } from "./languages.js";
import { emptyRepository, listUserRepositories } from "./repositories.js";
import type { GitHubRepository } from "./repositories.js";

interface CommitRecord {
  commit: {
    author: { date: string; name: string } | null;
    message: string;
  };
}

interface IssueRecord {
  pull_request?: unknown;
}

async function analyzeRepository(
  client: GitHubClient,
  repository: GitHubRepository,
  username: string,
  since: string,
): Promise<RepositoryActivity> {
  const result = emptyRepository(repository);
  const [languages, commits, issues] = await Promise.all([
    fetchLanguages(client, repository.full_name),
    client.get<CommitRecord[]>(
      `/repos/${repository.full_name}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(since)}&per_page=100`,
    ),
    client.get<IssueRecord[]>(
      `/repos/${repository.full_name}/issues?state=open&per_page=100`,
    ),
  ]);
  result.languages = languages;
  result.commits = commits.length;
  for (const commit of commits) {
    const date = commit.commit.author?.date.slice(0, 10);
    if (date) result.commitsByDay[date] = (result.commitsByDay[date] ?? 0) + 1;
    const coAuthors = commit.commit.message.matchAll(
      /^Co-authored-by:\s*(.+?)(?:\s*<[^>]+>)?$/gim,
    );
    for (const [, name] of coAuthors) {
      if (name) result.coAuthors.push(name.trim());
    }
  }
  result.openIssues = issues.filter((issue) => !issue.pull_request).length;
  result.openPullRequests = issues.filter((issue) =>
    Boolean(issue.pull_request),
  ).length;
  result.coAuthors = [...new Set(result.coAuthors)];
  return result;
}

export async function fetchActivity(
  client: GitHubClient,
  username: string,
  periodDays: number,
): Promise<ActivitySnapshot> {
  const [baseRepositories, followers] = await Promise.all([
    listUserRepositories(client, username),
    client
      .get<{ followers?: number }>(`/users/${encodeURIComponent(username)}`)
      .then((user) => user.followers ?? 0)
      .catch(() => 0),
  ]);
  const selected = baseRepositories
    .filter((repository) => repository.pushed_at)
    .slice(0, 15);
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - periodDays);
  const since = sinceDate.toISOString();
  const warnings: string[] = [];

  const detailed = await Promise.all(
    selected.map(async (repository) => {
      try {
        return await analyzeRepository(client, repository, username, since);
      } catch (error) {
        warnings.push(
          `${repository.full_name}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return emptyRepository(repository);
      }
    }),
  );
  const detailsById = new Map(
    detailed.map((repository) => [repository.id, repository]),
  );
  const repositories = baseRepositories.map((repository) => {
    return detailsById.get(repository.id) ?? emptyRepository(repository);
  });
  const commitsByDay: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const coAuthors = new Set<string>();
  for (const repository of repositories) {
    for (const [date, count] of Object.entries(repository.commitsByDay)) {
      commitsByDay[date] = (commitsByDay[date] ?? 0) + count;
    }
    for (const [language, bytes] of Object.entries(repository.languages)) {
      languages[language] = (languages[language] ?? 0) + bytes;
    }
    repository.coAuthors.forEach((name) => coAuthors.add(name));
  }
  const commitDays = Object.keys(commitsByDay).sort();
  const streaks = calculateStreaks(commitsByDay);
  return {
    username,
    fetchedAt: new Date().toISOString(),
    periodDays,
    repositories,
    totalCommits: Object.values(commitsByDay).reduce(
      (sum, count) => sum + count,
      0,
    ),
    commitsByDay,
    lastCommitAt: commitDays.length
      ? `${commitDays[commitDays.length - 1]}T12:00:00Z`
      : null,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    totalStars: baseRepositories.reduce(
      (sum, repository) => sum + repository.stargazers_count,
      0,
    ),
    totalForks: baseRepositories.reduce(
      (sum, repository) => sum + repository.forks_count,
      0,
    ),
    openIssues: repositories.reduce(
      (sum, repository) => sum + repository.openIssues,
      0,
    ),
    openPullRequests: repositories.reduce(
      (sum, repository) => sum + repository.openPullRequests,
      0,
    ),
    languages,
    coAuthors: [...coAuthors],
    followers,
    warnings,
  };
}
