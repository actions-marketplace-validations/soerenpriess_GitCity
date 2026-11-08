import type { GenerateOptions } from "./types.js";

export const DEFAULT_OPTIONS: GenerateOptions = {
  width: 480,
  height: 270,
  frames: 24,
  fps: 12,
  days: 365,
  scale: 2,
};

export const MAX_SCALE = 4;

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const METRICS_SNAPSHOT_VERSION = "3";
export const MAX_REPOSITORIES_TO_ANALYZE = 15;
export const MAX_BUILDINGS = 48;

export function validateOptions(options: GenerateOptions): void {
  if (
    !Number.isInteger(options.width) ||
    options.width < 160 ||
    options.width > 1200
  ) {
    throw new Error("Width must be an integer between 160 and 1200.");
  }
  if (
    !Number.isInteger(options.height) ||
    options.height < 90 ||
    options.height > 675
  ) {
    throw new Error("Height must be an integer between 90 and 675.");
  }
  if (
    !Number.isInteger(options.frames) ||
    options.frames < 1 ||
    options.frames > 60
  ) {
    throw new Error("Frames must be an integer between 1 and 60.");
  }
  if (!Number.isInteger(options.fps) || options.fps < 1 || options.fps > 30) {
    throw new Error("FPS must be an integer between 1 and 30.");
  }
  if (
    !Number.isInteger(options.days) ||
    options.days < 1 ||
    options.days > 3650
  ) {
    throw new Error("Days must be an integer between 1 and 3650.");
  }
  if (
    !Number.isInteger(options.scale) ||
    options.scale < 1 ||
    options.scale > MAX_SCALE
  ) {
    throw new Error(`Scale must be an integer between 1 and ${MAX_SCALE}.`);
  }
}
