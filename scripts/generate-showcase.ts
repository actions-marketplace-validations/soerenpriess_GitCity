import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCity } from "../src/city/cityGenerator.js";
import { DEFAULT_OPTIONS } from "../src/config.js";
import { renderPixels } from "../src/render/canvasRenderer.js";
import { encodeGif, type FrameSource } from "../src/render/gifExporter.js";
import {
  LIFECYCLE_SEED,
  LIFECYCLE_STAGES,
  SHOWCASE_EXAMPLES,
  SHOWCASE_SNAPSHOTS,
} from "./showcase-config.js";

const examples = [
  ...SHOWCASE_EXAMPLES.map((name) => ({ name, lifecycle: false })),
  ...LIFECYCLE_STAGES.map((name) => ({ name, lifecycle: true })),
];

const directory = fileURLToPath(
  new URL("../assets/examples/", import.meta.url),
);
const lifecycleFrames: FrameSource[] = [];
for (const { name, lifecycle } of examples) {
  const city = generateCity(
    SHOWCASE_SNAPSHOTS[name],
    lifecycle ? { seed: LIFECYCLE_SEED } : {},
  );
  const frames = Array.from({ length: city.frameCount }, (_, frame) =>
    renderPixels(city, frame),
  );
  const canvas = createCanvas(city.width, city.height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(city.width, city.height);
  image.data.set(frames[0]!.data);
  context.putImageData(image, 0, 0);

  await writeFile(join(directory, `${name}.png`), canvas.toBuffer("image/png"));
  await writeFile(
    join(directory, `${name}.gif`),
    encodeGif(frames, city.width, city.height, city.fps),
  );
  if (lifecycle) lifecycleFrames.push(...frames);
  console.log(`Generated ${name}.gif and ${name}.png`);
}

await writeFile(
  join(directory, "growth-lifecycle.gif"),
  encodeGif(
    lifecycleFrames,
    DEFAULT_OPTIONS.width * DEFAULT_OPTIONS.scale,
    DEFAULT_OPTIONS.height * DEFAULT_OPTIONS.scale,
    DEFAULT_OPTIONS.fps,
  ),
);
console.log(
  `Generated growth-lifecycle.gif (${lifecycleFrames.length} frames)`,
);
