import type { Vec2 } from './math';

/**
 * Classic 2:1 isometric projection. World coordinates are a flat top-down plane
 * (x, y) plus an optional height z; screen coordinates are what Phaser renders.
 */
export function toScreen(x: number, y: number, z = 0): Vec2 {
  return { x: x - y, y: (x + y) / 2 - z };
}

/** Inverse of {@link toScreen} for points on the water plane (z = 0). */
export function toWorld(sx: number, sy: number): Vec2 {
  return { x: sy + sx / 2, y: sy - sx / 2 };
}
