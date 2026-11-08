declare module "gifenc" {
  export type Palette = number[][];

  export interface GifEncoder {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette;
        delay?: number;
        repeat?: number;
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): GifEncoder;
  export function quantize(rgba: Uint8Array, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8Array, palette: Palette): Uint8Array;
  const gifenc: {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  };
  export default gifenc;
}
