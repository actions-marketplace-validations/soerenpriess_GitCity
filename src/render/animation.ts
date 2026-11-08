export function pulse(frame: number, frameCount: number, phase = 0): number {
  return (
    (Math.sin((frame / Math.max(1, frameCount)) * Math.PI * 2 + phase) + 1) / 2
  );
}
