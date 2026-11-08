import { shade } from "../pixelArt.js";
import { facesFor } from "../sprites.js";
import type { GridRect } from "../../types.js";
import { band, center, type Ctx, inset, insetRatio, noise } from "./kit.js";
import { cylinder, gableRoof, rimLight, windows } from "./shapes.js";

const CREATIVE = [
  "#f07aa0",
  "#ffb04a",
  "#7ad3f0",
  "#9b7bea",
  "#7be08a",
  "#ffe066",
];

// Ground-floor shop window, door, and a striped awning on the front face. */
function shopfront(ctx: Ctx, rect: GridRect, awning: string): void {
  const { painter, floor } = ctx;
  const { x, w } = rect;
  painter.leftQuad(rect, x + w * 0.08, x + w * 0.62, 1, floor + 1, "#f7f3ea");
  painter.leftQuad(rect, x + w * 0.12, x + w * 0.58, 1, floor, "#a9dcf2");
  painter.leftQuad(
    rect,
    x + w * 0.7,
    x + w * 0.86,
    0,
    floor + 1,
    shade(awning, -0.4),
  );
  const stripes = Math.max(3, Math.round(w * 5));
  for (let index = 0; index < stripes; index += 1) {
    painter.leftQuad(
      rect,
      x + (index / stripes) * w,
      x + ((index + 1) / stripes) * w,
      floor + 2,
      floor + 4,
      index % 2 === 0 ? awning : "#f7f3ea",
    );
  }
}

// HTML / CSS: colorful stacked volumes, shop windows, awnings, billboards. */
export function drawCreative(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const vueMark = (top: number): void => {
    if (b.language !== "Vue") return;
    const point = painter.p(b.x + b.w / 2, b.y + b.h / 2, top);
    const x = Math.round(point.x);
    const y = Math.round(point.y) - 2;
    painter.buffer.plot(x - 2, y, "#41b883");
    painter.buffer.plot(x - 1, y + 1, "#41b883");
    painter.buffer.plot(x, y + 2, "#41b883");
    painter.buffer.plot(x + 1, y + 1, "#34495e");
    painter.buffer.plot(x + 2, y, "#34495e");
  };
  const color = (index: number): string =>
    index === 0 ? b.color : CREATIVE[(b.variant + index) % CREATIVE.length]!;

  if (b.form === "house" || b.form === "workshop") {
    const wall = facesFor(b.color, shade(b.color, 0.2));
    painter.box(b, 0, H, wall);
    shopfront(ctx, b, b.accent);
    windows(painter, b, {
      z0: floor + 6,
      z1: H - 1,
      row: floor,
      height: floor - 2,
      perTile: 2,
      glass: { left: "#f7f3ea", right: "#e6e0d6" },
      seed: b.variant,
    });
    // Colourful roof sign.
    const sign = { x: b.x + 0.15, y: b.y + b.h * 0.5, w: b.w - 0.3, h: 0.06 };
    painter.leftQuad(sign, sign.x, sign.x + sign.w, H, H + 4, color(1));
    painter.leftQuad(
      sign,
      sign.x + 0.1,
      sign.x + sign.w - 0.1,
      H + 1,
      H + 3,
      "#f7f3ea",
    );
    vueMark(H + 4);
    return H + 4;
  }

  // Playfully stacked, offset volumes in different colors.
  let base = 0;
  let segment = 0;
  while (base < H) {
    const height = Math.min(
      H - base,
      floor * (2 + Math.floor(noise(b.variant, segment) * 2)),
    );
    const rect = segment % 2 === 1 ? inset(b, 0.1) : b;
    const fill = color(segment);
    painter.box(rect, base, base + height, facesFor(fill, shade(fill, 0.25)));
    windows(painter, rect, {
      z0: base + (segment === 0 ? floor + 5 : 2),
      z1: base + height - 1,
      row: floor,
      height: floor - 2,
      perTile: 2,
      width: 0.6,
      glass: { left: "#f7f3ea", right: "#e6e0d6" },
      lit: { left: "#bfe8f7", right: "#a9dcf2" },
      litChance: 0.35,
      seed: b.variant + segment,
    });
    base += height;
    segment += 1;
  }
  shopfront(ctx, b, b.accent);
  rimLight(painter, b, 0, H, "#ffffff");

  // Billboard with pixel-art stripes.
  const board = { x: b.x + 0.12, y: b.y + b.h * 0.5, w: b.w - 0.24, h: 0.06 };
  const top = H + Math.round(tile * 0.9);
  const legA = painter.p(board.x + 0.15, board.y + board.h, H);
  const legB = painter.p(board.x + board.w - 0.15, board.y + board.h, H);
  painter.buffer.line(legA.x, legA.y, legA.x, legA.y - 3, "#5b5f66");
  painter.buffer.line(legB.x, legB.y, legB.x, legB.y - 3, "#5b5f66");
  const bands = 4;
  for (let index = 0; index < bands; index += 1) {
    painter.leftQuad(
      board,
      board.x + (index / bands) * board.w,
      board.x + ((index + 1) / bands) * board.w,
      H + 3,
      top,
      color(index + 1),
    );
  }
  vueMark(top);
  return top;
}

// Markdown & docs: classical libraries, or small shops with signs. */
export function drawLibrary(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const wall = facesFor(b.color, shade(b.color, 0.12));

  if (b.form === "house" || b.form === "workshop") {
    painter.box(b, 0, H, wall);
    shopfront(ctx, b, b.roofColor);
    // Shop sign above the window and a hanging sign on the corner.
    painter.leftQuad(
      b,
      b.x + b.w * 0.15,
      b.x + b.w * 0.6,
      floor + 5,
      floor + 8,
      b.accent,
    );
    painter.leftQuad(
      b,
      b.x + b.w * 0.2,
      b.x + b.w * 0.55,
      floor + 6,
      floor + 7,
      "#f7f3ea",
    );
    const corner = painter.p(b.x + b.w, b.y + b.h, floor + 7);
    painter.buffer.line(
      corner.x,
      corner.y,
      corner.x + 3,
      corner.y + 1,
      "#5b4636",
    );
    painter.buffer.rect(
      Math.round(corner.x) + 2,
      Math.round(corner.y) + 2,
      3,
      3,
      b.accent,
    );
    return gableRoof(painter, b, H, b.roofColor, wall);
  }

  // Library: stone steps, a colonnade, an entablature, and a dome or pediment.
  painter.box(b, 0, 2, facesFor("#d8d0c0", "#ece6da"));
  const hall = inset(b, 0.12);
  painter.box(hall, 2, H, wall);
  band(painter, hall, 3, H - 4, shade(b.color, -0.38));
  for (const side of ["left", "right"] as const) {
    const start = side === "left" ? hall.x : hall.y;
    const length = side === "left" ? hall.w : hall.h;
    const count = Math.max(3, Math.round(length * 3.5));
    for (let index = 0; index < count; index += 1) {
      const u0 = start + ((index + 0.25) / count) * length;
      const u1 = start + ((index + 0.75) / count) * length;
      const column =
        side === "left" ? shade(b.color, 0.1) : shade(b.color, -0.08);
      if (side === "left") painter.leftQuad(hall, u0, u1, 3, H - 4, column);
      else painter.rightQuad(hall, u0, u1, 3, H - 4, column);
    }
  }
  band(painter, hall, H - 4, H, shade(b.color, 0.12));
  band(painter, hall, H - 3, H - 2, b.accent);
  painter.tile(hall, shade(b.color, 0.2), H);

  const c = center(hall);
  if (b.landmark || hall.w * hall.h >= 2.6) {
    const radius = Math.min(hall.w, hall.h) * 0.3;
    const drumTop = H + 3;
    cylinder(painter, c.x, c.y, radius, H, drumTop, shade(b.color, 0.05));
    const top = painter.p(c.x, c.y, drumTop);
    const r = Math.max(2, Math.round((radius * tile * Math.SQRT2) / 2));
    for (let dy = -r; dy <= 0; dy += 1) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      for (let dx = -half; dx <= half; dx += 1) {
        painter.buffer.plot(
          Math.round(top.x) + dx,
          Math.round(top.y) + dy,
          dx < -half / 3
            ? shade(b.roofColor, 0.2)
            : dx < half / 3
              ? b.roofColor
              : shade(b.roofColor, -0.2),
        );
      }
    }
    painter.buffer.line(top.x, top.y - r, top.x, top.y - r - 3, "#f2d27a");
    return drumTop + r + 3;
  }
  return gableRoof(painter, insetRatio(hall, 0.02), H, b.roofColor, wall, 0.55);
}
