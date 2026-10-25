import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { NavGrid } from '../src/world/navgrid';

// A 1000x1000 sea with a wall from y=0 to y=800 at x=480..520.
const grid = new NavGrid(1000, 20, (p) => p.x > 480 && p.x < 520 && p.y < 800);

describe('nav grid', () => {
  it('finds a path around obstacles', () => {
    const from = { x: 200, y: 200 };
    const to = { x: 800, y: 200 };
    const path = grid.findPath(from, to)!;
    expect(path).not.toBeNull();
    expect(dist(path[path.length - 1], to)).toBeLessThan(1);
    let prev = from;
    for (const p of path) {
      expect(grid.lineOfSight(prev, p)).toBe(true);
      prev = p;
    }
    expect(path.some((p) => p.y > 800)).toBe(true);
  });

  it('returns a direct path when there is open water', () => {
    expect(grid.findPath({ x: 100, y: 100 }, { x: 300, y: 400 })).toEqual([{ x: 300, y: 400 }]);
  });

  it('redirects targets on land to the nearest water', () => {
    const path = grid.findPath({ x: 100, y: 100 }, { x: 500, y: 300 })!;
    expect(grid.isFree(path[path.length - 1])).toBe(true);
  });
});
