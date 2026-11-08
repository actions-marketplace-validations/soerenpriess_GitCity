import type { RepositoryActivity } from "../types.js";
import { GitHubClient } from "./client.js";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  pushed_at: string | null;
  topics?: string[];
}

export async function listUserRepositories(
  client: GitHubClient,
  username: string,
): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await client.get<GitHubRepository[]>(
      `/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=100&page=${page}`,
    );
    repositories.push(...result);
    if (result.length < 100) break;
  }
  return repositories;
}

export function emptyRepository(
  repository: GitHubRepository,
): RepositoryActivity {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    primaryLanguage: repository.language,
    languages: {},
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: 0,
    openPullRequests: 0,
    commits: 0,
    commitsByDay: {},
    createdAt: repository.created_at,
    pushedAt: repository.pushed_at,
    topics: repository.topics ?? [],
    coAuthors: [],
  };
}
