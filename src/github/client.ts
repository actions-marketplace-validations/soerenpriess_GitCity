import { ResponseCache } from "./cache.js";

const API_ROOT = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubClient {
  private readonly cache: ResponseCache;

  constructor(token?: string, noCache = false) {
    this.token = token;
    this.cache = new ResponseCache(undefined, undefined, noCache);
  }

  private readonly token: string | undefined;

  async get<T>(path: string): Promise<T> {
    const url = path.startsWith("http") ? path : `${API_ROOT}${path}`;
    const cached = await this.cache.get(url);
    if (cached) return JSON.parse(cached) as T;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    const body = await response.text();
    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = response.headers.get("x-ratelimit-reset");
      if (response.status === 403 && remaining === "0") {
        const resetAt = reset
          ? new Date(Number(reset) * 1000).toISOString()
          : "unknown";
        throw new GitHubApiError(
          `GitHub API rate limit reached. It resets at ${resetAt}.`,
          403,
          resetAt,
        );
      }
      throw new GitHubApiError(
        `GitHub API request failed (${response.status} ${response.statusText}): ${body.slice(0, 240)}`,
        response.status,
      );
    }
    await this.cache.set(url, body);
    return JSON.parse(body) as T;
  }
}
