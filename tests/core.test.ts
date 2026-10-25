import { describe, expect, it } from 'vitest';
import { toScreen, toWorld } from '../src/core/iso';
import { pointInPolygon, wrapAngle } from '../src/core/math';
import { createRng, shuffle } from '../src/core/rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(createRng(43)()).not.toEqual(createRng(42)());
  });

  it('shuffles without losing items', () => {
    expect(shuffle(createRng(1), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('iso projection', () => {
  it('round-trips world points', () => {
    for (const [x, y] of [[0, 0], [100, 250], [3999, 12]]) {
      const s = toScreen(x, y);
      const w = toWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(x);
      expect(w.y).toBeCloseTo(y);
    }
  });
});

describe('math', () => {
  it('wraps angles into [-PI, PI)', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2);
  });

  it('detects points inside polygons', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
