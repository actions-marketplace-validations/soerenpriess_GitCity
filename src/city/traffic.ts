import type {
  CityLayout,
  GridPoint,
  TrafficLoop,
  VehicleKind,
} from "../types.js";
import { mulberry32 } from "./seed.js";

const CAR_COLORS = [
  "#e04f5f",
  "#f7f3ea",
  "#4f8fe0",
  "#f2c94c",
  "#3fb39d",
  "#9b6bd6",
];

// Lane offset from the road centre line, in tiles. */
export const LANE_OFFSET = 0.22;

export interface VehiclePose {
  x: number;
  y: number;
  // Unit direction of travel on the grid. */
  dx: number;
  dy: number;
  color: string;
  kind: VehicleKind;
}

function loopLength(corners: GridPoint[]): number {
  return corners.reduce((sum, corner, index) => {
    const next = corners[(index + 1) % corners.length]!;
    return sum + Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
  }, 0);
}

/**
 * Rectangle loops. Inner block loops run clockwise and the outer ring runs
 * counter-clockwise so that every shared road carries opposite directions in
 * separate lanes.
 */
function rectangle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  clockwise: boolean,
): GridPoint[] {
  const corners = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return clockwise ? corners : [corners[0]!, ...corners.slice(1).reverse()];
}

function createLoop(
  corners: GridPoint[],
  spacing: number,
  frameCount: number,
  random: () => number,
  truckShare: number,
): TrafficLoop {
  const length = loopLength(corners);
  // Distance a car should cover per animation loop (about 0.42 tiles/frame).
  const travel = 0.42 * Math.max(1, frameCount);
  const cycle = Math.max(1, Math.min(4, Math.round(travel / spacing)));
  const carCount = Math.max(
    cycle,
    Math.round(length / spacing / cycle) * cycle,
  );
  const vehicles = Array.from({ length: cycle }, (_, index) => {
    const color = CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]!;
    const roll = random();
    let kind: VehicleKind = "car";
    if (index === 0 && cycle > 1 && roll < 0.4) kind = "bus";
    else if (index > 0 && roll < truckShare) kind = "truck";
    return { color, kind };
  });
  // With open pull requests, every loop carries at least one delivery truck.
  if (truckShare > 0 && !vehicles.some(({ kind }) => kind === "truck")) {
    vehicles[vehicles.length - 1]!.kind = "truck";
  }
  return { corners, carCount, vehicles };
}

export function createTraffic(
  layout: CityLayout,
  density: number,
  frameCount: number,
  seed: number,
  truckShare = 0,
): TrafficLoop[] {
  const random = mulberry32(seed ^ 0x7a2f);
  const { roadsX, roadsY } = layout;
  if (roadsX.length < 2 || roadsY.length < 2) return [];
  const spacing = 14 - density * 9;
  const loops: TrafficLoop[] = [
    createLoop(
      rectangle(
        roadsX[0]! + 0.5,
        roadsY[0]! + 0.5,
        roadsX[roadsX.length - 1]! + 0.5,
        roadsY[roadsY.length - 1]! + 0.5,
        false,
      ),
      spacing,
      frameCount,
      random,
      truckShare,
    ),
  ];
  const blocks: Array<[number, number]> = [];
  for (let ix = 0; ix + 1 < roadsX.length; ix += 1) {
    for (let iy = 0; iy + 1 < roadsY.length; iy += 1) blocks.push([ix, iy]);
  }
  const innerLoops = Math.min(blocks.length, Math.round(density * 3));
  for (let index = 0; index < innerLoops; index += 1) {
    const [[ix, iy]] = blocks.splice(
      Math.floor(random() * blocks.length),
      1,
    ) as [[number, number]];
    loops.push(
      createLoop(
        rectangle(
          roadsX[ix]! + 0.5,
          roadsY[iy]! + 0.5,
          roadsX[ix + 1]! + 0.5,
          roadsY[iy + 1]! + 0.5,
          true,
        ),
        Math.max(4, spacing * 0.7),
        frameCount,
        random,
        truckShare,
      ),
    );
  }
  return loops;
}

function pointAt(
  corners: GridPoint[],
  distance: number,
): { x: number; y: number; dx: number; dy: number } {
  let remaining = distance;
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]!;
    const b = corners[(index + 1) % corners.length]!;
    const segment = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (remaining <= segment || index === corners.length - 1) {
      const dx = Math.sign(b.x - a.x);
      const dy = Math.sign(b.y - a.y);
      return { x: a.x + dx * remaining, y: a.y + dy * remaining, dx, dy };
    }
    remaining -= segment;
  }
  throw new Error("A traffic loop needs at least one corner.");
}

/**
 * Car poses for one frame. Each car advances exactly `vehicles.length`
 * spacings per animation loop, so frame `frameCount` equals frame 0.
 */
export function vehiclePoses(
  loop: TrafficLoop,
  frame: number,
  frameCount: number,
): VehiclePose[] {
  const length = loopLength(loop.corners);
  const spacing = length / loop.carCount;
  const progress =
    (loop.vehicles.length * spacing * frame) / Math.max(1, frameCount);
  return Array.from({ length: loop.carCount }, (_, index) => {
    const distance = (index * spacing + progress) % length;
    const { x, y, dx, dy } = pointAt(loop.corners, distance);
    const vehicle = loop.vehicles[index % loop.vehicles.length]!;
    return {
      x: x - dy * LANE_OFFSET,
      y: y + dx * LANE_OFFSET,
      dx,
      dy,
      color: vehicle.color,
      kind: vehicle.kind,
    };
  });
}
