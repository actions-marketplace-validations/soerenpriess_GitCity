import { generateCity } from "./city/cityGenerator.js";
import { renderFrame } from "./render/canvasRenderer.js";
import type { ActivitySnapshot } from "./types.js";

const sample: ActivitySnapshot = {
  username: "octocat",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  periodDays: 365,
  repositories: [
    {
      id: 1,
      name: "city-core",
      fullName: "octocat/city-core",
      description: null,
      primaryLanguage: "TypeScript",
      languages: { TypeScript: 8200 },
      stars: 44,
      forks: 9,
      openIssues: 3,
      openPullRequests: 2,
      commits: 62,
      commitsByDay: {},
      createdAt: "2024-01-01T00:00:00Z",
      pushedAt: "2026-01-01T00:00:00Z",
      topics: ["creative-coding"],
      coAuthors: [],
    },
    {
      id: 2,
      name: "greenhouse",
      fullName: "octocat/greenhouse",
      description: null,
      primaryLanguage: "Python",
      languages: { Python: 7000 },
      stars: 18,
      forks: 4,
      openIssues: 1,
      openPullRequests: 0,
      commits: 22,
      commitsByDay: {},
      createdAt: "2025-03-01T00:00:00Z",
      pushedAt: "2025-12-29T00:00:00Z",
      topics: ["research"],
      coAuthors: [],
    },
    {
      id: 3,
      name: "engine",
      fullName: "octocat/engine",
      description: null,
      primaryLanguage: "Rust",
      languages: { Rust: 6300 },
      stars: 28,
      forks: 5,
      openIssues: 2,
      openPullRequests: 1,
      commits: 48,
      commitsByDay: {},
      createdAt: "2024-04-01T00:00:00Z",
      pushedAt: "2025-12-30T00:00:00Z",
      topics: [],
      coAuthors: [],
    },
  ],
  totalCommits: 132,
  commitsByDay: { "2025-12-29": 4, "2025-12-30": 5, "2025-12-31": 3 },
  lastCommitAt: "2025-12-31T12:00:00.000Z",
  currentStreak: 3,
  longestStreak: 12,
  totalStars: 90,
  totalForks: 18,
  openIssues: 6,
  openPullRequests: 3,
  languages: { TypeScript: 8200, Python: 7000, Rust: 6300 },
  coAuthors: ["octo-friend"],
  warnings: [],
};

const canvas = document.querySelector<HTMLCanvasElement>("#city");
if (!canvas) throw new Error("Could not find the city preview canvas.");
const context =
  canvas.getContext("2d") ??
  (() => {
    throw new Error("Could not initialize the city preview canvas.");
  })();
const city = generateCity(sample, { seed: "browser-preview" });
document.querySelectorAll<HTMLButtonElement>("[data-bg]").forEach((button) => {
  button.addEventListener("click", () => {
    canvas.className = `bg-${button.dataset.bg ?? "teal"}`;
  });
});

let frame = 0;
function animate(): void {
  renderFrame(context, city, frame);
  frame = (frame + 1) % city.frameCount;
  window.setTimeout(() => requestAnimationFrame(animate), 1000 / city.fps);
}
animate();
