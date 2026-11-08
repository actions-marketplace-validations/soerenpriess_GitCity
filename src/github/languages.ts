import { GitHubClient } from "./client.js";

export async function fetchLanguages(
  client: GitHubClient,
  fullName: string,
): Promise<Record<string, number>> {
  return client.get<Record<string, number>>(`/repos/${fullName}/languages`);
}
