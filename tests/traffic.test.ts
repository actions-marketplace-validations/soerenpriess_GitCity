import { describe, expect, it } from "vitest";
import { createLayout } from "../src/city/grid.js";
import { createTraffic, vehiclePoses } from "../src/city/traffic.js";

const key = ({
  x,
  y,
  dx,
  dy,
  color,
  bus,
}: ReturnType<typeof vehiclePoses>[number]) =>
  `${x.toFixed(4)}:${y.toFixed(4)}:${dx}:${dy}:${color}:${bus}`;

describe("looping traffic", () => {
  const layout = createLayout(480, 270);

  it.each([1, 12, 24, 37])(
    "returns to the exact first-frame state after %i frames",
    (frameCount) => {
      for (const density of [0.1, 0.5, 1]) {
        for (const loop of createTraffic(layout, density, frameCount, 42)) {
          expect(loop.carCount % loop.vehicles.length).toBe(0);
          const first = vehiclePoses(loop, 0, frameCount).map(key).sort();
          const wrapped = vehiclePoses(loop, frameCount, frameCount)
            .map(key)
            .sort();
          expect(wrapped).toEqual(first);
        }
      }
    },
  );

  it("moves cars smoothly along the road network", () => {
    const frameCount = 24;
    const [ring] = createTraffic(layout, 0.6, frameCount, 7);
    const roadCenters = new Set([
      ...layout.roadsX.map((x) => x + 0.5),
      ...layout.roadsY.map((y) => y + 0.5),
    ]);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const now = vehiclePoses(ring!, frame, frameCount);
      const next = vehiclePoses(ring!, frame + 1, frameCount);
      now.forEach((pose, index) => {
        const step = Math.hypot(
          next[index]!.x - pose.x,
          next[index]!.y - pose.y,
        );
        expect(step).toBeGreaterThan(0);
        expect(step).toBeLessThan(1.5);
        const lane = pose.dx !== 0 ? pose.y : pose.x;
        const onRoad = [...roadCenters].some(
          (center) => Math.abs(lane - center) <= 0.3,
        );
        expect(onRoad).toBe(true);
      });
    }
  });
});
