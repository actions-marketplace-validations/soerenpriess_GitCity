import type { GridRect } from "../../types.js";
import { pulse } from "../animation.js";
import { shade } from "../pixelArt.js";
import { facesFor } from "../sprites.js";
import {
  band,
  center,
  type Ctx,
  insetRatio,
  noise,
  verticalLines,
} from "./kit.js";
import {
  antenna,
  cylinder,
  gableRoof,
  rimLight,
  sawtoothRoof,
  slab,
  windows,
} from "./shapes.js";

// TypeScript / JavaScript: glass curtain walls, bright windows, modern. */
export function drawGlass(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const glass = { left: shade(b.color, 0.12), right: shade(b.color, -0.2) };

  if (b.form === "house" || b.form === "workshop") {
    // Modern white villa / studio with wide glazing and a floating slab roof.
    const wall = facesFor("#f2f4f6", "#e1e6ec");
    painter.box(b, 0, H, wall);
    band(painter, b, 2, H - 3, glass.left, glass.right);
    windows(painter, b, {
      z0: 2,
      z1: H - 3,
      row: H,
      height: H - 5,
      perTile: 1,
      width: 0.3,
      lit: { left: b.accent, right: shade(b.accent, -0.1) },
      litChance: 0.5,
      seed: b.variant,
    });
    if (b.form === "workshop")
      return sawtoothRoof(painter, b, H, "#e8edf2", glass.left);
    slab(painter, b, H + 1, "#d9dee5", 0.08);
    return H + 1;
  }

  painter.box(b, 0, H, {
    top: b.roofColor,
    left: glass.left,
    right: glass.right,
  });
  // Diagonal sky reflection sweeping across both glass faces.
  const p = painter.p.bind(painter);
  const front = b.y + b.h;
  const side = b.x + b.w;
  painter.buffer.polygon(
    [
      p(b.x + b.w * 0.05, front, 0),
      p(b.x + b.w * 0.3, front, 0),
      p(b.x + b.w * 0.8, front, H),
      p(b.x + b.w * 0.55, front, H),
    ],
    shade(glass.left, 0.2),
  );
  painter.buffer.polygon(
    [
      p(side, b.y + b.h * 0.1, 0),
      p(side, b.y + b.h * 0.22, 0),
      p(side, b.y + b.h * 0.62, H),
      p(side, b.y + b.h * 0.5, H),
    ],
    shade(glass.right, 0.16),
  );
  windows(painter, b, {
    z0: floor,
    z1: H - 2,
    row: floor,
    height: floor - 1,
    perTile: 2,
    width: 0.86,
    lit: { left: b.accent, right: shade(b.accent, -0.12) },
    litChance: 0.24,
    seed: b.variant,
  });
  for (let z = floor; z < H; z += floor) {
    band(
      painter,
      b,
      z,
      z + 1,
      shade(glass.left, -0.14),
      shade(glass.right, -0.14),
    );
  }
  verticalLines(painter, b, 0.5, 0, H, shade(glass.left, -0.18));
  band(painter, b, 0, Math.min(floor, H), "#2f3e57", "#26324a");
  rimLight(painter, b, 0, H, "#eef9ff");

  const roof = insetRatio(b, 0.08);
  painter.tile(roof, shade(b.roofColor, -0.12), H);
  const c = center(b);
  if (b.form === "tower" && b.variant % 3 === 0) {
    // Helipad.
    painter.tile(insetRatio(b, 0.2), "#4a5260", H);
    const pad = p(c.x, c.y, H);
    painter.buffer.rect(
      Math.round(pad.x) - 1,
      Math.round(pad.y) - 1,
      1,
      3,
      "#f7f3ea",
    );
    painter.buffer.rect(
      Math.round(pad.x) + 1,
      Math.round(pad.y) - 1,
      1,
      3,
      "#f7f3ea",
    );
    painter.buffer.plot(Math.round(pad.x), Math.round(pad.y), "#f7f3ea");
    return H;
  }
  if (b.form === "tower") {
    // Glass crown and spire.
    const crown = insetRatio(b, 0.28);
    const crownTop = H + floor * 2;
    painter.box(crown, H, crownTop, {
      top: shade(b.roofColor, 0.05),
      left: shade(glass.left, 0.15),
      right: shade(glass.right, 0.1),
    });
    if (H > tile * 5)
      return antenna(ctx, c.x, c.y, crownTop, Math.round(tile * 1.2));
    return crownTop;
  }
  painter.box(insetRatio(b, 0.3), H, H + 2, facesFor("#d9dee5"));
  return H + 2;
}

// Python: green roofs, warm lights, round towers and planted terraces. */
export function drawEco(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const warm = { left: "#ffd66b", right: "#f2b84b" };
  const green = "#6cbf4a";
  const c = center(b);

  const bushes = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
  ): void => {
    const count = Math.max(2, Math.round((x1 - x0 + y1 - y0) * 1.6));
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count;
      const point = painter.p(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z);
      painter.disc(
        point.x,
        point.y - 1,
        1.4,
        index % 2 ? "#4c9a52" : "#5aa84a",
      );
    }
  };

  if (b.form === "workshop") {
    // Greenhouse.
    const frameColor = "#f3f6f2";
    painter.box(b, 0, H, { top: "#cdeedd", left: "#b6e2c8", right: "#9fcfb4" });
    for (let index = 0; index < 5; index += 1) {
      const gx = b.x + 0.2 + noise(b.variant, index) * (b.w - 0.4);
      const point = painter.p(gx, b.y + b.h, 2 + (index % 3));
      painter.disc(point.x, point.y, 1.2, "#4c9a52");
    }
    verticalLines(painter, b, 0.35, 0, H, frameColor);
    return gableRoof(painter, b, H, "#d8f2e4", facesFor("#b6e2c8"), 0.8);
  }

  if (b.form === "house") {
    const wall = facesFor(b.color);
    painter.box(b, 0, H, wall);
    windows(painter, b, {
      z0: 2,
      z1: H - 1,
      row: floor + 1,
      height: Math.max(1, floor - 1),
      perTile: 1.5,
      glass: { left: shade(b.color, -0.4), right: shade(b.color, -0.5) },
      lit: warm,
      litChance: 0.6,
      seed: b.variant,
    });
    return gableRoof(painter, b, H, b.roofColor, wall);
  }

  if (b.variant % 2 === 0) {
    // Organic round tower with planter rings and a roof garden.
    const radius = Math.min(b.w, b.h) / 2;
    const body = cylinder(painter, c.x, c.y, radius, 0, H, b.color, green);
    for (let z = floor; z + floor - 1 <= H - 2; z += floor) {
      const planter = (z / floor) % 3 === 0;
      for (const column of body.columns) {
        if (Math.abs(column) > body.halfWidth - 1) continue;
        const y = body.front(column, z);
        if (planter) {
          painter.buffer.plot(body.cx + column, y - 1, "#5aa84a");
          continue;
        }
        if ((column + 30) % 3 === 0) continue;
        const lit = noise(b.variant, z, column) < 0.55;
        painter.buffer.rect(
          body.cx + column,
          y - floor + 2,
          1,
          floor - 2,
          lit ? (column < 0 ? warm.left : warm.right) : shade(b.color, -0.45),
        );
      }
    }
    const top = painter.p(c.x, c.y, H);
    painter.disc(
      top.x - 1,
      top.y - 2,
      Math.max(1.5, radius * tile * 0.22),
      "#4c9a52",
    );
    painter.disc(top.x + 2, top.y - 1, 1.5, "#7fd35a");
    return H + 4;
  }

  // Stepped terraces, each one planted.
  let rect: GridRect = b;
  let base = 0;
  const tiers = [0.5, 0.3, 0.2];
  for (let tier = 0; tier < tiers.length; tier += 1) {
    const top =
      tier === tiers.length - 1 ? H : base + Math.round(H * tiers[tier]!);
    const wall = facesFor(shade(b.color, -tier * 0.04), green);
    painter.box(rect, base, top, wall);
    windows(painter, rect, {
      z0: base + 2,
      z1: top - 2,
      row: floor,
      height: floor - 2,
      perTile: 2,
      glass: { left: shade(b.color, -0.38), right: shade(b.color, -0.48) },
      lit: warm,
      litChance: 0.5,
      seed: b.variant + tier * 7,
    });
    bushes(rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h, top);
    bushes(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, top);
    base = top;
    rect = insetRatio(rect, 0.16);
  }
  return H + 3;
}

// Go: clean, functional cubes in cool colors with a cyan accent. */
export function drawFunctional(ctx: Ctx): number {
  const { painter, b, floor } = ctx;
  const H = b.height;
  const wall = facesFor(b.color, shade(b.color, 0.06));
  painter.box(b, 0, H, wall);
  const cool = { left: "#9fd3e6", right: "#7fb7cf" };

  if (b.form === "workshop") {
    // Logistics hall with roll-up doors.
    windows(painter, b, {
      z0: 0,
      z1: Math.min(H - 2, floor * 2),
      row: floor * 3,
      height: Math.min(H - 3, floor * 2 - 1),
      perTile: 1,
      width: 0.6,
      glass: { left: b.accent, right: shade(b.accent, -0.2) },
      seed: b.variant,
    });
    band(painter, b, H - 2, H, b.accent);
    painter.tile(insetRatio(b, 0.1), shade(b.color, -0.06), H);
    return H;
  }

  windows(painter, b, {
    z0: 2,
    z1: H - 3,
    row: floor,
    height: floor - 2,
    perTile: b.form === "house" ? 1.5 : 2.5,
    width: 0.5,
    glass: cool,
    lit: { left: "#f4fdff", right: "#d8f3fb" },
    litChance: 0.15,
    seed: b.variant,
  });
  // Cyan corner stripe and cornice.
  painter.leftQuad(b, b.x + b.w - 0.12, b.x + b.w, 0, H, b.accent);
  band(painter, b, H - 2, H, b.accent);
  if (b.form === "house") {
    painter.leftQuad(
      b,
      b.x + b.w * 0.3,
      b.x + b.w * 0.45,
      0,
      floor + 1,
      b.accent,
    );
    return H;
  }
  // Neat rows of solar panels.
  const roof = insetRatio(b, 0.12);
  painter.tile(roof, shade(b.color, -0.08), H);
  const rows = Math.max(1, Math.round(roof.h * 2));
  for (let index = 0; index < rows; index += 1) {
    painter.tile(
      {
        x: roof.x + 0.08,
        y: roof.y + (index + 0.15) / (rows / roof.h),
        w: roof.w - 0.16,
        h: (0.6 * roof.h) / rows,
      },
      "#2f4a6b",
      H + 1,
    );
  }
  return H + 1;
}

// Shaders: dark walls, glowing windows, neon edges, holograms. */
export function drawNeon(ctx: Ctx): number {
  const { painter, b, floor, tile, frame, frameCount } = ctx;
  const H = b.height;
  const neon = [b.accent, "#ff6ad5", "#b4ff6a"];
  const wall = facesFor(b.color, shade(b.color, 0.1));
  painter.box(b, 0, H, wall);
  windows(painter, b, {
    z0: 2,
    z1: H - 2,
    row: floor,
    height: floor - 2,
    perTile: 2,
    width: 0.7,
    seed: b.variant,
    pick: (row, index, side) => {
      const roll = noise(b.variant, row, index + (side === "left" ? 0 : 40));
      if (roll < 0.35) return shade(b.color, -0.2);
      const color = neon[Math.floor(roll * 10) % neon.length]!;
      const on = pulse(frame, frameCount, roll * Math.PI * 2) > 0.25;
      const glow = on ? color : shade(color, -0.45);
      return side === "left" ? glow : shade(glow, -0.12);
    },
  });
  // Neon outlines on the front edges.
  rimLight(painter, b, 0, H, b.accent);
  const p = painter.p.bind(painter);
  const a = p(b.x, b.y + b.h, H);
  const m = p(b.x + b.w, b.y + b.h, H);
  const r = p(b.x + b.w, b.y, H);
  painter.buffer.line(a.x, a.y, m.x, m.y, b.accent);
  painter.buffer.line(m.x, m.y, r.x, r.y, "#ff6ad5");
  if (b.form === "house" || b.form === "workshop") return H;

  // Hologram: a rotating, bobbing crystal above a projector beam.
  const c = center(b);
  const base = p(c.x, c.y, H);
  painter.box(insetRatio(b, 0.38), H, H + 2, facesFor("#3a3458"));
  const t = frame / Math.max(1, frameCount);
  const bob = Math.round(Math.sin(t * Math.PI * 2 + b.variant) * 1.5);
  const hy = Math.round(base.y - 2 - tile * 1.3 + bob);
  const color = neon[(Math.floor(t * 3) + b.variant) % neon.length]!;
  const bx = Math.round(base.x);
  for (let y = hy + 4; y < Math.round(base.y) - 2; y += 1) {
    const half = Math.round(((base.y - y) / (base.y - hy)) * 3);
    for (let dx = -half; dx <= half; dx += 1) {
      if ((dx + y) % 2 === 0)
        painter.buffer.plot(bx + dx, y, shade(color, 0.3));
    }
  }
  const halfWidth =
    1 + Math.round(2.5 * Math.abs(Math.cos(t * Math.PI * 2 + b.variant)));
  const points = [
    { x: bx, y: hy - 4 },
    { x: bx + halfWidth, y: hy },
    { x: bx, y: hy + 4 },
    { x: bx - halfWidth, y: hy },
  ];
  painter.buffer.polygon(points, shade(color, -0.25));
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]!;
    const to = points[(index + 1) % points.length]!;
    painter.buffer.line(from.x, from.y, to.x, to.y, color);
  }
  return H + Math.round(tile * 1.3) + 6;
}

// Shells and infrastructure: control-room windows, service bands and pipes. */
export function drawOperations(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  painter.box(b, 0, H, facesFor(b.color, shade(b.color, 0.1)));
  verticalLines(painter, b, 0.6, 0, H, shade(b.color, -0.18));
  for (let z = floor * 2; z < H; z += floor * 2) {
    band(painter, b, z, z + 1, b.accent);
  }
  windows(painter, b, {
    z0: 2,
    z1: H - 2,
    row: floor,
    height: Math.max(1, floor - 2),
    perTile: b.form === "house" ? 1 : 2,
    width: 0.55,
    glass: { left: "#273746", right: "#202e3a" },
    lit: { left: b.accent, right: shade(b.accent, -0.2) },
    litChance: 0.4,
    seed: b.variant,
  });
  const roof = insetRatio(b, 0.14);
  painter.tile(roof, shade(b.color, -0.14), H);
  const base = painter.p(roof.x + roof.w * 0.5, roof.y + roof.h * 0.5, H);
  const mast = Math.max(4, Math.round(tile * 0.55));
  painter.buffer.line(base.x - 3, base.y, base.x - 3, base.y - mast, b.accent);
  painter.buffer.line(base.x + 3, base.y, base.x + 3, base.y - mast, b.accent);
  painter.buffer.line(
    base.x - 3,
    base.y - mast,
    base.x + 3,
    base.y - mast,
    b.accent,
  );
  painter.buffer.rect(base.x - 1, base.y - mast + 2, 3, 2, "#f7f3ea");
  return H + mast;
}

// SQL and query languages: database halls topped with storage cylinders. */
export function drawData(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  painter.box(b, 0, H, facesFor(b.color, shade(b.color, 0.14)));
  verticalLines(painter, b, 0.55, 0, H, shade(b.color, -0.14));
  for (let z = floor * 2; z < H - 1; z += floor * 2) {
    band(painter, b, z, z + 1, shade(b.color, -0.12));
  }
  windows(painter, b, {
    z0: 2,
    z1: H - 2,
    row: floor,
    height: Math.max(1, floor - 2),
    perTile: 1.5,
    width: 0.45,
    glass: { left: "#203b49", right: "#1d3440" },
    lit: { left: b.accent, right: shade(b.accent, -0.15) },
    litChance: 0.3,
    seed: b.variant,
  });
  painter.tile(insetRatio(b, 0.12), shade(b.color, -0.12), H);
  const c = center(b);
  const radius = Math.min(b.w, b.h) * 0.18;
  const top = H + Math.max(4, Math.round(tile * 0.55));
  for (const [dx, dy] of [
    [-radius * 0.85, 0],
    [radius * 0.85, 0],
  ] as const) {
    cylinder(
      painter,
      c.x + dx,
      c.y + dy,
      radius * 0.65,
      H,
      top,
      b.accent,
      shade(b.accent, 0.25),
    );
  }
  return top;
}
