import { hexToRgb, rgbToHex, shade } from "../pixelArt.js";
import { facesFor } from "../sprites.js";
import { center, type Ctx, inset, noise, quad, spans } from "./kit.js";

const IVY = ["#4f8a3a", "#6aa84f", "#3d7a34"];
const STONE = "#7a7064";

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const lerp = (x: number, y: number): number =>
    Math.round(x + (y - x) * amount);
  return rgbToHex([lerp(ar, br), lerp(ag, bg), lerp(ab, bb)]);
}

/**
 * An abandoned repository: a roofless, weathered shell with broken walls,
 * dark empty windows, ivy and a sapling growing out of the ruin.
 */
export function drawRuin(ctx: Ctx): number {
  const { painter, b, floor, tile } = ctx;
  const wall = mix(b.color, STONE, 0.72);
  const faces = facesFor(wall, shade(wall, 0.1));
  const base = Math.max(floor, Math.round(b.height * 0.4));

  painter.box(b, 0, base, faces);
  painter.tile(inset(b, 0.1), "#4a423a", base);
  // Faded band in the language color: a hint of what the building once was.
  painter.leftQuad(b, b.x, b.x + b.w, floor, floor + 1, mix(b.accent, wall, 0.5));
  painter.rightQuad(
    b,
    b.y,
    b.y + b.h,
    floor,
    floor + 1,
    shade(mix(b.accent, wall, 0.5), -0.18),
  );

  for (const { side, start, length } of spans(b)) {
    const color = side === "left" ? faces.left : faces.right;
    const windows = Math.max(1, Math.round(length * 1.6));
    for (let z = Math.round(floor * 0.6); z + 2 < base; z += floor) {
      for (let index = 0; index < windows; index += 1) {
        if (noise(b.variant, index, z) < 0.25) continue;
        const u = start + ((index + 0.5) / windows) * length;
        quad(painter, b, side, u - 0.08, u + 0.08, z, z + 2, "#2a2622");
      }
    }
    // Jagged remains of the upper storeys.
    const pieces = Math.max(2, Math.round(length * 3));
    for (let index = 0; index < pieces; index += 1) {
      const roll = noise(b.variant, index, side === "left" ? 1 : 2);
      const top = base + Math.round(roll * (b.height - base));
      if (top <= base + 1) continue;
      const u0 = start + (index / pieces) * length;
      const u1 = start + ((index + 1) / pieces) * length;
      quad(painter, b, side, u0, u1, base, top, color);
      quad(painter, b, side, u0, u1, top - 1, top, shade(wall, 0.18));
    }
    // Ivy strands creeping up from the ground.
    const strands = Math.max(3, Math.round(length * 4));
    for (let index = 0; index < strands; index += 1) {
      const u = start + noise(b.variant, index, side === "left" ? 7 : 8) * length;
      const reach = Math.round(
        base * (0.4 + 0.6 * noise(b.variant, index, 9)),
      );
      const foot =
        side === "left"
          ? painter.p(u, b.y + b.h, 0)
          : painter.p(b.x + b.w, u, 0);
      for (let z = 0; z < reach; z += 1) {
        const wobble = Math.round(Math.sin(z * 0.9 + index) * 0.6);
        painter.buffer.plot(
          foot.x + wobble,
          foot.y - z,
          IVY[(index + z) % IVY.length]!,
        );
      }
    }
  }

  // A sapling has taken root inside the roofless shell.
  const c = center(b);
  const root = painter.p(c.x, c.y, base);
  const u = painter.layout.unit;
  const radius = Math.max(1.5 * u, tile * 0.2);
  painter.buffer.rect(root.x, root.y - 3 * u, u, 3 * u, "#6b4a32");
  painter.disc(root.x, root.y - 3 * u - radius, radius, "#4f8a3a");
  painter.disc(
    root.x - 0.5 * u,
    root.y - 3.6 * u - radius,
    radius * 0.6,
    "#6aa84f",
  );

  // Rubble along the front wall.
  for (let index = 0; index < 3; index += 1) {
    const u = b.x + (0.15 + 0.3 * index) * b.w;
    painter.box(
      { x: u, y: b.y + b.h + 0.02, w: 0.14, h: 0.1 },
      0,
      (1 + (index % 2)) * u,
      facesFor(shade(STONE, 0.05)),
    );
  }
  return Math.max(base, b.height);
}
