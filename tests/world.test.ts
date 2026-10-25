import { describe, expect, it } from 'vitest';
import { PORT_COUNT, PORT_SAFE_RADIUS } from '../src/config';
import { dist } from '../src/core/math';
import { GOODS } from '../src/world/goods';
import { generateWorld, isLand } from '../src/world/worldgen';

const SEEDS = [1, 2, 3, 42, 1234, 99999, 2026];

describe('world generation', () => {
  it('is deterministic per seed', () => {
    const a = generateWorld(7);
    const b = generateWorld(7);
    expect(a.islands.map((i) => i.center)).toEqual(b.islands.map((i) => i.center));
    expect(a.ports.map((p) => p.nameKey)).toEqual(b.ports.map((p) => p.nameKey));
  });

  for (const seed of SEEDS) {
    it(`produces a playable map for seed ${seed}`, () => {
      const world = generateWorld(seed);
      expect(world.ports).toHaveLength(PORT_COUNT);
      expect(new Set(world.ports.map((p) => p.nameKey)).size).toBe(PORT_COUNT);

      // Every good can be bought somewhere and sold with profit somewhere else.
      for (const good of GOODS) {
        expect(world.ports.some((p) => p.produces.includes(good))).toBe(true);
        expect(world.ports.some((p) => p.demands.includes(good))).toBe(true);
      }
      for (const port of world.ports) {
        expect(port.produces.some((g) => port.demands.includes(g))).toBe(false);
        expect(world.nav.isFree(port.dock)).toBe(true);
        expect(isLand(world, port.dock)).toBe(false);
        expect(isLand(world, port.town)).toBe(true);
        for (const other of world.ports) {
          if (other !== port) expect(world.nav.findPath(port.dock, other.dock)).not.toBeNull();
        }
      }
    });
  }

  it('keeps the map small enough to cross within a minute', () => {
    const world = generateWorld(5);
    const longest = Math.max(
      ...world.ports.flatMap((a) => world.ports.map((b) => {
        const path = world.nav.findPath(a.dock, b.dock) ?? [];
        let length = 0;
        let prev = a.dock;
        for (const p of path) {
          length += dist(prev, p);
          prev = p;
        }
        return length;
      })),
    );
    expect(longest / 130).toBeLessThan(60);
    expect(PORT_SAFE_RADIUS).toBeGreaterThan(0);
  });
});
