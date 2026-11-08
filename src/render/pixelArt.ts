export interface Point {
  x: number;
  y: number;
}

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Lighten (amount > 0) or darken (amount < 0) a hex color. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number): number =>
    Math.round(
      amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount),
    );
  return rgbToHex([mix(r), mix(g), mix(b)]);
}

/**
 * A tiny RGBA frame buffer with crisp (non anti-aliased) drawing primitives.
 * Every pixel is either fully opaque or fully transparent, which keeps the
 * GIF palette small and allows a clean one-bit transparent background.
 */
export class PixelBuffer {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  private color = new Uint8ClampedArray(3);

  setColor(hex: string): void {
    const [r, g, b] = hexToRgb(hex);
    this.color[0] = r;
    this.color[1] = g;
    this.color[2] = b;
  }

  plot(x: number, y: number, hex?: string): void {
    if (hex) this.setColor(hex);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const offset = (py * this.width + px) * 4;
    this.data[offset] = this.color[0]!;
    this.data[offset + 1] = this.color[1]!;
    this.data[offset + 2] = this.color[2]!;
    this.data[offset + 3] = 255;
  }

  private span(y: number, x0: number, x1: number): void {
    if (y < 0 || y >= this.height) return;
    const start = Math.max(0, x0);
    const end = Math.min(this.width - 1, x1);
    let offset = (y * this.width + start) * 4;
    for (let x = start; x <= end; x += 1) {
      this.data[offset] = this.color[0]!;
      this.data[offset + 1] = this.color[1]!;
      this.data[offset + 2] = this.color[2]!;
      this.data[offset + 3] = 255;
      offset += 4;
    }
  }

  rect(x: number, y: number, width: number, height: number, hex: string): void {
    this.setColor(hex);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = x0 + Math.round(width) - 1;
    for (let row = y0; row < y0 + Math.round(height); row += 1) {
      this.span(row, x0, x1);
    }
  }

  // Scanline polygon fill sampling pixel centers (no anti-aliasing). */
  polygon(points: readonly Point[], hex: string): void {
    if (points.length < 3) return;
    this.setColor(hex);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const top = Math.max(0, Math.ceil(minY - 0.5));
    const bottom = Math.min(this.height - 1, Math.floor(maxY - 0.5));
    const crossings: number[] = [];
    for (let row = top; row <= bottom; row += 1) {
      const sampleY = row + 0.5;
      crossings.length = 0;
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index]!;
        const b = points[(index + 1) % points.length]!;
        if (a.y <= sampleY === b.y <= sampleY) continue;
        crossings.push(a.x + ((sampleY - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      crossings.sort((left, right) => left - right);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const x0 = Math.ceil(crossings[index]! - 0.5);
        const x1 = Math.floor(crossings[index + 1]! - 0.5);
        if (x1 >= x0) this.span(row, x0, x1);
      }
    }
  }

  // One pixel wide Bresenham line. */
  line(ax: number, ay: number, bx: number, by: number, hex: string): void {
    this.setColor(hex);
    let x0 = Math.round(ax);
    let y0 = Math.round(ay);
    const x1 = Math.round(bx);
    const y1 = Math.round(by);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x0 += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  }
}
