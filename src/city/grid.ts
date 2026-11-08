import type { CityLayout, Coastline, GridPoint, GridRect } from "../types.js";
import { mulberry32 } from "./seed.js";

// Largest platform (tiles per edge); smaller profiles get smaller islands. */
export const GRID_SIZE = 32;
export const MIN_GRID_SIZE = 12;
// How far (in tiles) the seeded coastline may reach beyond the base square. */
export const COAST_MARGIN = 3;
const TARGET_BLOCK = 8;

function evenlySpaced(first: number, last: number): number[] {
  const segments = Math.max(1, Math.round((last - first) / TARGET_BLOCK));
  return Array.from({ length: segments + 1 }, (_, index) =>
    Math.round(first + (index * (last - first)) / segments),
  );
}

/**
 * One coastline edge: smooth seeded waves plus an optional peninsula. Values
 * are clamped to [-1, margin]; -1 only bites into the outer tile ring, which
 * never carries roads or lots.
 */
function coastEdge(
  length: number,
  margin: number,
  random: () => number,
): number[] {
  const f1 = 0.16 + random() * 0.3;
  const f2 = 0.45 + random() * 0.5;
  const p1 = random() * Math.PI * 2;
  const p2 = random() * Math.PI * 2;
  const a1 = 0.7 + random() * 1.3;
  const a2 = 0.3 + random() * 0.7;
  const bias = -0.3 + random() * 1.4;
  const peninsula = random() < 0.6;
  const center = random() * length;
  const reach = 1.5 + random() * 2;
  const width = 1.2 + random() * 2.2;
  return Array.from({ length }, (_, index) => {
    let value =
      bias + a1 * Math.sin(f1 * index + p1) + a2 * Math.sin(f2 * index + p2);
    if (peninsula) value += reach * Math.exp(-(((index - center) / width) ** 2));
    return Math.max(-1, Math.min(margin, Math.round(value)));
  });
}

// A square coastline: the original rectangular platform. */
export function flatCoast(size: number, waterStart: number): Coastline {
  return {
    margin: 0,
    north: new Array<number>(waterStart).fill(0),
    west: new Array<number>(size).fill(0),
    south: new Array<number>(waterStart).fill(0),
  };
}

export function createCoast(
  size: number,
  waterStart: number,
  seed: number,
): Coastline {
  const random = mulberry32(seed ^ 0xc0a57);
  const margin = COAST_MARGIN;
  // The riverside promenade and its neighbour stay straight.
  const calm = (values: number[]): number[] =>
    values.map((value, index) =>
      index - margin >= waterStart - 2 ? 0 : value,
    );
  return {
    margin,
    north: calm(coastEdge(waterStart + margin, margin, random)),
    west: coastEdge(size + margin * 2, margin, random),
    south: calm(coastEdge(waterStart + margin, margin, random)),
  };
}

// Whether the integer tile (x, y) is land (not river, not open sky). */
export function isLand(layout: CityLayout, x: number, y: number): boolean {
  const { coast, size, waterStart } = layout;
  const margin = coast.margin;
  if (x >= waterStart || x < -margin || y < -margin || y >= size + margin)
    return false;
  if (x < -coast.west[y + margin]!) return false;
  if (y < -coast.north[x + margin]!) return false;
  return y < size + coast.south[x + margin]!;
}

// All land tiles, ordered back to front for painting. */
export function landTiles(layout: CityLayout): GridPoint[] {
  const tiles: GridPoint[] = [];
  const margin = layout.coast.margin;
  for (let y = -margin; y < layout.size + margin; y += 1) {
    for (let x = -margin; x < layout.waterStart; x += 1) {
      if (isLand(layout, x, y)) tiles.push({ x, y });
    }
  }
  return tiles.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
}

// Land tiles outside the base square: the island's seeded outcrops. */
export function coastalTiles(layout: CityLayout): GridPoint[] {
  return landTiles(layout).filter(
    ({ x, y }) => x < 0 || y < 0 || y >= layout.size,
  );
}

/**
 * Tile size is fixed by the largest platform, so a small profile really is a
 * small island in the same frame. Smaller islands are centred on the same
 * point as the full-size platform. Passing a seed shapes a unique coastline.
 */
export function createLayout(
  width: number,
  height: number,
  size = GRID_SIZE,
  roads = true,
  coastSeed?: number,
  unit = 1,
): CityLayout {
  const fit = Math.min(
    (width * 0.84) / GRID_SIZE,
    (height * 0.74 * 2) / GRID_SIZE,
  );
  const tile = Math.max(4, 2 * Math.floor(fit / 2));
  const thickness = Math.max(3, Math.round(tile * 0.75));
  const waterStart = size - (size < 20 ? 3 : 4);
  const fullOriginY =
    height -
    (GRID_SIZE * tile) / 2 -
    thickness -
    Math.max(2, Math.round(tile / 4));
  // Higher detail scales the whole composition exactly, so only the pixel
  // density changes, not the arrangement.
  return {
    size,
    waterStart,
    roadsX: roads ? evenlySpaced(1, waterStart - 2) : [],
    roadsY: roads ? evenlySpaced(1, size - 2) : [],
    tile: tile * unit,
    originX: Math.round(width / 2) * unit,
    originY: Math.round(fullOriginY + ((GRID_SIZE - size) * tile) / 4) * unit,
    thickness: thickness * unit,
    unit,
    coast:
      coastSeed === undefined
        ? flatCoast(size, waterStart)
        : createCoast(size, waterStart, coastSeed),
  };
}

// City blocks enclosed by consecutive roads. */
export function cityBlocks(layout: CityLayout): GridRect[] {
  const blocks: GridRect[] = [];
  for (let ix = 0; ix + 1 < layout.roadsX.length; ix += 1) {
    for (let iy = 0; iy + 1 < layout.roadsY.length; iy += 1) {
      const x = layout.roadsX[ix]! + 1;
      const y = layout.roadsY[iy]! + 1;
      blocks.push({
        x,
        y,
        w: layout.roadsX[ix + 1]! - x,
        h: layout.roadsY[iy + 1]! - y,
      });
    }
  }
  return blocks;
}

// Recursively split a block into seeded lots of two to three tiles. */
export function subdivide(block: GridRect, random: () => number): GridRect[] {
  const splitX = block.w > 3 && (block.w >= block.h || block.h <= 3);
  const splitY = !splitX && block.h > 3;
  if (!splitX && !splitY) return [block];
  const length = splitX ? block.w : block.h;
  const cut = 2 + Math.floor(random() * (length - 3));
  const [first, second]: [GridRect, GridRect] = splitX
    ? [
        { ...block, w: cut },
        { ...block, x: block.x + cut, w: block.w - cut },
      ]
    : [
        { ...block, h: cut },
        { ...block, y: block.y + cut, h: block.h - cut },
      ];
  return [...subdivide(first, random), ...subdivide(second, random)];
}

// Project a grid position (and height in pixels) to screen coordinates. */
export function project(
  layout: CityLayout,
  x: number,
  y: number,
  z = 0,
): { x: number; y: number } {
  return {
    x: layout.originX + ((x - y) * layout.tile) / 2,
    y: layout.originY + ((x + y) * layout.tile) / 4 - z,
  };
}
