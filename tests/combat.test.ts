import { describe, expect, it } from 'vitest';
import { PIRATE_STATS, PLAYER_STATS } from '../src/config';
import { createRng } from '../src/core/rng';
import { chooseTarget, fireVolley, hitsShip, inFiringArc } from '../src/game/combat';
import { Ship } from '../src/game/ship';
import { NavGrid } from '../src/world/navgrid';

describe('combat', () => {
  // Heading 0 points along +x; in screen space (y down) "right" is +y.
  const origin = { x: 0, y: 0 };

  it('only fires within the 120° arc of each board', () => {
    expect(inFiringArc(origin, 0, 'right', { x: 0, y: 100 }, 300)).toBe(true);
    expect(inFiringArc(origin, 0, 'left', { x: 0, y: -100 }, 300)).toBe(true);
    expect(inFiringArc(origin, 0, 'right', { x: 0, y: -100 }, 300)).toBe(false);
    // 59° off the beam is inside, 61° is outside.
    const at = (deg: number) => ({ x: Math.sin((deg * Math.PI) / 180) * 100, y: Math.cos((deg * Math.PI) / 180) * 100 });
    expect(inFiringArc(origin, 0, 'right', at(59), 300)).toBe(true);
    expect(inFiringArc(origin, 0, 'right', at(61), 300)).toBe(false);
    // Straight ahead and out of range are never valid.
    expect(inFiringArc(origin, 0, 'right', { x: 100, y: 0 }, 300)).toBe(false);
    expect(inFiringArc(origin, 0, 'right', { x: 0, y: 400 }, 300)).toBe(false);
  });

  it('picks the nearest enemy in the arc and hits a stationary target', () => {
    const player = new Ship('player', { ...PLAYER_STATS, spread: 0 }, { x: 500, y: 500 }, 0);
    const near = new Ship('pirate', PIRATE_STATS, { x: 500, y: 700 }, Math.PI / 2);
    const far = new Ship('pirate', PIRATE_STATS, { x: 500, y: 850 }, 0);
    expect(chooseTarget(player, 'right', [far, near])).toBe(near);
    expect(chooseTarget(player, 'left', [far, near])).toBeNull();

    const balls = fireVolley(player, 'right', near, createRng(1));
    expect(balls).toHaveLength(PLAYER_STATS.cannonsPerSide);
    let hits = 0;
    for (const ball of balls) {
      for (let i = 0; i < 200 && ball.traveled < ball.flight; i++) {
        ball.pos = { x: ball.pos.x + ball.vel.x / 60, y: ball.pos.y + ball.vel.y / 60 };
        ball.traveled += PLAYER_STATS.ballSpeed / 60;
        if (hitsShip(ball.pos, near)) {
          hits++;
          break;
        }
      }
    }
    expect(hits).toBe(balls.length);
  });
});

describe('ship movement', () => {
  it('sails to its destination and stops', () => {
    const nav = new NavGrid(2000, 40, () => false);
    const ship = new Ship('player', PLAYER_STATS, { x: 300, y: 300 }, Math.PI);
    ship.setPath([{ x: 1200, y: 900 }]);
    for (let i = 0; i < 60 * 30 && ship.path.length > 0; i++) ship.update(1 / 60, nav);
    expect(ship.path).toHaveLength(0);
    expect(Math.hypot(ship.pos.x - 1200, ship.pos.y - 900)).toBeLessThan(45);
  });

  it('never enters blocked cells', () => {
    const nav = new NavGrid(2000, 40, (p) => p.x > 900 && p.x < 1100);
    const ship = new Ship('player', PLAYER_STATS, { x: 500, y: 1000 }, 0);
    ship.setPath([{ x: 1500, y: 1000 }]);
    for (let i = 0; i < 600; i++) {
      ship.update(1 / 60, nav);
      expect(nav.isFree(ship.pos)).toBe(true);
    }
  });

  it('can sail free when it ended up too close to land', () => {
    const nav = new NavGrid(2000, 40, (p) => p.x < 600);
    const ship = new Ship('player', PLAYER_STATS, { x: 580, y: 1000 }, 0);
    ship.setPath([{ x: 1000, y: 1000 }]);
    for (let i = 0; i < 120; i++) ship.update(1 / 60, nav);
    expect(nav.isFree(ship.pos)).toBe(true);
  });
});
