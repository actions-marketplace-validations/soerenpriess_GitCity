import { describe, expect, it } from "vitest";
import {
  repositoryIdentities,
  repositoryTopic,
} from "../src/city/repositoryIdentity.js";
import type { RepositoryActivity } from "../src/types.js";
import lively from "../assets/examples/lively.json";

function repository(
  id: number,
  overrides: Partial<RepositoryActivity> = {},
): RepositoryActivity {
  return {
    ...lively.repositories[0]!,
    id,
    name: `repo-${id}`,
    fullName: `developer/repo-${id}`,
    commits: 0,
    forks: 0,
    createdAt: "2020-01-01T00:00:00Z",
    topics: [],
    ...overrides,
  };
}

describe("repository identity", () => {
  it("preserves names and topics and distinguishes activity, age, and forks", () => {
    const repositories = [
      repository(1, { commits: 50, topics: ["rest-api"] }),
      repository(2, {
        createdAt: "2025-01-01T00:00:00Z",
        topics: ["command-line"],
      }),
      repository(3, { forks: 20, topics: ["game-engine"] }),
    ];
    const before = structuredClone(repositories);
    const identities = repositoryIdentities(repositories);
    expect(identities.get(1)).toEqual({
      name: "repo-1",
      fullName: "developer/repo-1",
      topics: ["rest-api"],
      topic: "api",
      distinctions: ["active"],
    });
    expect(identities.get(2)?.distinctions).toEqual(["newest"]);
    expect(identities.get(3)?.distinctions).toEqual(["forked"]);
    expect(identities.get(2)?.topic).toBe("cli");
    expect(identities.get(3)?.topic).toBe("game");
    expect(repositories).toEqual(before);
  });

  it("uses repository IDs to break ties independently of input order", () => {
    const repositories = [
      repository(2, { commits: 10, forks: 3 }),
      repository(1, { commits: 10, forks: 3 }),
    ];
    for (const input of [repositories, [...repositories].reverse()]) {
      const identities = repositoryIdentities(input);
      expect(identities.get(1)?.distinctions).toEqual([
        "active",
        "newest",
        "forked",
      ]);
      expect(identities.get(2)?.distinctions).toEqual([]);
    }
  });

  it("does not award activity or forks to zero-count repositories", () => {
    expect(repositoryIdentities([repository(1)]).get(1)?.distinctions).toEqual([
      "newest",
    ]);
    expect(repositoryIdentities([]).size).toBe(0);
  });

  it("recognizes exact topics without substring matches", () => {
    expect(repositoryTopic(["html"])).toBe("html");
    expect(repositoryTopic(["custom-tool", "Machine-Learning"])).toBe(
      "research",
    );
    expect(repositoryTopic([" SDK "])).toBe("library");
    expect(repositoryTopic(["custom-topic"])).toBe("custom-topic");
    expect(repositoryTopic([])).toBeNull();
  });

  it("reports invalid creation dates explicitly", () => {
    expect(() =>
      repositoryIdentities([repository(1, { createdAt: "invalid" })]),
    ).toThrow("Invalid createdAt for repository developer/repo-1");
  });
});
