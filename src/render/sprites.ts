import { project } from "../city/grid.js";
import type {
  CityBoat,
  CityCrane,
  CityLayout,
  CityMonument,
  CityPerson,
  CityTree,
  GridRect,
  Season,
} from "../types.js";
import type { VehiclePose } from "../city/traffic.js";
import { PixelBuffer, type Point, shade } from "./pixelArt.js";
import { SEASON_PALETTES } from "./seasonPalette.js";

const SKIN = "#f2c9a0";

export interface Faces {
  top: string;
  left: string;
  right: string;
}

export function facesFor(color: string, top = shade(color, 0.28)): Faces {
  return { top, left: color, right: shade(color, -0.22) };
}

export class IsoPainter {
  constructor(
    readonly buffer: PixelBuffer,
    readonly layout: CityLayout,
  ) {}

  p(x: number, y: number, z = 0): Point {
    return project(this.layout, x, y, z);
  }

  // Flat quad on the ground plane (or at height z). */
  tile(rect: GridRect, color: string, z = 0): void {
    const { x, y, w, h } = rect;
    this.buffer.polygon(
      [
        this.p(x, y, z),
        this.p(x + w, y, z),
        this.p(x + w, y + h, z),
        this.p(x, y + h, z),
      ],
      color,
    );
  }

  // Front-left (+y) wall quad between u0..u1 along x and heights z0..z1. */
  leftQuad(
    rect: GridRect,
    u0: number,
    u1: number,
    z0: number,
    z1: number,
    color: string,
  ): void {
    const y = rect.y + rect.h;
    this.buffer.polygon(
      [
        this.p(u0, y, z0),
        this.p(u1, y, z0),
        this.p(u1, y, z1),
        this.p(u0, y, z1),
      ],
      color,
    );
  }

  // Front-right (+x) wall quad between v0..v1 along y and heights z0..z1. */
  rightQuad(
    rect: GridRect,
    v0: number,
    v1: number,
    z0: number,
    z1: number,
    color: string,
  ): void {
    const x = rect.x + rect.w;
    this.buffer.polygon(
      [
        this.p(x, v0, z0),
        this.p(x, v1, z0),
        this.p(x, v1, z1),
        this.p(x, v0, z1),
      ],
      color,
    );
  }

  box(rect: GridRect, z0: number, z1: number, faces: Faces): void {
    this.leftQuad(rect, rect.x, rect.x + rect.w, z0, z1, faces.left);
    this.rightQuad(rect, rect.y, rect.y + rect.h, z0, z1, faces.right);
    this.tile(rect, faces.top, z1);
  }

  disc(cx: number, cy: number, radius: number, color: string): void {
    const r = Math.max(1, radius);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy += 1) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.35);
      if (half <= 0 && Math.abs(dy) >= r) continue;
      this.buffer.rect(
        Math.round(cx) - half,
        Math.round(cy) + dy,
        half * 2 + 1,
        1,
        color,
      );
    }
  }
}

export function drawTree(
  painter: IsoPainter,
  tree: CityTree,
  season: Season = "summer",
): void {
  const { tile, unit: u } = painter.layout;
  const palette = SEASON_PALETTES[season];
  const base = painter.p(tree.x, tree.y);
  const radius = Math.max(1.5 * u, tile * 0.28 * tree.size);
  const green = palette.trees[tree.tone % palette.trees.length]!;
  painter.buffer.rect(base.x, base.y - 2 * u, u, 3 * u, "#7a5136");
  const cy = base.y - 2 * u - radius;
  painter.disc(base.x, cy, radius, shade(green, -0.2));
  painter.disc(base.x - 0.5 * u, cy - 0.6 * u, radius * 0.72, green);
  painter.disc(
    base.x - radius * 0.35,
    cy - radius * 0.4,
    Math.max(1, radius * 0.3),
    shade(green, 0.3),
  );
  if (palette.highlight && (season === "winter" || tree.tone === 0)) {
    // Snow caps in winter, blossoms on the flowering trees in spring.
    painter.disc(
      base.x - radius * 0.15,
      cy - radius * 0.55,
      Math.max(1, radius * 0.42),
      palette.highlight,
    );
  }
}

// Streak lighthouse: banded tower on a rock, beacon turns while lit. */
export function drawLighthouse(
  painter: IsoPainter,
  monument: CityMonument,
  waterLevel: number,
  frame: number,
  frameCount: number,
): void {
  const { tile, unit: u } = painter.layout;
  const buffer = painter.buffer;
  const rockTop = waterLevel + 3 * u;
  painter.box(monumentRect(monument), waterLevel - u, rockTop, {
    top: "#9a958c",
    left: "#7a756d",
    right: "#625e57",
  });
  const base = painter.p(monument.x, monument.y, rockTop);
  const cx = Math.round(base.x);
  const by = Math.round(base.y);
  const r0 = Math.max(2, Math.round(tile * 0.24));
  const r1 = Math.max(1, Math.round(tile * 0.15));
  const height = monument.height;
  const bands = monument.rings * 2 + 1;
  for (let z = 0; z < height; z += 1) {
    const r = Math.round(r0 + ((r1 - r0) * z) / height);
    const red = Math.floor((z / height) * bands) % 2 === 1;
    buffer.rect(cx - r, by - z, r, 1, red ? "#e04f5f" : "#f7f3ea");
    buffer.rect(cx, by - z, r + 1, 1, red ? "#b23a48" : "#cfd6df");
  }
  const top = by - height;
  buffer.rect(cx - r1 - 2 * u, top, r1 * 2 + 4 * u + 1, u, "#3d4250");
  buffer.rect(cx - r1 - 2 * u, top - u, u, u, "#3d4250");
  buffer.rect(cx + r1 + 2 * u, top - u, u, u, "#3d4250");
  const lantern = Math.max(3 * u, Math.round(tile * 0.3));
  const glass = monument.lit ? "#ffe680" : "#4a5466";
  buffer.rect(cx - r1, top - lantern, r1 * 2 + 1, lantern, glass);
  buffer.rect(cx, top - lantern, 1, lantern, "#3d4250");
  const capBase = top - lantern - 1;
  for (let row = 0; row <= r1 + 1; row += 1) {
    const half = r1 + 1 - row;
    buffer.rect(cx - half, capBase - row, half * 2 + 1, 1, "#c8463f");
  }
  buffer.rect(cx, capBase - r1 - 3 * u, 1, 2 * u, "#3d4250");
  if (!monument.lit) return;
  const angle =
    (monument.phase + frame / Math.max(1, frameCount)) * Math.PI * 2;
  const ly = top - Math.ceil(lantern / 2);
  const length = Math.round(tile * 3.2);
  for (const spread of [-0.09, 0, 0.09]) {
    const end = {
      x: cx + Math.cos(angle + spread) * length,
      y: ly + Math.sin(angle + spread) * length * 0.5,
    };
    buffer.line(cx, ly, end.x, end.y, spread === 0 ? "#fffbe0" : "#fff3b0");
  }
  buffer.rect(cx - r1, top - lantern, r1 * 2 + 1, lantern, "#fff6c8");
}

export function monumentRect(monument: CityMonument): GridRect {
  return { x: monument.x - 0.5, y: monument.y - 0.45, w: 1, h: 0.9 };
}

// Seamlessly looping snowfall: each flake falls through its own short span. */
export function drawSnow(
  buffer: PixelBuffer,
  frame: number,
  frameCount: number,
  unit = 1,
): void {
  const t = (frame % Math.max(1, frameCount)) / Math.max(1, frameCount);
  const count = Math.round((buffer.width * buffer.height) / (2600 * unit));
  const span = Math.max(24 * unit, Math.round(buffer.height * 0.18));
  for (let index = 0; index < count; index += 1) {
    const hx = Math.sin((index + 1) * 12.9898) * 43758.5453;
    const hy = Math.sin((index + 1) * 78.233) * 12345.6789;
    const fx = hx - Math.floor(hx);
    const fy = hy - Math.floor(hy);
    const fall = ((t + fy) % 1) * span;
    const drift = Math.sin((t + fx) * Math.PI * 2) * 1.5 * unit;
    // Every other flake is larger at higher detail, giving depth.
    const size = index % 2 === 0 ? Math.max(1, unit - 1) : unit;
    buffer.rect(
      Math.round(fx * buffer.width + drift),
      Math.round(fy * (buffer.height - span) + fall),
      size,
      size,
      index % 5 === 0 ? "#dfeaf1" : "#ffffff",
    );
  }
}

export function drawPerson(
  painter: IsoPainter,
  person: CityPerson,
  frame: number,
  frameCount: number,
): void {
  const swing = Math.sin(
    (frame / Math.max(1, frameCount)) * Math.PI * 2 + person.phase,
  );
  const point = painter.p(
    person.x + person.dx * swing,
    person.y + person.dy * swing,
  );
  const u = painter.layout.unit;
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  if (u === 1) {
    painter.buffer.rect(x, y - 3, 1, 3, person.color);
    painter.buffer.plot(x, y - 4, SKIN);
    return;
  }
  // At higher detail: legs, a two-tone torso, and a head.
  const legs = Math.max(1, Math.round(u * 1.2));
  const torso = Math.round(u * 1.8);
  const head = Math.max(2, u);
  const left = x - Math.floor(u / 2);
  const stride = swing > 0.3 ? 1 : swing < -0.3 ? -1 : 0;
  painter.buffer.rect(left, y - legs, 1, legs, "#3d4250");
  painter.buffer.rect(left + u - 1 + stride, y - legs, 1, legs, "#3d4250");
  painter.buffer.rect(left, y - legs - torso, u, torso, person.color);
  painter.buffer.rect(
    left + u - 1,
    y - legs - torso,
    1,
    torso,
    shade(person.color, -0.2),
  );
  painter.buffer.rect(
    x - Math.floor(head / 2),
    y - legs - torso - head,
    head,
    head,
    SKIN,
  );
}

function inset(rect: GridRect, amount: number): GridRect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    w: rect.w - amount * 2,
    h: rect.h - amount * 2,
  };
}

export function vehicleRect(pose: VehiclePose): GridRect {
  const length = pose.kind === "car" ? 0.62 : pose.kind === "bus" ? 1 : 0.9;
  const width = 0.38;
  const w = pose.dx !== 0 ? length : width;
  const h = pose.dx !== 0 ? width : length;
  return { x: pose.x - w / 2, y: pose.y - h / 2, w, h };
}

const WINDSHIELD = { top: "", left: "#2f3e57", right: "#26324a" };

export function drawVehicle(painter: IsoPainter, pose: VehiclePose): void {
  const rect = vehicleRect(pose);
  const u = painter.layout.unit;
  const along = pose.dx !== 0;
  if (pose.kind === "truck") {
    // Delivery truck (open pull request): colored cab, white cargo box.
    const forward = along ? pose.dx : pose.dy;
    const cabShare = 0.3;
    const split = (from: number, to: number): GridRect =>
      along
        ? { ...rect, x: rect.x + rect.w * from, w: rect.w * (to - from) }
        : { ...rect, y: rect.y + rect.h * from, h: rect.h * (to - from) };
    const cab = forward > 0 ? split(1 - cabShare, 1) : split(0, cabShare);
    const cargo =
      forward > 0 ? split(0, 1 - cabShare - 0.04) : split(cabShare + 0.04, 1);
    painter.box(cab, 0, 4 * u, facesFor(pose.color));
    painter.box(inset(cab, 0.04), 2 * u, 4 * u, {
      ...WINDSHIELD,
      top: shade(pose.color, 0.3),
    });
    painter.box(cargo, 0, 6 * u, facesFor("#f2f0ea", "#ffffff"));
    painter.leftQuad(
      cargo,
      cargo.x + 0.04,
      cargo.x + cargo.w - 0.04,
      2 * u,
      3 * u,
      pose.color,
    );
    painter.rightQuad(
      cargo,
      cargo.y + 0.04,
      cargo.y + cargo.h - 0.04,
      2 * u,
      3 * u,
      shade(pose.color, -0.2),
    );
    return;
  }
  const body = facesFor(pose.color);
  const height = (pose.kind === "bus" ? 5 : 3) * u;
  painter.box(rect, 0, height, body);
  if (pose.kind === "bus") {
    painter.leftQuad(
      rect,
      rect.x + 0.04,
      rect.x + rect.w - 0.04,
      2 * u,
      4 * u,
      WINDSHIELD.left,
    );
    painter.rightQuad(
      rect,
      rect.y + 0.04,
      rect.y + rect.h - 0.04,
      2 * u,
      4 * u,
      WINDSHIELD.right,
    );
    return;
  }
  const cabin = inset(rect, 0.06);
  const shrunk = along
    ? { ...cabin, x: cabin.x + cabin.w * 0.2, w: cabin.w * 0.55 }
    : { ...cabin, y: cabin.y + cabin.h * 0.2, h: cabin.h * 0.55 };
  painter.box(shrunk, height, height + 2 * u, {
    ...WINDSHIELD,
    top: shade(pose.color, 0.35),
  });
}

export function drawBoat(
  painter: IsoPainter,
  boat: CityBoat,
  waterLevel: number,
  frame: number,
  frameCount: number,
): GridRect {
  const wave = Math.sin(
    (frame / Math.max(1, frameCount)) * Math.PI * 2 + boat.phase,
  );
  const rect = boatRect(boat, wave);
  const u = painter.layout.unit;
  const bob = wave > 0.3 ? u : 0;
  painter.tile(inset(rect, -0.08), "#bfe6f7", waterLevel);
  painter.box(
    rect,
    waterLevel + bob,
    waterLevel + bob + 2 * u,
    facesFor(boat.color, shade(boat.color, 0.2)),
  );
  const cabin = {
    x: rect.x + 0.08,
    y: rect.y + rect.h * 0.4,
    w: rect.w - 0.16,
    h: rect.h * 0.35,
  };
  painter.box(
    cabin,
    waterLevel + bob + 2 * u,
    waterLevel + bob + 4 * u,
    facesFor("#f7f3ea", "#ffffff"),
  );
  return rect;
}

export function boatRect(boat: CityBoat, wave = 0): GridRect {
  return { x: boat.x - 0.22, y: boat.y + wave * 0.12, w: 0.44, h: boat.length };
}

export function drawCrane(
  painter: IsoPainter,
  crane: CityCrane,
  frame: number,
  frameCount: number,
): void {
  const { tile, unit: u } = painter.layout;
  const base = painter.p(crane.x, crane.y);
  const top = crane.height;
  const buffer = painter.buffer;
  for (let z = 0; z < top; z += 1) {
    const lattice = z % (3 * u) === 0;
    buffer.rect(
      base.x - u,
      base.y - z,
      2 * u,
      1,
      lattice ? shade(crane.color, 0.25) : crane.color,
    );
  }
  const angle =
    crane.angle +
    0.7 *
      Math.sin((frame / Math.max(1, frameCount)) * Math.PI * 2 + crane.phase);
  const tipGrid = {
    x: crane.x + Math.cos(angle) * crane.jib,
    y: crane.y + Math.sin(angle) * crane.jib,
  };
  const backGrid = {
    x: crane.x - Math.cos(angle) * crane.jib * 0.35,
    y: crane.y - Math.sin(angle) * crane.jib * 0.35,
  };
  const tip = painter.p(tipGrid.x, tipGrid.y, top);
  const back = painter.p(backGrid.x, backGrid.y, top);
  const head = painter.p(crane.x, crane.y, top);
  buffer.line(back.x, back.y, tip.x, tip.y, crane.color);
  buffer.line(back.x, back.y - 1, tip.x, tip.y - 1, shade(crane.color, 0.2));
  buffer.rect(back.x - u, back.y - u, 3 * u, 3 * u, "#6b6f78");
  buffer.line(
    head.x,
    head.y - 1,
    head.x,
    head.y - Math.round(tile * 0.5),
    crane.color,
  );
  const hookGrid = {
    x: crane.x + (tipGrid.x - crane.x) * 0.7,
    y: crane.y + (tipGrid.y - crane.y) * 0.7,
  };
  const hookTop = painter.p(hookGrid.x, hookGrid.y, top);
  const hookDrop = Math.round(
    top *
      (0.35 +
        0.15 *
          Math.sin(
            (frame / Math.max(1, frameCount)) * Math.PI * 4 + crane.phase,
          )),
  );
  buffer.line(hookTop.x, hookTop.y, hookTop.x, hookTop.y + hookDrop, "#3d4250");
  buffer.rect(hookTop.x - u, hookTop.y + hookDrop, 3 * u, 2 * u, "#e8743b");
  buffer.rect(head.x - u, head.y + u, 3 * u, 3 * u, "#f7f3ea");
}

export function drawPlane(
  buffer: PixelBuffer,
  width: number,
  height: number,
  frame: number,
  frameCount: number,
  unit = 1,
): void {
  const u = unit;
  const margin = 44 * u;
  const t = frame / Math.max(1, frameCount);
  const x = Math.round(-margin + t * (width + margin * 2));
  const y = Math.round(height * 0.035 + t * height * 0.07);
  const r = (dx: number, dy: number, w: number, h: number, color: string) =>
    buffer.rect(x + dx * u, y + dy * u, w * u, h * u, color);
  for (let index = 0; index < 18; index += 2) {
    buffer.rect(
      x - (4 + index) * u,
      y + (1 - Math.round(index * 0.15)) * u,
      u,
      1,
      "#ffffff",
    );
  }
  r(0, 0, 12, 3, "#f7f3ea");
  r(12, 1, 1, 2, "#f7f3ea");
  r(0, 2, 12, 1, "#cfd6df");
  r(0, -3, 2, 3, "#e04f5f");
  r(3, 1, 7, 1, "#4f8fe0");
  r(5, 3, 4, 1, "#cfd6df");
  r(4, 4, 3, 1, "#cfd6df");
  r(5, -1, 3, 1, "#cfd6df");
  if (u > 1) {
    // Finer cabin windows and a cockpit at higher detail.
    for (let index = 0; index < 6; index += 1)
      buffer.rect(x + (3 + index) * u + 1, y + u, Math.max(1, u - 1), u - 1, "#a9dcf2");
    buffer.rect(x + 11 * u, y + u - 1, u, u, "#35445a");
  }
}

const PIXEL_GLYPHS: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["#.#", "###", "###", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", ".##", "..#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "#.#", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "##.", "#.#", ".#."],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": [".#.", "#.#", ".#.", "#.#", ".#."],
  "9": [".#.", "#.#", ".##", "..#", "##."],
  "-": ["...", "...", "###", "...", "..."],
};

function drawPixelText(
  buffer: PixelBuffer,
  text: string,
  x: number,
  y: number,
  color: string,
  unit = 1,
): void {
  let cursor = x;
  for (const character of text) {
    const glyph = PIXEL_GLYPHS[character];
    if (glyph) {
      glyph.forEach((row, rowIndex) => {
        [...row].forEach((pixel, columnIndex) => {
          if (pixel === "#")
            buffer.rect(
              cursor + columnIndex * unit,
              y + rowIndex * unit,
              unit,
              unit,
              color,
            );
        });
      });
    }
    cursor += 4 * unit;
  }
}

// Finer 5x7 font for detailed (unit > 1) labels. */
const FINE_GLYPHS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

function drawFineText(
  buffer: PixelBuffer,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
): void {
  let cursor = x;
  for (const character of text) {
    FINE_GLYPHS[character]?.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === "#")
          buffer.rect(
            cursor + columnIndex * size,
            y + rowIndex * size,
            size,
            size,
            color,
          );
      });
    });
    cursor += 6 * size;
  }
}

// Scanline fill of a simple polygon in output pixels. */
function fillPolygon(
  buffer: PixelBuffer,
  points: ReadonlyArray<readonly [number, number]>,
  color: string,
): void {
  const ys = points.map(([, py]) => py);
  for (
    let row = Math.floor(Math.min(...ys));
    row <= Math.ceil(Math.max(...ys));
    row += 1
  ) {
    const sample = row + 0.5;
    const crossings: number[] = [];
    points.forEach(([ax, ay], index) => {
      const [bx, by] = points[(index + 1) % points.length]!;
      if ((ay <= sample && by > sample) || (by <= sample && ay > sample))
        crossings.push(ax + ((sample - ay) / (by - ay)) * (bx - ax));
    });
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const left = Math.round(crossings[index]!);
      const right = Math.round(crossings[index + 1]!);
      if (right > left) buffer.rect(left, row, right - left, 1, color);
    }
  }
}

const HULL_TONES = ["#8e99a6", "#b3bcc6", "#d6dbdf", "#ece9e1", "#f8f5ee", "#ffffff"];

// Native-resolution airship: shaded hull, fins, banner, fine lettering, gondola. */
function drawDetailedZeppelin(
  buffer: PixelBuffer,
  x: number,
  y: number,
  centerX: number,
  text: string,
  u: number,
): void {
  const cx = centerX + 0.5;
  const cy = y + 6 * u;
  const a = 34 * u + 0.5;
  const b = 6 * u;
  const inside = (px: number, py: number): boolean =>
    ((px + 0.5 - cx) / a) ** 2 + ((py + 0.5 - cy) / b) ** 2 <= 1;
  const outline = "#4f5d6e";

  // Tail fins sit behind the hull, so they are drawn first.
  const finTop: Array<readonly [number, number]> = [
    [x + 2 * u, y],
    [x + 7 * u, y],
    [x + 15 * u, cy - 3 * u],
    [x + 6 * u, cy - 1 * u],
  ];
  const finBottom = finTop.map(([px, py]) => [px, 2 * cy - py] as const);
  for (const fin of [finTop, finBottom]) {
    fillPolygon(buffer, fin, outline);
    const inset = fin.map(
      ([px, py]) =>
        [px + (px < x + 10 * u ? 1 : -1), py + (py < cy ? 1 : -1)] as const,
    );
    fillPolygon(buffer, inset, "#c94656");
    fillPolygon(
      buffer,
      inset.map(([px, py]) => [px, (py + cy) / 2 + (py - cy) * 0.5] as const),
      "#e04f5f",
    );
  }

  // Hull with spherical shading lit from the upper left.
  const left = Math.floor(cx - a);
  const right = Math.ceil(cx + a);
  for (let py = Math.floor(cy - b); py <= Math.ceil(cy + b); py += 1) {
    for (let px = left; px <= right; px += 1) {
      if (!inside(px, py)) continue;
      if (
        !inside(px - 1, py) ||
        !inside(px + 1, py) ||
        !inside(px, py - 1) ||
        !inside(px, py + 1)
      ) {
        buffer.plot(px, py, outline);
        continue;
      }
      const nx = (px + 0.5 - cx) / a;
      const ny = (py + 0.5 - cy) / b;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const light = -0.25 * nx - 0.75 * ny + 0.62 * nz;
      let tone = Math.max(
        0,
        Math.min(HULL_TONES.length - 1, Math.floor((light + 0.35) * 4.2)),
      );
      // Subtle panel seams between the hull frames.
      if ((px - x) % (6 * u) === 0 && tone > 0) tone -= 1;
      buffer.plot(px, py, HULL_TONES[tone]!);
    }
  }

  // Nose cap.
  for (let py = Math.floor(cy - b); py <= Math.ceil(cy + b); py += 1) {
    for (let px = Math.floor(cx + a - 3 * u); px <= right; px += 1) {
      if (!inside(px, py)) continue;
      const edge =
        !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
      buffer.plot(px, py, edge ? outline : py < cy - u ? "#a7b1bc" : "#8e99a6");
    }
  }

  // Banner with shaded red trim, clipped to the hull.
  const size = Math.max(1, Math.round(u * 0.6));
  const textWidth = text.length * 6 * size - size;
  const bannerHalf = Math.min(26 * u, Math.ceil(textWidth / 2) + 6 * u);
  const bannerLeft = centerX - bannerHalf;
  const bannerRight = centerX + bannerHalf + 1;
  const creamHeight = 7 * size + 4;
  const band = (top: number, bottom: number, color: (py: number) => string) => {
    for (let py = top; py < bottom; py += 1)
      for (let px = bannerLeft; px < bannerRight; px += 1)
        if (inside(px - 1, py) && inside(px + 1, py)) buffer.plot(px, py, color(py));
  };
  const cream = Math.round(cy - creamHeight / 2);
  const topTrim = cream - u;
  const bottomTrim = cream + creamHeight;
  band(topTrim, cream, (py) =>
    py === topTrim ? "#f07b88" : py === cream - 1 ? "#b83a4a" : "#e04f5f",
  );
  band(cream, bottomTrim, (py) => (py === bottomTrim - 1 ? "#e6dfcf" : "#fbf8f1"));
  band(bottomTrim, bottomTrim + u, (py) =>
    py === bottomTrim + u - 1 ? "#a93545" : "#d5485a",
  );
  for (const edgeX of [bannerLeft, bannerRight - 1])
    for (let py = topTrim; py < bottomTrim + u; py += 1)
      if (inside(edgeX, py)) buffer.plot(edgeX, py, "#8f2f3c");

  const textX = centerX - Math.floor(textWidth / 2);
  const textY = cream + Math.floor((bottomTrim - cream - 7 * size) / 2);
  drawFineText(buffer, text, textX + 1, textY + 1, "#d8cfbd", size);
  drawFineText(buffer, text, textX, textY, "#2c3a4f", size);

  // Gondola on struts, with engine pods either side.
  const gx = x + 30 * u;
  const gy = y + 17 * u;
  const gw = 16 * u;
  const gh = 4 * u;
  const strut = "#59636f";
  buffer.line(x + 31 * u, y + 11 * u, gx + 2 * u, gy, strut);
  buffer.line(x + 45 * u, y + 11 * u, gx + gw - 2 * u, gy, strut);
  buffer.line(x + 38 * u, y + 12 * u, x + 38 * u, gy, strut);
  for (const side of [-1, 1]) {
    const podX = side < 0 ? gx - 5 * u : gx + gw + u;
    const podY = gy - 2 * u;
    buffer.line(side < 0 ? gx : gx + gw, gy + u, podX + 2 * u, podY + u, strut);
    buffer.rect(podX, podY, 4 * u, 2 * u, outline);
    buffer.rect(podX + 1, podY + 1, 4 * u - 2, 2 * u - 2, "#8e99a6");
    buffer.rect(podX + 1, podY + 1, 4 * u - 2, 1, "#b3bcc6");
    const propX = side < 0 ? podX - 1 : podX + 4 * u;
    buffer.rect(propX, podY - u, 1, 4 * u, "#c9d1d9");
    buffer.plot(propX, podY + u - 1, "#35445a");
  }
  buffer.rect(gx, gy, gw, gh, "#4a3324");
  buffer.rect(gx + 1, gy + 1, gw - 2, gh - 2, "#8a6040");
  buffer.rect(gx + 1, gy + 1, gw - 2, 1, "#a9784f");
  buffer.rect(gx + 1, gy + gh - 2, gw - 2, 1, "#6b4a32");
  for (let wx = gx + u; wx + u + 1 <= gx + gw - u; wx += u + 2) {
    buffer.rect(wx, gy + u, u + 1, u + 1, "#cfeefa");
    buffer.rect(wx, gy + 2 * u, u + 1, Math.max(1, u - 1), "#7fbfdc");
  }
}

// Airship branded with the application name, hovering above the city. */
export function drawZeppelin(
  buffer: PixelBuffer,
  height: number,
  frame: number,
  frameCount: number,
  label: string,
  unit = 1,
): void {
  const u = unit;
  const t = frameCount > 1 ? frame / frameCount : 0;
  const x = Math.max(
    0,
    Math.min(buffer.width - 78 * u, Math.round(buffer.width * 0.28 - 37 * u)),
  );
  const y = Math.round(
    height * 0.06 +
      Math.sin(t * Math.PI * 2) * Math.max(u, Math.round(height * 0.008)),
  );
  const centerX = x + 37 * u;
  const text =
    label
      .toUpperCase()
      .replace(/[^A-Z0-9 -]/g, "")
      .trim()
      .slice(0, 12) || "GIT CITY";
  if (u > 1) {
    drawDetailedZeppelin(buffer, x, y, centerX, text, u);
    return;
  }

  // Hull: an ellipse with a one-pixel outline and shaded top and bottom.
  const rows = 12 * u;
  const halfWidthAt = (row: number): number => {
    if (row < 0 || row >= rows) return -1;
    const v = (row + 0.5) / u - 6;
    return Math.round(34 * u * Math.sqrt(Math.max(0, 1 - (v / 6.4) ** 2)));
  };
  for (let row = 0; row < rows; row += 1) {
    const halfWidth = halfWidthAt(row);
    const left = centerX - halfWidth;
    // Outline every pixel not covered by a neighbouring row so the edge stays closed.
    const edge = Math.max(
      1,
      halfWidth - Math.min(halfWidthAt(row - 1), halfWidthAt(row + 1)),
    );
    const hullColor =
      row < 2 * u || row >= 10 * u
        ? "#b9c1c9"
        : u > 1 && row < 3 * u
          ? "#ffffff"
          : "#f7f3ea";
    buffer.rect(left, y + row, halfWidth * 2 + 1, 1, hullColor);
    buffer.rect(left, y + row, edge, 1, "#677586");
    buffer.rect(left + halfWidth * 2 + 1 - edge, y + row, edge, 1, "#677586");
  }
  const r = (dx: number, dy: number, w: number, h: number, color: string) =>
    buffer.rect(x + dx * u, y + dy * u, w * u, h * u, color);
  r(12, 3, 51, 2, "#e04f5f");
  r(8, 5, 59, 5, "#f7f3ea");
  r(12, 10, 51, 1, "#e04f5f");

  const textWidth = (text.length * 4 - 1) * u;
  drawPixelText(
    buffer,
    text,
    centerX - Math.floor(textWidth / 2),
    y + 5 * u,
    "#35445a",
    u,
  );

  buffer.line(x + 31 * u, y + 12 * u, x + 34 * u, y + 18 * u, "#59636f");
  buffer.line(x + 44 * u, y + 12 * u, x + 41 * u, y + 18 * u, "#59636f");
  r(31, 18, 14, 4, "#8a6040");
  r(34, 19, 3, 2, "#a9dcf2");
  r(40, 19, 3, 2, "#a9dcf2");
  r(3, 5, 5, 2, "#677586");
  r(67, 5, 5, 2, "#677586");
}
