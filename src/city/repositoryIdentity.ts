import type {
  RepositoryActivity,
  RepositoryDistinction,
  RepositoryIdentity,
} from "../types.js";

const TOPIC_GROUPS: Record<string, readonly string[]> = {
  game: [
    "game",
    "gaming",
    "gamedev",
    "game-development",
    "game-engine",
    "unity",
    "godot",
    "unreal-engine",
  ],
  api: ["api", "rest-api", "restful-api", "graphql", "backend"],
  cli: ["cli", "command-line", "command-line-tool", "terminal", "shell"],
  web: ["web", "website", "frontend", "react", "vue", "svelte", "astro"],
  research: [
    "research",
    "ai",
    "ml",
    "machine-learning",
    "deep-learning",
    "data-science",
    "experiment",
  ],
  library: ["library", "libraries", "sdk", "package", "framework"],
};

export function repositoryTopic(topics: readonly string[]): string | null {
  const normalized = topics
    .map((topic) => topic.trim().toLowerCase())
    .filter(Boolean);
  for (const topic of normalized) {
    for (const [group, aliases] of Object.entries(TOPIC_GROUPS)) {
      if (aliases.includes(topic)) return group;
    }
  }
  return normalized[0] ?? null;
}

export function repositoryIdentities(
  repositories: readonly RepositoryActivity[],
): Map<number, RepositoryIdentity> {
  const created = new Map<number, number>();
  for (const repository of repositories) {
    const timestamp = Date.parse(repository.createdAt);
    if (!Number.isFinite(timestamp)) {
      throw new Error(
        `Invalid createdAt for repository ${repository.fullName}: ${repository.createdAt}`,
      );
    }
    created.set(repository.id, timestamp);
  }
  const mostActive = [...repositories]
    .filter(({ commits }) => commits > 0)
    .sort((a, b) => b.commits - a.commits || a.id - b.id)[0]?.id;
  const newest = [...repositories].sort(
    (a, b) => created.get(b.id)! - created.get(a.id)! || a.id - b.id,
  )[0]?.id;
  const mostForked = [...repositories]
    .filter(({ forks }) => forks > 0)
    .sort((a, b) => b.forks - a.forks || a.id - b.id)[0]?.id;

  return new Map(
    repositories.map((repository) => {
      const distinctions: RepositoryDistinction[] = [];
      if (repository.id === mostActive) distinctions.push("active");
      if (repository.id === newest) distinctions.push("newest");
      if (repository.id === mostForked) distinctions.push("forked");
      return [
        repository.id,
        {
          name: repository.name,
          fullName: repository.fullName,
          topics: [...repository.topics],
          topic: repositoryTopic(repository.topics),
          distinctions,
        },
      ];
    }),
  );
}
