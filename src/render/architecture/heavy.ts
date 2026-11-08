import { pulse } from "../animation.js";
import { shade } from "../pixelArt.js";
import { facesFor } from "../sprites.js";
import {
  band,
  center,
  type Ctx,
  inset,
  insetRatio,
  noise,
  verticalLines,
} from "./kit.js";
import {
  antenna,
  blink,
  cylinder,
  drawSmoke,
  gableRoof,
  hipRoof,
  rimLight,
  sawtoothRoof,
  slab,
  windows,
} from "./shapes.js";

// Rust: corrugated metal, rust-red trim, bracing, chimneys and tanks. */
export function drawIndustrial(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const rust = b.accent;
  const wall = facesFor(b.color, shade(b.color, 0.15));
  painter.box(b, 0, H, wall);
  verticalLines(painter, b, 0.25, 0, H, shade(b.color, -0.12));

  if (b.form === "workshop" || b.form === "house") {
    band(painter, b, 0, 2, rust);
    windows(painter, b, {
      z0: Math.max(2, H - floor - 1),
      z1: H - 1,
      row: floor,
      height: Math.max(1, floor - 2),
      perTile: 1.5,
      width: 0.7,
      glass: { left: "#3d4250", right: "#323642" },
      lit: { left: "#ffb347", right: "#e89a35" },
      litChance: 0.35,
      seed: b.variant,
    });
    if (b.form === "house") return gableRoof(painter, b, H, rust, wall, 0.7);
    const roofTop = sawtoothRoof(painter, b, H, rust, "#ffcf9a");
    // Striped smokestack at the back corner.
    const stackTop = H + Math.round(tile * 1.8);
    const stack = cylinder(
      painter,
      b.x + 0.3,
      b.y + 0.3,
      0.18,
      H - 2,
      stackTop,
      shade(rust, -0.05),
    );
    for (const column of stack.columns) {
      painter.buffer.plot(
        stack.cx + column,
        stack.front(column, stackTop - 3),
        "#f7f3ea",
      );
    }
    drawSmoke(
      ctx,
      painter.p(b.x + 0.3, b.y + 0.3, stackTop),
      (b.variant % 7) / 7,
      ["#c9c4bb", "#9f9a92"],
    );
    return Math.max(roofTop, stackTop);
  }

  // Rust trim every few storeys and narrow window slots.
  for (let z = floor * 3; z < H - 2; z += floor * 3)
    band(painter, b, z, z + 1, rust);
  windows(painter, b, {
    z0: floor,
    z1: H - 3,
    row: floor,
    height: floor - 2,
    perTile: 1.5,
    width: 0.4,
    glass: { left: "#3d4250", right: "#323642" },
    lit: { left: "#ffb347", right: "#e89a35" },
    litChance: 0.3,
    seed: b.variant,
  });
  if (b.form === "tower") {
    // Exposed X-bracing on the front face.
    const p = painter.p.bind(painter);
    const y = b.y + b.h;
    const step = floor * 4;
    for (let z = 0; z + step <= H; z += step) {
      const a = p(b.x, y, z);
      const c = p(b.x + b.w, y, z + step);
      const d = p(b.x + b.w, y, z);
      const e = p(b.x, y, z + step);
      painter.buffer.line(a.x, a.y, c.x, c.y, rust);
      painter.buffer.line(d.x, d.y, e.x, e.y, rust);
    }
  }
  band(painter, b, H - 2, H, rust);
  painter.tile(insetRatio(b, 0.1), shade(b.color, -0.15), H);
  // Water tank on stilts.
  const c = center(b);
  const legBase = painter.p(c.x, c.y, H);
  painter.buffer.line(
    legBase.x - 2,
    legBase.y,
    legBase.x - 2,
    legBase.y - 4,
    "#5b5f66",
  );
  painter.buffer.line(
    legBase.x + 2,
    legBase.y,
    legBase.x + 2,
    legBase.y - 4,
    "#5b5f66",
  );
  cylinder(
    painter,
    c.x,
    c.y,
    0.28,
    H + 4,
    H + 4 + Math.round(tile * 0.7),
    shade(rust, 0.05),
  );
  return H + 4 + Math.round(tile * 0.7);
}

// Java & co: large, solid buildings with a stone podium, pilasters and a crown. */
export function drawMonolith(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const stone = shade(b.color, -0.18);
  const podium = Math.min(H - 2, floor * 2);
  painter.box(b, 0, podium, facesFor(stone, shade(stone, 0.2)));
  band(painter, b, 0, podium - 1, shade(stone, -0.18));
  verticalLines(painter, b, 0.34, 0, podium - 1, shade(stone, 0.2));
  if (H <= podium + 2) return podium;

  const body = inset(b, 0.12);
  const wall = facesFor(b.color, shade(b.color, 0.15));
  painter.box(body, podium, H, wall);
  windows(painter, body, {
    z0: podium + 2,
    z1: H - 3,
    row: floor,
    height: floor - 2,
    perTile: 3,
    width: 0.45,
    glass: { left: shade(b.color, -0.45), right: shade(b.color, -0.55) },
    lit: { left: "#ffe4a8", right: "#f2cf8a" },
    litChance: 0.22,
    seed: b.variant,
  });
  verticalLines(painter, body, 1, podium, H, shade(b.color, 0.18));
  band(painter, body, H - 2, H, b.accent);
  slab(painter, body, H + 1, shade(b.accent, -0.1), 0.06);

  if (b.form === "house" || b.form === "workshop") {
    return hipRoof(painter, body, H + 1, b.roofColor, 0.6);
  }
  if (b.form === "midrise") {
    return hipRoof(painter, insetRatio(body, 0.1), H + 1, b.roofColor, 0.45);
  }
  // Stepped crown with a pyramid cap.
  let rect = body;
  let base = H + 1;
  for (let step = 0; step < 2; step += 1) {
    rect = insetRatio(rect, 0.16);
    const rise = Math.max(3, Math.round(floor * (1.6 - step * 0.5)));
    painter.box(rect, base, base + rise, wall);
    band(painter, rect, base + rise - 1, base + rise, b.accent);
    base += rise;
  }
  const apex = hipRoof(painter, rect, base, b.roofColor, 1.2);
  return H > tile * 6
    ? antenna(ctx, center(b).x, center(b).y, apex, Math.round(tile * 0.6))
    : apex;
}

// C / C++: steel panels, vents, pipes, dishes and blinking LEDs. */
export function drawTech(ctx: Ctx): number {
  const { painter, b, floor, tile, frame, frameCount } = ctx;
  const H = b.height;
  const wall = facesFor(b.color, shade(b.color, 0.12));
  painter.box(b, 0, H, wall);
  for (let z = floor * 2; z < H - 1; z += floor * 2)
    band(painter, b, z, z + 1, shade(b.color, -0.2));
  verticalLines(painter, b, 1, 0, H, shade(b.color, -0.2));
  // Vents.
  windows(painter, b, {
    z0: 2,
    z1: H - 2,
    row: floor * 2,
    height: 1,
    perTile: 2,
    width: 0.7,
    glass: { left: "#2b3038", right: "#23272e" },
    seed: b.variant,
  });
  // Server LEDs running up the facade.
  const p = painter.p.bind(painter);
  for (let z = 4; z < H - 3; z += 3) {
    const u = b.x + b.w * (0.25 + 0.5 * noise(b.variant, z));
    const point = p(u, b.y + b.h, z);
    const color = noise(z, b.variant) < 0.7 ? b.accent : "#ff5d5d";
    if (pulse(frame, frameCount, z * 0.9 + b.variant) > 0.3) {
      painter.buffer.plot(Math.round(point.x), Math.round(point.y), color);
    } else
      painter.buffer.plot(
        Math.round(point.x),
        Math.round(point.y),
        shade(color, -0.5),
      );
  }
  // Pipe on the right face.
  const pipe = p(b.x + b.w, b.y + b.h * 0.8, 0);
  painter.buffer.line(pipe.x, pipe.y - 1, pipe.x, pipe.y - H + 1, "#c3c9d2");
  for (let z = floor; z < H; z += floor * 2)
    painter.buffer.plot(pipe.x, pipe.y - z, "#8e96a3");
  rimLight(painter, b, 0, H, shade(b.color, 0.25));

  painter.tile(insetRatio(b, 0.08), shade(b.color, -0.1), H);
  const c = center(b);
  if (b.form === "workshop") {
    // Data centre roof fans.
    const fans = Math.max(1, Math.round(b.w));
    for (let index = 0; index < fans; index += 1) {
      const fan = p(b.x + (index + 0.5) * (b.w / fans), c.y, H);
      painter.disc(fan.x, fan.y, 2, "#2b3038");
      // Spin flips an even number of times per loop, so the loop stays seamless.
      const spin = Math.floor((frame * 8) / Math.max(1, frameCount)) % 2;
      painter.buffer.plot(
        Math.round(fan.x) + (spin ? 1 : -1),
        Math.round(fan.y),
        "#9aa3ad",
      );
    }
    return H + 1;
  }
  // AC unit, satellite dish and antenna.
  painter.box(
    { x: b.x + 0.15, y: b.y + 0.15, w: 0.4, h: 0.35 },
    H,
    H + 3,
    facesFor("#c3c9d2"),
  );
  const dish = p(b.x + b.w * 0.7, b.y + b.h * 0.65, H);
  painter.buffer.line(dish.x, dish.y, dish.x, dish.y - 3, "#9aa3ad");
  painter.disc(dish.x - 1, dish.y - 5, 2.2, "#e6e9ee");
  painter.buffer.plot(
    Math.round(dish.x) - 1,
    Math.round(dish.y) - 5,
    "#9aa3ad",
  );
  if (b.form === "house") return H + 7;
  return antenna(
    ctx,
    c.x - 0.2,
    c.y - 0.2,
    H,
    Math.round(tile * (b.form === "tower" ? 1.6 : 0.9)),
  );
}

// Unknown languages: neutral brick and concrete. */
export function drawBrick(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const H = b.height;
  const concrete = b.color === "#a9a59c" || b.color === "#bdb8ad";
  const wall = facesFor(b.color, shade(b.color, concrete ? 0.12 : 0.2));
  painter.box(b, 0, H, wall);
  // Mortar courses / concrete panel seams.
  const course = concrete ? floor : 2;
  for (let z = course; z < H; z += course)
    band(painter, b, z, z + 1, shade(b.color, concrete ? -0.08 : 0.1));
  const frameColor = concrete ? shade(b.color, -0.25) : "#e9e1d2";
  windows(painter, b, {
    z0: b.form === "house" ? 2 : floor - 1,
    z1: H - 2,
    row: b.form === "house" ? floor + 1 : floor,
    height: floor - 1,
    perTile: b.form === "house" ? 1.5 : 2,
    width: 0.6,
    glass: { left: frameColor, right: shade(frameColor, -0.1) },
    seed: b.variant,
  });
  windows(painter, b, {
    z0: b.form === "house" ? 2 : floor - 1,
    z1: H - 2,
    row: b.form === "house" ? floor + 1 : floor,
    height: floor - 2,
    perTile: b.form === "house" ? 1.5 : 2,
    width: 0.36,
    glass: { left: "#4a5466", right: "#3d4657" },
    lit: { left: "#ffe08a", right: "#f2cf6e" },
    litChance: 0.2,
    seed: b.variant,
  });
  rimLight(painter, b, 0, H, shade(b.color, 0.15));

  if (b.form === "house") {
    painter.leftQuad(
      b,
      b.x + b.w * 0.45,
      b.x + b.w * 0.6,
      0,
      floor + 1,
      shade(b.roofColor, -0.35),
    );
    return gableRoof(painter, b, H, b.roofColor, wall);
  }
  if (b.form === "workshop") {
    const roofTop = sawtoothRoof(painter, b, H, b.roofColor);
    const chimney = { x: b.x + 0.15, y: b.y + 0.15, w: 0.3, h: 0.3 };
    const chimneyTop = H + Math.round(tile * 1.2);
    painter.box(chimney, H, chimneyTop, facesFor("#b5654a"));
    drawSmoke(
      ctx,
      painter.p(chimney.x + 0.15, chimney.y + 0.15, chimneyTop),
      (b.variant % 7) / 7,
    );
    return Math.max(roofTop, chimneyTop);
  }
  band(painter, b, H - 2, H, shade(b.color, 0.25));
  painter.tile(insetRatio(b, 0.08), shade(b.color, -0.2), H);
  if (b.form === "tower" || b.variant % 2 === 0) {
    // Classic wooden water tank.
    const c = center(b);
    const base = painter.p(c.x + 0.2, c.y + 0.2, H);
    painter.buffer.line(base.x - 1, base.y, base.x - 1, base.y - 3, "#5b5f66");
    painter.buffer.line(base.x + 1, base.y, base.x + 1, base.y - 3, "#5b5f66");
    cylinder(
      painter,
      c.x + 0.2,
      c.y + 0.2,
      0.25,
      H + 3,
      H + 3 + Math.round(tile * 0.6),
      "#a0714f",
      "#7a5639",
    );
    return H + 4 + Math.round(tile * 0.6);
  }
  blink(ctx, 0, 0, "", 0);
  return H;
}
