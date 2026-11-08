import { isLand, landTiles } from "../city/grid.js";
import { vehiclePoses } from "../city/traffic.js";
import type { CityModel, GridRect, LotKind } from "../types.js";
import { pulse } from "./animation.js";
import { drawBuilding } from "./architecture/index.js";
import { PixelBuffer, shade } from "./pixelArt.js";
import { SEASON_PALETTES, type SeasonPalette } from "./seasonPalette.js";
import {
  boatRect,
  drawBoat,
  drawCrane,
  drawLighthouse,
  drawPerson,
  drawPlane,
  drawSnow,
  drawTree,
  drawVehicle,
  drawZeppelin,
  IsoPainter,
  monumentRect,
  vehicleRect,
} from "./sprites.js";

const GROUND = {
  sidewalk: "#d6cfbf",
  asphalt: "#5d6475",
  marking: "#ece6d6",
  promenade: "#e3d6bd",
  quay: "#a89f8f",
  water: "#4aa3df",
  waterDeep: "#3b8fcc",
  shimmer: "#a6dcf7",
  soil: "#9b7653",
  bedrock: "#5f5a66",
};

function lotColor(kind: LotKind, palette: SeasonPalette): string {
  switch (kind) {
    case "park":
      return palette.park;
    case "grass":
      return palette.meadow;
    case "construction":
      return "#c9a878";
    default:
      return "#e6dfcf";
  }
}

interface Drawable {
  rect: GridRect;
  draw(): void;
}

// Interface shared by browser and @napi-rs/canvas 2D contexts. */
export interface ImageTarget<T extends { data: Uint8ClampedArray }> {
  createImageData(width: number, height: number): T;
  putImageData(image: T, dx: number, dy: number): void;
}

function drawPlatform(painter: IsoPainter, city: CityModel): void {
  const { layout } = city;
  const { size, waterStart, thickness, unit: u } = layout;
  const palette = SEASON_PALETTES[city.season];
  const waterLevel = -Math.max(2 * layout.unit, Math.round(layout.tile / 4));
  const water = { x: waterStart, y: 0, w: size - waterStart, h: size };

  // River slab: a water cross-section on both front faces.
  painter.leftQuad(
    water,
    waterStart,
    size,
    -thickness,
    waterLevel,
    GROUND.waterDeep,
  );
  painter.leftQuad(
    water,
    waterStart,
    size,
    -thickness,
    -thickness + 2 * u,
    GROUND.bedrock,
  );
  painter.rightQuad(
    water,
    0,
    size,
    -thickness,
    waterLevel,
    shade(GROUND.waterDeep, -0.15),
  );
  painter.rightQuad(
    water,
    0,
    size,
    -thickness,
    -thickness + 2 * u,
    shade(GROUND.bedrock, -0.2),
  );
  painter.tile(water, GROUND.water, waterLevel);

  // Land tile by tile, back to front, so the seeded coastline gets cliffs.
  for (const { x, y } of landTiles(layout)) {
    const cell = { x, y, w: 1, h: 1 };
    if (!isLand(layout, x, y + 1)) {
      painter.leftQuad(cell, x, x + 1, -thickness, 0, GROUND.soil);
      painter.leftQuad(
        cell,
        x,
        x + 1,
        -thickness,
        -thickness + 2 * u,
        GROUND.bedrock,
      );
      painter.leftQuad(cell, x, x + 1, -2 * u, 0, palette.rim);
    }
    if (x + 1 === waterStart) {
      painter.rightQuad(cell, y, y + 1, waterLevel, 0, GROUND.quay);
    } else if (!isLand(layout, x + 1, y)) {
      painter.rightQuad(
        cell,
        y,
        y + 1,
        -thickness,
        0,
        shade(GROUND.soil, -0.15),
      );
      painter.rightQuad(
        cell,
        y,
        y + 1,
        -thickness,
        -thickness + 2 * u,
        shade(GROUND.bedrock, -0.2),
      );
      painter.rightQuad(cell, y, y + 1, -2 * u, 0, shade(palette.rim, -0.12));
    }
    painter.tile(cell, palette.grass);
  }
  const promenade = { x: waterStart - 1, y: 0, w: 1, h: size };
  painter.tile(promenade, GROUND.promenade);
  painter.rightQuad(promenade, 0, size, 0, u, "#f7f3ea");
}

function drawWaterShimmer(
  painter: IsoPainter,
  city: CityModel,
  frame: number,
): void {
  const { layout } = city;
  const waterLevel = -Math.max(2 * layout.unit, Math.round(layout.tile / 4));
  const width = layout.size - layout.waterStart;
  const count = Math.round((26 * layout.size) / 32);
  for (let index = 0; index < count; index += 1) {
    const gx = layout.waterStart + 0.3 + ((index * 0.618) % 1) * (width - 0.6);
    const gy = 0.5 + ((index * 7.31) % (layout.size - 1));
    if (pulse(frame, city.frameCount, index * 1.7) < 0.45) continue;
    const point = painter.p(gx, gy, waterLevel);
    painter.buffer.rect(point.x, point.y, 3 * layout.unit, 1, GROUND.shimmer);
    if (index % 4 === 0)
      painter.buffer.rect(
        point.x + layout.unit,
        point.y + 1,
        2 * layout.unit,
        1,
        city.waterAccent,
      );
  }
}

function drawWaterfront(painter: IsoPainter, city: CityModel): void {
  const { layout, waterfront } = city;
  const waterLevel = -Math.max(2 * layout.unit, Math.round(layout.tile / 4));
  if (waterfront === "harbor") return;
  if (waterfront === "garden") {
    for (let index = 0; index < 3; index += 1) {
      const point = painter.p(
        layout.waterStart + 1 + (index % 2) * 1.4,
        3 + index * 3.1,
        waterLevel,
      );
      const u = layout.unit;
      painter.buffer.rect(point.x - u, point.y, 3 * u, u, "#78bd62");
      painter.buffer.rect(point.x, point.y - u, u, u, city.waterAccent);
    }
    return;
  }
  for (const y of [layout.size * 0.32, layout.size * 0.68]) {
    painter.box(
      {
        x: layout.waterStart + 0.45,
        y,
        w: Math.max(1.2, layout.size - layout.waterStart - 0.9),
        h: 0.18,
      },
      waterLevel,
      waterLevel + 2 * layout.unit,
      { top: city.waterAccent, left: "#526575", right: "#3d5262" },
    );
  }
}

function drawBridge(painter: IsoPainter, city: CityModel): void {
  if (!city.bridge) return;
  const { layout } = city;
  const waterLevel = -Math.max(2 * layout.unit, Math.round(layout.tile / 4));
  const bridge = {
    x: layout.waterStart - 0.65,
    y: layout.size * 0.52,
    w: layout.size - layout.waterStart + 0.4,
    h: 0.48,
  };
  const u = layout.unit;
  painter.box(bridge, waterLevel, u, {
    top: "#c89b68",
    left: "#98704a",
    right: "#795638",
  });
  for (const y of [bridge.y, bridge.y + bridge.h]) {
    let previous: ReturnType<IsoPainter["p"]> | undefined;
    for (let x = bridge.x; x <= bridge.x + bridge.w; x += 0.6) {
      const base = painter.p(x, y, u);
      const top = painter.p(x, y, 3 * u);
      painter.buffer.line(base.x, base.y, top.x, top.y, "#70553c");
      if (previous)
        painter.buffer.line(previous.x, previous.y, top.x, top.y, "#e2bd82");
      previous = top;
    }
  }
}

function drawRoads(painter: IsoPainter, city: CityModel): void {
  const { roadsX, roadsY } = city.layout;
  if (roadsX.length === 0 || roadsY.length === 0) return;
  const minX = roadsX[0]!;
  const maxX = roadsX[roadsX.length - 1]! + 1;
  const minY = roadsY[0]!;
  const maxY = roadsY[roadsY.length - 1]! + 1;
  const strips: GridRect[] = [
    ...roadsY.map((y) => ({ x: minX, y, w: maxX - minX, h: 1 })),
    ...roadsX.map((x) => ({ x, y: minY, w: 1, h: maxY - minY })),
  ];
  for (const strip of strips) painter.tile(strip, GROUND.sidewalk);
  const edge = 0.14;
  for (const strip of strips) {
    painter.tile(
      strip.h === 1
        ? {
            x: strip.x + edge,
            y: strip.y + edge,
            w: strip.w - edge * 2,
            h: 1 - edge * 2,
          }
        : {
            x: strip.x + edge,
            y: strip.y + edge,
            w: 1 - edge * 2,
            h: strip.h - edge * 2,
          },
      GROUND.asphalt,
    );
  }
  const crossesX = new Set(roadsX);
  const crossesY = new Set(roadsY);
  for (const y of roadsY) {
    for (let x = minX + 1; x < maxX - 1; x += 1) {
      if (crossesX.has(x)) continue;
      const a = painter.p(x + 0.3, y + 0.5);
      const b = painter.p(x + 0.7, y + 0.5);
      painter.buffer.line(a.x, a.y, b.x, b.y, GROUND.marking);
    }
  }
  for (const x of roadsX) {
    for (let y = minY + 1; y < maxY - 1; y += 1) {
      if (crossesY.has(y)) continue;
      const a = painter.p(x + 0.5, y + 0.3);
      const b = painter.p(x + 0.5, y + 0.7);
      painter.buffer.line(a.x, a.y, b.x, b.y, GROUND.marking);
    }
  }
}

function sortDrawables(items: Drawable[]): Drawable[] {
  const count = items.length;
  const edges: number[][] = Array.from({ length: count }, () => []);
  const indegree = new Array<number>(count).fill(0);
  const eps = 1e-6;
  const behind = (a: GridRect, b: GridRect): boolean =>
    (a.x + a.w <= b.x + eps && !(b.y + b.h <= a.y + eps)) ||
    (a.y + a.h <= b.y + eps && !(b.x + b.w <= a.x + eps));
  for (let i = 0; i < count; i += 1) {
    const a = items[i]!.rect;
    for (let j = i + 1; j < count; j += 1) {
      const b = items[j]!.rect;
      // Skip pairs that cannot overlap horizontally on screen.
      if (
        a.x + a.w - b.y <= b.x - (a.y + a.h) ||
        b.x + b.w - a.y <= a.x - (b.y + b.h)
      )
        continue;
      if (behind(a, b)) {
        edges[i]!.push(j);
        indegree[j]! += 1;
      } else if (behind(b, a)) {
        edges[j]!.push(i);
        indegree[i]! += 1;
      }
    }
  }
  const depth = items.map(
    ({ rect }) => rect.x + rect.y + (rect.w + rect.h) / 2,
  );
  const done = new Array<boolean>(count).fill(false);
  const ordered: Drawable[] = [];
  for (let step = 0; step < count; step += 1) {
    let best = -1;
    let fallback = -1;
    for (let index = 0; index < count; index += 1) {
      if (done[index]) continue;
      if (fallback < 0 || depth[index]! < depth[fallback]!) fallback = index;
      if (indegree[index] === 0 && (best < 0 || depth[index]! < depth[best]!))
        best = index;
    }
    const chosen = best >= 0 ? best : fallback;
    done[chosen] = true;
    ordered.push(items[chosen]!);
    for (const next of edges[chosen]!) indegree[next]! -= 1;
  }
  return ordered;
}

// Render one frame into a transparent RGBA pixel buffer. */
export function renderPixels(city: CityModel, frame: number): PixelBuffer {
  const buffer = new PixelBuffer(city.width, city.height);
  const painter = new IsoPainter(buffer, city.layout);
  const { frameCount } = city;
  const { unit } = city.layout;
  const waterLevel = -Math.max(2 * city.layout.unit, Math.round(city.layout.tile / 4));

  drawPlatform(painter, city);
  drawWaterShimmer(painter, city, frame);
  const palette = SEASON_PALETTES[city.season];
  for (const lot of city.lots) painter.tile(lot, lotColor(lot.kind, palette));
  drawRoads(painter, city);
  drawWaterfront(painter, city);
  drawBridge(painter, city);
  for (const boat of city.boats) {
    if (city.waterfront !== "harbor") continue;
    const pier = {
      x: city.layout.waterStart,
      y: boat.y - 0.75,
      w: boat.x - 0.25 - city.layout.waterStart,
      h: 0.3,
    };
    painter.box(pier, waterLevel, 0, {
      top: "#b98a5e",
      left: "#8d6544",
      right: "#7a5639",
    });
  }

  const items: Drawable[] = [
    ...city.buildings.map((building) => ({
      rect: building,
      draw: () => drawBuilding(painter, building, frame, frameCount),
    })),
    ...city.trees.map((tree) => ({
      rect: { x: tree.x - 0.2, y: tree.y - 0.2, w: 0.4, h: 0.4 },
      draw: () => drawTree(painter, tree, city.season),
    })),
    ...city.people.map((person) => ({
      rect: { x: person.x - 0.05, y: person.y - 0.05, w: 0.1, h: 0.1 },
      draw: () => drawPerson(painter, person, frame, frameCount),
    })),
    ...city.cranes.map((crane) => ({
      rect: { x: crane.x - 0.1, y: crane.y - 0.1, w: 0.2, h: 0.2 },
      draw: () => drawCrane(painter, crane, frame, frameCount),
    })),
    ...city.boats.map((boat) => ({
      rect: boatRect(boat),
      draw: () => {
        drawBoat(painter, boat, waterLevel, frame, frameCount);
      },
    })),
    ...(city.monument
      ? [
          {
            rect: monumentRect(city.monument),
            draw: () =>
              drawLighthouse(
                painter,
                city.monument!,
                waterLevel,
                frame,
                frameCount,
              ),
          },
        ]
      : []),
    ...city.traffic.flatMap((loop) =>
      vehiclePoses(loop, frame, frameCount).map((pose) => ({
        rect: vehicleRect(pose),
        draw: () => drawVehicle(painter, pose),
      })),
    ),
  ];
  for (const item of sortDrawables(items)) item.draw();

  if (city.season === "winter") drawSnow(buffer, frame, frameCount, unit);
  if (city.plane && frameCount > 1) {
    drawPlane(buffer, city.width, city.height, frame, frameCount, unit);
  }
  if (city.zeppelin) {
    drawZeppelin(buffer, city.height, frame, frameCount, city.zeppelin, unit);
  }
  return buffer;
}

// Render one frame into any 2D canvas context (browser or @napi-rs/canvas). */
export function renderFrame<T extends { data: Uint8ClampedArray }>(
  context: ImageTarget<T>,
  city: CityModel,
  frame: number,
): void {
  const pixels = renderPixels(city, frame);
  const image = context.createImageData(pixels.width, pixels.height);
  image.data.set(pixels.data);
  context.putImageData(image, 0, 0);
}
