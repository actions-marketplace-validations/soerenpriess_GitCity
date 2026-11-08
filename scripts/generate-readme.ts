import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import lively from "../assets/examples/lively.json" with { type: "json" };
import { languageStyle } from "../src/analysis/languagePalette.js";
import { generateCity } from "../src/city/cityGenerator.js";
import { createLayout } from "../src/city/grid.js";
import { drawBuilding } from "../src/render/architecture/index.js";
import { renderPixels } from "../src/render/canvasRenderer.js";
import { PixelBuffer } from "../src/render/pixelArt.js";
import { facesFor, IsoPainter } from "../src/render/sprites.js";
import type { CityBuilding, Season } from "../src/types.js";

const directory = fileURLToPath(new URL("../assets/wiki/", import.meta.url));
await mkdir(directory, { recursive: true });

async function save(name: string, pixels: PixelBuffer): Promise<void> {
  const canvas = createCanvas(pixels.width, pixels.height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(pixels.width, pixels.height);
  image.data.set(pixels.data);
  context.putImageData(image, 0, 0);
  await writeFile(`${directory}${name}.png`, canvas.toBuffer("image/png"));
  console.log(`Generated ${name}.png`);
}

const city = generateCity(lively);
const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
// Override only the visual season to compare the same city in all four palettes.
for (const season of seasons) {
  await save(`season-${season}`, renderPixels({ ...city, season }, 0));
}

const languages = [
  "TypeScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C",
  "Vue",
  "GLSL",
  "Markdown",
  "Shell",
  "SQL",
  "Unknown",
];
for (const language of languages) {
  const style = languageStyle(language);
  const pixels = new PixelBuffer(180, 180);
  const painter = new IsoPainter(pixels, {
    ...createLayout(480, 270),
    tile: 28,
    originX: 90,
    originY: 120,
    unit: 2,
  });
  const building: CityBuilding = {
    id: style.architecture,
    x: 0,
    y: 0,
    w: 2.4,
    h: 2.4,
    height: 64,
    zone: "residential",
    language,
    secondaryLanguages: [],
    repositoryIds: [],
    repository: null,
    architecture: style.architecture,
    form: style.architecture === "industrial" ? "workshop" : "midrise",
    color: style.facade,
    roofColor: style.architecture === "eco" ? "#5aa84a" : style.accent,
    accent: style.accent,
    construction: false,
    landmark: false,
    abandoned: false,
    variant: 42,
  };
  painter.box({ x: -0.2, y: -0.2, w: 2.8, h: 2.8 }, -4, 4, facesFor("#b5c69b"));
  drawBuilding(painter, building, 0, 24);
  await save(`architecture-${style.architecture}`, pixels);
}
