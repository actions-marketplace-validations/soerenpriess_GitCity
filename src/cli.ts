#!/usr/bin/env node
import { createCanvas } from "@napi-rs/canvas";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DEFAULT_OPTIONS } from "./config.js";
import { createQuietSnapshot, generateCity } from "./city/cityGenerator.js";
import { fetchActivity } from "./github/activity.js";
import { GitHubApiError, GitHubClient } from "./github/client.js";
import { encodeGif } from "./render/gifExporter.js";
import { validateGifBytes } from "./render/gifValidator.js";
import {
  renderFrame,
  renderPixels,
} from "./render/canvasRenderer.js";
import type { ActivitySnapshot, GenerateOptions } from "./types.js";

type Arguments = {
  command: string;
  values: Map<string, string>;
  flags: Set<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberMap(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isRepositoryActivity(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.id) &&
    typeof value.name === "string" &&
    typeof value.fullName === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.primaryLanguage === "string" ||
      value.primaryLanguage === null) &&
    isNumberMap(value.languages) &&
    isFiniteNumber(value.stars) &&
    isFiniteNumber(value.forks) &&
    isFiniteNumber(value.openIssues) &&
    isFiniteNumber(value.openPullRequests) &&
    isFiniteNumber(value.commits) &&
    isNumberMap(value.commitsByDay) &&
    typeof value.createdAt === "string" &&
    (typeof value.pushedAt === "string" || value.pushedAt === null) &&
    isStringArray(value.topics) &&
    isStringArray(value.coAuthors)
  );
}

function isActivitySnapshot(value: unknown): value is ActivitySnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.username === "string" &&
    typeof value.fetchedAt === "string" &&
    isFiniteNumber(value.periodDays) &&
    Array.isArray(value.repositories) &&
    value.repositories.every(isRepositoryActivity) &&
    isFiniteNumber(value.totalCommits) &&
    isNumberMap(value.commitsByDay) &&
    (typeof value.lastCommitAt === "string" || value.lastCommitAt === null) &&
    isFiniteNumber(value.currentStreak) &&
    isFiniteNumber(value.longestStreak) &&
    isFiniteNumber(value.totalStars) &&
    isFiniteNumber(value.totalForks) &&
    isFiniteNumber(value.openIssues) &&
    isFiniteNumber(value.openPullRequests) &&
    isNumberMap(value.languages) &&
    isStringArray(value.coAuthors) &&
    isStringArray(value.warnings)
  );
}

function parseArguments(argv: string[]): Arguments {
  const [command = "help", ...tokens] = argv;
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!token.startsWith("--"))
      throw new Error(`Unexpected argument "${token}".`);
    const name = token.slice(2);
    if (name === "no-cache") {
      flags.add(name);
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Option --${name} requires a value.`);
    values.set(name, value);
    index += 1;
  }
  return { command, values, flags };
}

function option(
  args: Arguments,
  name: string,
  fallback?: string,
): string | undefined {
  const value = args.values.get(name) ?? fallback;
  if (!value && ["user", "input"].includes(name))
    throw new Error(`Missing required option --${name}.`);
  return value;
}

function numericOption(
  args: Arguments,
  name: string,
  fallback: number,
): number {
  const value = args.values.get(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Option --${name} must be a number.`);
  return parsed;
}

function printHelp(): void {
  console.log(`Git City — turn GitHub activity into an animated pixel city

Usage:
  git-city generate --user USERNAME [--output assets/city.gif] [options]
  git-city preview --user USERNAME [options]
  git-city validate --input assets/city.gif

Options:
  --input FILE    Use an ActivitySnapshot JSON file instead of the GitHub API
  --output FILE   GIF destination (default: assets/city.gif)
  --width N       Output width (default: ${DEFAULT_OPTIONS.width})
  --height N      Output height (default: ${DEFAULT_OPTIONS.height})
  --frames N      Animation frames (default: ${DEFAULT_OPTIONS.frames})
  --fps N         Frames per second (default: ${DEFAULT_OPTIONS.fps})
  --days N        Activity period in days (default: ${DEFAULT_OPTIONS.days})
  --scale N       Detail level 1-4; output is width/height times N (default: ${DEFAULT_OPTIONS.scale})
  --seed VALUE    Override the deterministic layout seed
  --token VALUE   GitHub token (or set GITHUB_TOKEN)
  --no-cache      Bypass the six-hour API response cache`);
}

async function loadSnapshot(
  args: Arguments,
  username: string,
  days: number,
): Promise<ActivitySnapshot> {
  const input = args.values.get("input");
  if (input) {
    const snapshot: unknown = JSON.parse(
      await readFile(resolve(input), "utf8"),
    );
    if (!isActivitySnapshot(snapshot) || snapshot.username !== username) {
      throw new Error(
        "Input JSON must contain a complete ActivitySnapshot for the requested username.",
      );
    }
    return snapshot;
  }

  const client = new GitHubClient(
    option(args, "token") ?? process.env.GITHUB_TOKEN,
    args.flags.has("no-cache"),
  );
  try {
    const snapshot = await fetchActivity(client, username, days);
    snapshot.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
    return snapshot;
  } catch (error) {
    const message =
      error instanceof GitHubApiError
        ? error.message
        : `Unable to retrieve public GitHub activity: ${error instanceof Error ? error.message : String(error)}`;
    console.warn(`Warning: ${message} Rendering a quiet city instead.`);
    return createQuietSnapshot(username, message);
  }
}

async function generate(args: Arguments): Promise<void> {
  const username = option(args, "user")!;
  const output = resolve(option(args, "output", "assets/city.gif")!);
  const options: Partial<GenerateOptions> = {
    width: numericOption(args, "width", DEFAULT_OPTIONS.width),
    height: numericOption(args, "height", DEFAULT_OPTIONS.height),
    frames: numericOption(args, "frames", DEFAULT_OPTIONS.frames),
    fps: numericOption(args, "fps", DEFAULT_OPTIONS.fps),
    days: numericOption(args, "days", DEFAULT_OPTIONS.days),
    scale: numericOption(args, "scale", DEFAULT_OPTIONS.scale),
    ...(option(args, "seed") ? { seed: option(args, "seed")! } : {}),
  };
  const snapshot = await loadSnapshot(args, username, options.days!);
  const city = generateCity(snapshot, options);
  const frames = Array.from({ length: city.frameCount }, (_, frame) =>
    renderPixels(city, frame),
  );
  const { width, height } = city;
  const preview = createCanvas(width, height);
  renderFrame(preview.getContext("2d"), city, 0);

  await mkdir(dirname(output), { recursive: true });
  const pngOutput = output.replace(/\.[^.]+$/, ".png");
  await writeFile(pngOutput, preview.toBuffer("image/png"));
  const gif = encodeGif(frames, width, height, city.fps);
  await writeFile(output, gif);
  console.log(`Created ${output} (${gif.byteLength.toLocaleString()} bytes)`);
  console.log(`First-frame preview: ${pngOutput}`);
}

async function validateGif(path: string): Promise<void> {
  const bytes = await readFile(resolve(path));
  const frames = validateGifBytes(bytes, path);
  console.log(
    `Valid GIF: ${path} (${frames} frames, ${bytes.byteLength.toLocaleString()} bytes)`,
  );
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  if (
    args.command === "help" ||
    args.command === "--help" ||
    args.command === "-h"
  ) {
    printHelp();
    return;
  }
  if (args.command === "generate" || args.command === "preview") {
    await generate(args);
    return;
  }
  if (args.command === "validate") {
    const input = option(args, "input")!;
    await validateGif(input);
    return;
  }
  throw new Error(
    `Unknown command "${args.command}". Run "git-city --help" for usage.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
