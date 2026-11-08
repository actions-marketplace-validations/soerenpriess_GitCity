import type { CityBuilding, RepositoryDistinction } from "../types.js";
import type { IsoPainter } from "./sprites.js";

const BADGES: Record<
  RepositoryDistinction,
  { pixels: readonly string[]; color: string }
> = {
  active: { pixels: ["..#", ".#.", "###", ".#.", "#.."], color: "#ffd66b" },
  newest: { pixels: ["#.#", "#.#", ".#.", ".#.", "###"], color: "#7be08a" },
  forked: { pixels: ["#.#", "#.#", "###", ".#.", ".#."], color: "#a7d9ff" },
};

export function drawRepositoryBadges(
  painter: IsoPainter,
  building: CityBuilding,
): void {
  const distinctions = building.repository?.distinctions;
  if (!distinctions?.length) return;

  const u = painter.layout.unit;
  const faceWidth = Math.max(
    3,
    Math.floor((building.w * painter.layout.tile) / 2 / u),
  );
  const visible = distinctions.slice(0, Math.floor((faceWidth + 1) / 4));
  const anchor = painter.p(
    building.x + building.w / 2,
    building.y + building.h,
    building.height / 2,
  );

  visible.forEach((distinction, index) => {
    const { pixels, color } = BADGES[distinction];
    const offset = (index - (visible.length - 1) / 2) * 4 * u;
    const x = Math.round(anchor.x + offset) - u;
    const y = Math.round(anchor.y + offset / 2) - 2 * u;
    for (const [dy, row] of pixels.entries()) {
      for (const [dx, pixel] of [...row].entries()) {
        if (pixel === "#")
          painter.buffer.rect(
            x + (dx + 1) * u,
            y + (dy + 1) * u,
            u,
            u,
            "#253447",
          );
      }
    }
    for (const [dy, row] of pixels.entries()) {
      for (const [dx, pixel] of [...row].entries()) {
        if (pixel === "#")
          painter.buffer.rect(x + dx * u, y + dy * u, u, u, color);
      }
    }
  });
}
