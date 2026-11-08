import type { CityBuilding, GridRect } from "../../types.js";
import { shade } from "../pixelArt.js";
import type { IsoPainter } from "../sprites.js";

export type Side = "left" | "right";

// Everything an architecture renderer needs for one building. */
export interface Ctx {
  painter: IsoPainter;
  b: CityBuilding;
  frame: number;
  frameCount: number;
  tile: number;
  // Storey height in pixels. */
  floor: number;
}

export const floorHeight = (tile: number): number =>
  Math.max(3, Math.round(tile / 3));

// Deterministic pseudo-random value in [0, 1) for small decorative choices. */
export function noise(a: number, b: number, c = 0): number {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

export function inset(rect: GridRect, amount: number): GridRect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    w: rect.w - amount * 2,
    h: rect.h - amount * 2,
  };
}

export function insetRatio(rect: GridRect, ratio: number): GridRect {
  return inset(rect, Math.min(rect.w, rect.h) * ratio);
}

export const center = (rect: GridRect): { x: number; y: number } => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

// The two visible faces of a footprint: left runs along x, right along y. */
export function spans(
  rect: GridRect,
): Array<{ side: Side; start: number; length: number }> {
  return [
    { side: "left", start: rect.x, length: rect.w },
    { side: "right", start: rect.y, length: rect.h },
  ];
}

export function quad(
  painter: IsoPainter,
  rect: GridRect,
  side: Side,
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  color: string,
): void {
  if (side === "left") painter.leftQuad(rect, u0, u1, z0, z1, color);
  else painter.rightQuad(rect, u0, u1, z0, z1, color);
}

// Horizontal band across both visible faces. */
export function band(
  painter: IsoPainter,
  rect: GridRect,
  z0: number,
  z1: number,
  left: string,
  right = shade(left, -0.18),
): void {
  painter.leftQuad(rect, rect.x, rect.x + rect.w, z0, z1, left);
  painter.rightQuad(rect, rect.y, rect.y + rect.h, z0, z1, right);
}

// Vertical 1px lines on both faces, every `step` tiles. */
export function verticalLines(
  painter: IsoPainter,
  rect: GridRect,
  step: number,
  z0: number,
  z1: number,
  left: string,
  right = shade(left, -0.15),
): void {
  for (const { side, start, length } of spans(rect)) {
    const count = Math.max(1, Math.round(length / step));
    for (let index = 1; index < count; index += 1) {
      const u = start + (index / count) * length;
      const a =
        side === "left"
          ? painter.p(u, rect.y + rect.h, z0)
          : painter.p(rect.x + rect.w, u, z0);
      painter.buffer.line(
        a.x,
        a.y - 1,
        a.x,
        a.y - (z1 - z0),
        side === "left" ? left : right,
      );
    }
  }
}
