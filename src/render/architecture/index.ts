import type { Architecture, CityBuilding } from "../../types.js";
import { languageStyle } from "../../analysis/languagePalette.js";
import { pulse } from "../animation.js";
import { drawRepositoryBadges } from "../repositoryBadges.js";
import { shade } from "../pixelArt.js";
import { facesFor, type IsoPainter } from "../sprites.js";
import { drawCreative, drawLibrary } from "./civic.js";
import { drawBrick, drawIndustrial, drawMonolith, drawTech } from "./heavy.js";
import { center, type Ctx, floorHeight } from "./kit.js";
import {
  drawData,
  drawEco,
  drawFunctional,
  drawGlass,
  drawNeon,
  drawOperations,
} from "./modern.js";
import { ellipse } from "./shapes.js";
import { drawRuin } from "./ruin.js";

const FAMILIES: Record<Architecture, (ctx: Ctx) => number> = {
  glass: drawGlass,
  eco: drawEco,
  industrial: drawIndustrial,
  functional: drawFunctional,
  monolith: drawMonolith,
  tech: drawTech,
  creative: drawCreative,
  neon: drawNeon,
  library: drawLibrary,
  operations: drawOperations,
  data: drawData,
  brick: drawBrick,
};

const CROWD = [
  "#e04f5f",
  "#4f8fe0",
  "#f2c94c",
  "#f7f3ea",
  "#9b6bd6",
  "#3fb39d",
];

function drawConstruction(ctx: Ctx): void {
  const { painter, b, floor } = ctx;
  painter.box(b, 0, b.height, facesFor("#b9b2a6", "#8f877a"));
  for (let z = floor; z < b.height; z += floor) {
    painter.leftQuad(b, b.x, b.x + b.w, z, z + 1, "#7d766b");
    painter.rightQuad(b, b.y, b.y + b.h, z, z + 1, "#6b655b");
  }
  const scaffold = "#f2b632";
  for (const corner of [
    painter.p(b.x, b.y + b.h),
    painter.p(b.x + b.w, b.y + b.h),
    painter.p(b.x + b.w, b.y),
  ]) {
    painter.buffer.line(
      corner.x,
      corner.y,
      corner.x,
      corner.y - b.height - floor,
      scaffold,
    );
  }
  for (let z = floor; z <= b.height + floor; z += floor * 2) {
    painter.leftQuad(b, b.x, b.x + b.w, z, z + 1, scaffold);
    painter.rightQuad(b, b.y, b.y + b.h, z, z + 1, shade(scaffold, -0.2));
  }
}

// Followers' stadium: oval stands, a cheering crowd wave, floodlights. */
function drawStadium(ctx: Ctx): void {
  const { painter, b, tile, frame, frameCount } = ctx;
  const c = center(b);
  const rx = b.w / 2;
  const ry = b.h / 2;
  const H = b.height;
  for (let z = 0; z < H; z += 1) {
    const stripe = z >= H - 3 && z < H - 1;
    painter.buffer.polygon(
      ellipse(painter, c.x, c.y, rx, ry, z),
      stripe ? b.accent : "#b8c0c8",
    );
  }
  painter.buffer.polygon(ellipse(painter, c.x, c.y, rx, ry, H), b.color);
  painter.buffer.polygon(
    ellipse(painter, c.x, c.y, rx * 0.8, ry * 0.8, H),
    "#9aa3ad",
  );
  painter.buffer.polygon(
    ellipse(painter, c.x, c.y, rx * 0.6, ry * 0.6, H - 2),
    b.roofColor,
  );
  painter.buffer.polygon(
    ellipse(painter, c.x, c.y, rx * 0.6, ry * 0.25, H - 2),
    shade(b.roofColor, 0.12),
  );
  const a = painter.p(c.x, c.y - ry * 0.6, H - 2);
  const d = painter.p(c.x, c.y + ry * 0.6, H - 2);
  painter.buffer.line(a.x, a.y, d.x, d.y, "#f7f3ea");
  // Crowd wave: a bump travels once around the stands per loop.
  const seats = 32;
  const t = frame / Math.max(1, frameCount);
  for (let index = 0; index < seats; index += 1) {
    const angle = (index / seats) * Math.PI * 2;
    const point = painter.p(
      c.x + Math.cos(angle) * rx * 0.7,
      c.y + Math.sin(angle) * ry * 0.7,
      H,
    );
    const u = painter.layout.unit;
    const wave = Math.cos(angle - t * Math.PI * 2) > 0.85 ? u : 0;
    painter.buffer.rect(
      Math.round(point.x),
      Math.round(point.y) - u - wave,
      u,
      u,
      CROWD[index % CROWD.length]!,
    );
  }
  for (const [fx, fy] of [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ] as const) {
    const base = painter.p(fx, fy);
    const mast = Math.round(tile * 2.2);
    painter.buffer.line(base.x, base.y, base.x, base.y - mast, "#8e96a3");
    const u = painter.layout.unit;
    painter.buffer.rect(
      Math.round(base.x) - u,
      Math.round(base.y) - mast - u,
      3 * u,
      2 * u,
      "#fff6c8",
    );
  }
}

const STAR = [
  "...#...",
  "..###..",
  "#######",
  ".#####.",
  "..###..",
  ".##.##.",
  ".#...#.",
];

// Golden star above the most-starred repository, gently twinkling. */
function drawStar(ctx: Ctx, top: number): void {
  const { painter, b, tile, frame, frameCount } = ctx;
  const u = painter.layout.unit;
  const c = center(b);
  const base = painter.p(c.x, c.y, top);
  const mast = Math.round(tile * 0.6);
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  painter.buffer.line(x, y, x, y - mast, "#d8d8d8");
  const sy = y - mast - STAR.length * u;
  STAR.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "#") {
        painter.buffer.rect(
          x + (dx - 3) * u,
          sy + dy * u,
          u,
          u,
          dy < 3 ? "#ffe680" : "#f2b632",
        );
      }
    });
  });
  if (u > 1) painter.buffer.rect(x - 1, sy + 2 * u, 2, 2, "#fff6c8");
  if (pulse(frame, frameCount, b.variant) > 0.6) {
    for (const [dx, dy] of [
      [-5, 2],
      [5, 2],
      [0, -2],
    ] as const) {
      painter.buffer.rect(x + dx * u, sy + dy * u, u, u, "#ffffff");
    }
  }
}

export function drawBuilding(
  painter: IsoPainter,
  building: CityBuilding,
  frame: number,
  frameCount: number,
): void {
  const tile = painter.layout.tile;
  const ctx: Ctx = {
    painter,
    b: building,
    frame,
    frameCount,
    tile,
    floor: floorHeight(tile),
  };
  if (building.construction) {
    drawConstruction(ctx);
    return;
  }
  if (building.form === "stadium") {
    drawStadium(ctx);
    return;
  }
  if (building.abandoned) {
    drawRuin(ctx);
    drawRepositoryBadges(painter, building);
    return;
  }
  const top = FAMILIES[building.architecture](ctx);
  drawRepositoryBadges(painter, building);
  if (building.secondaryLanguages.length > 0) {
    const u = painter.layout.unit;
    const c = center(building);
    const mark = painter.p(c.x, c.y, top + u);
    const count = Math.min(3, building.secondaryLanguages.length);
    const startX = Math.round(mark.x) - Math.floor(((count * 3 - 1) * u) / 2);
    building.secondaryLanguages.slice(0, count).forEach((language, index) => {
      painter.buffer.rect(
        startX + index * 3 * u,
        Math.round(mark.y) - u,
        2 * u,
        2 * u,
        languageStyle(language).accent,
      );
    });
  }
  if (building.landmark) drawStar(ctx, top);
}
