import type { GridRect } from "../../types.js";
import { pulse } from "../animation.js";
import { shade } from "../pixelArt.js";
import type { Faces, IsoPainter } from "../sprites.js";
import { type Ctx, noise, quad, type Side, spans } from "./kit.js";

export interface WindowOptions {
  z0: number;
  z1: number;
  // Row pitch and window height in pixels. */
  row: number;
  height: number;
  perTile: number;
  // Window width as a share of its cell. */
  width?: number;
  // Unlit glass; omit to draw only lit windows. */
  glass?: { left: string; right: string };
  lit?: { left: string; right: string };
  litChance?: number;
  seed: number;
  // Optional per-window color (null skips the window). */
  pick?: (row: number, index: number, side: Side) => string | null;
}

export function windows(
  painter: IsoPainter,
  rect: GridRect,
  options: WindowOptions,
): void {
  const width = options.width ?? 0.56;
  for (const { side, start, length } of spans(rect)) {
    const count = Math.max(1, Math.round(length * options.perTile));
    let row = 0;
    for (
      let z = options.z0;
      z + options.height <= options.z1;
      z += options.row, row += 1
    ) {
      for (let index = 0; index < count; index += 1) {
        let color: string | null | undefined;
        if (options.pick) color = options.pick(row, index, side);
        else {
          const lit =
            options.lit !== undefined &&
            noise(options.seed, row, index + (side === "left" ? 0 : 50)) <
              (options.litChance ?? 0.2);
          color = lit ? options.lit?.[side] : options.glass?.[side];
        }
        if (!color) continue;
        quad(
          painter,
          rect,
          side,
          start + ((index + (1 - width) / 2) / count) * length,
          start + ((index + (1 + width) / 2) / count) * length,
          z,
          z + options.height,
          color,
        );
      }
    }
  }
}

// Light vertical edge on the front corner ("rim light"). */
export function rimLight(
  painter: IsoPainter,
  rect: GridRect,
  z0: number,
  z1: number,
  color: string,
): void {
  const corner = painter.p(rect.x + rect.w, rect.y + rect.h);
  painter.buffer.line(
    corner.x,
    corner.y - z0 - 1,
    corner.x,
    corner.y - z1 + 1,
    color,
  );
}

// Gable roof; the ridge runs along the longer side. Returns the ridge height. */
export function gableRoof(
  painter: IsoPainter,
  rect: GridRect,
  base: number,
  roof: string,
  wall: Faces,
  riseScale = 1,
): number {
  const { x, y, w, h } = rect;
  const rise = Math.max(
    2,
    Math.round(((Math.min(w, h) * painter.layout.tile) / 4) * riseScale),
  );
  const top = base + rise;
  const buffer = painter.buffer;
  const p = painter.p.bind(painter);
  if (w >= h) {
    const ym = y + h / 2;
    buffer.polygon(
      [p(x, y, base), p(x + w, y, base), p(x + w, ym, top), p(x, ym, top)],
      shade(roof, 0.18),
    );
    buffer.polygon(
      [p(x + w, y, base), p(x + w, y + h, base), p(x + w, ym, top)],
      wall.right,
    );
    buffer.polygon(
      [
        p(x, ym, top),
        p(x + w, ym, top),
        p(x + w, y + h, base),
        p(x, y + h, base),
      ],
      roof,
    );
    const a = p(x, ym, top);
    const b = p(x + w, ym, top);
    buffer.line(a.x, a.y, b.x, b.y, shade(roof, 0.35));
  } else {
    const xm = x + w / 2;
    buffer.polygon(
      [p(x, y, base), p(xm, y, top), p(xm, y + h, top), p(x, y + h, base)],
      shade(roof, 0.18),
    );
    buffer.polygon(
      [
        p(xm, y, top),
        p(x + w, y, base),
        p(x + w, y + h, base),
        p(xm, y + h, top),
      ],
      shade(roof, -0.18),
    );
    buffer.polygon(
      [p(x, y + h, base), p(x + w, y + h, base), p(xm, y + h, top)],
      wall.left,
    );
  }
  return top;
}

// Pyramid (hip) roof. Returns the apex height. */
export function hipRoof(
  painter: IsoPainter,
  rect: GridRect,
  base: number,
  roof: string,
  riseScale = 1,
): number {
  const { x, y, w, h } = rect;
  const rise = Math.max(
    2,
    Math.round(((Math.min(w, h) * painter.layout.tile) / 4) * riseScale),
  );
  const apex = painter.p(x + w / 2, y + h / 2, base + rise);
  const p = painter.p.bind(painter);
  const buffer = painter.buffer;
  buffer.polygon([p(x, y, base), p(x + w, y, base), apex], shade(roof, 0.2));
  buffer.polygon([p(x, y, base), p(x, y + h, base), apex], shade(roof, 0.1));
  buffer.polygon([p(x, y + h, base), p(x + w, y + h, base), apex], roof);
  buffer.polygon(
    [p(x + w, y, base), p(x + w, y + h, base), apex],
    shade(roof, -0.2),
  );
  return base + rise;
}

// Factory sawtooth roof with glazed north lights. Returns the roof height. */
export function sawtoothRoof(
  painter: IsoPainter,
  rect: GridRect,
  base: number,
  roof: string,
  glass = "#a9dcf2",
): number {
  const teeth = Math.max(1, Math.round(rect.h * 1.5));
  for (let index = 0; index < teeth; index += 1) {
    const y0 = rect.y + (index / teeth) * rect.h;
    const y1 = rect.y + ((index + 1) / teeth) * rect.h;
    painter.buffer.polygon(
      [
        painter.p(rect.x, y0, base + 3),
        painter.p(rect.x + rect.w, y0, base + 3),
        painter.p(rect.x + rect.w, y1, base),
        painter.p(rect.x, y1, base),
      ],
      index % 2 === 0 ? roof : shade(roof, 0.15),
    );
    const tooth = painter.p(rect.x + rect.w, y0, base);
    painter.buffer.line(tooth.x, tooth.y, tooth.x, tooth.y - 3, glass);
  }
  return base + 3;
}

export function drawSmoke(
  ctx: Ctx,
  origin: { x: number; y: number },
  phase: number,
  colors: [string, string] = ["#f4f1ea", "#dcd8d0"],
): void {
  const { painter, tile, frame, frameCount } = ctx;
  for (let puff = 0; puff < 3; puff += 1) {
    const t = (frame / Math.max(1, frameCount) + puff / 3 + phase) % 1;
    painter.disc(
      origin.x + t * tile * 0.5,
      origin.y - 2 * painter.layout.unit - t * tile * 1.6,
      painter.layout.unit + t * tile * 0.18,
      t < 0.5 ? colors[0] : colors[1],
    );
  }
}

export interface Cylinder {
  // Screen y of the cylinder's front edge for a column at height z. */
  front(column: number, z: number): number;
  columns: number[];
  // Screen x of the cylinder axis. */
  cx: number;
  halfWidth: number;
}

/**
 * Vertical cylinder on a grid circle: draws body and top cap and returns
 * helpers to decorate the curved surface.
 */
export function cylinder(
  painter: IsoPainter,
  cx: number,
  cy: number,
  radius: number,
  z0: number,
  z1: number,
  color: string,
  top = shade(color, 0.25),
): Cylinder {
  const c = painter.p(cx, cy);
  const halfWidth = (radius * painter.layout.tile * Math.SQRT2) / 2;
  const half = (column: number): number =>
    (halfWidth / 2) * Math.sqrt(Math.max(0, 1 - (column / halfWidth) ** 2));
  const x0 = Math.round(c.x);
  const columns: number[] = [];
  const reach = Math.floor(halfWidth);
  for (let column = -reach; column <= reach; column += 1) {
    columns.push(column);
    const k = column / halfWidth;
    const body =
      k < -0.3 ? color : k < 0.4 ? shade(color, -0.1) : shade(color, -0.24);
    const hh = half(column);
    const capTop = Math.round(c.y - z1 - hh);
    const axisTop = Math.round(c.y - z1);
    const bottom = Math.round(c.y - z0 + hh);
    painter.buffer.rect(x0 + column, axisTop, 1, bottom - axisTop + 1, body);
    painter.buffer.rect(
      x0 + column,
      capTop,
      1,
      Math.round(c.y - z1 + hh) - capTop + 1,
      top,
    );
  }
  return {
    front: (column, z) => Math.round(c.y - z + half(column)),
    columns,
    cx: x0,
    halfWidth,
  };
}

// Polygon approximating a grid-space ellipse at height z. */
export function ellipse(
  painter: IsoPainter,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z: number,
  steps = 28,
): Array<{ x: number; y: number }> {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return painter.p(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, z);
  });
}

// Blinking light; periodic in the frame count. */
export function blink(
  ctx: Ctx,
  x: number,
  y: number,
  color: string,
  phase: number,
): void {
  if (pulse(ctx.frame, ctx.frameCount, phase) > 0.5) {
    const u = ctx.painter.layout.unit;
    const offset = Math.floor((u - 1) / 2);
    ctx.painter.buffer.rect(
      Math.round(x) - offset,
      Math.round(y) - offset,
      u,
      u,
      color,
    );
  }
}

// Roof-top mast with a blinking beacon. Returns the mast top height. */
export function antenna(
  ctx: Ctx,
  gx: number,
  gy: number,
  base: number,
  length: number,
): number {
  const tip = ctx.painter.p(gx, gy, base);
  ctx.painter.buffer.line(tip.x, tip.y, tip.x, tip.y - length, "#cfd3da");
  blink(ctx, tip.x, tip.y - length - 1, "#ff4d4d", ctx.b.variant);
  return base + length + 1;
}

// Thin flat roof slab, optionally overhanging the walls. */
export function slab(
  painter: IsoPainter,
  rect: GridRect,
  z: number,
  color: string,
  overhang = 0,
): void {
  const roof = { ...rect };
  roof.x -= overhang;
  roof.y -= overhang;
  roof.w += overhang * 2;
  roof.h += overhang * 2;
  painter.leftQuad(roof, roof.x, roof.x + roof.w, z - 1, z, shade(color, -0.2));
  painter.rightQuad(
    roof,
    roof.y,
    roof.y + roof.h,
    z - 1,
    z,
    shade(color, -0.32),
  );
  painter.tile(roof, color, z);
}
