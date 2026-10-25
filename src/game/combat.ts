import { FIRING_ARC } from '../config';
import { add, angleTo, clamp, dist, distToSegment, fromAngle, type Vec2, wrapAngle } from '../core/math';
import type { Rng } from '../core/rng';
import type { Faction, Ship } from './ship';

export type Side = 'left' | 'right';
export const SIDES: readonly Side[] = ['left', 'right'];

export interface Cannonball {
  pos: Vec2;
  vel: Vec2;
  traveled: number;
  /** Planned flight distance; the ball splashes into the water after it. */
  flight: number;
  owner: Faction;
  damage: number;
}

/** Direction the cannons of one board point to. */
export function broadsideAngle(heading: number, side: Side): number {
  return heading + (side === 'right' ? Math.PI / 2 : -Math.PI / 2);
}

export function inFiringArc(
  from: Vec2,
  heading: number,
  side: Side,
  target: Vec2,
  range: number,
  arc = FIRING_ARC,
): boolean {
  if (dist(from, target) > range) return false;
  return Math.abs(wrapAngle(angleTo(from, target) - broadsideAngle(heading, side))) <= arc / 2;
}

/** The nearest living enemy inside the board's firing arc. */
export function chooseTarget(ship: Ship, side: Side, enemies: readonly Ship[]): Ship | null {
  let best: Ship | null = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const d = dist(ship.pos, enemy.pos);
    if (d < bestDist && inFiringArc(ship.pos, ship.heading, side, enemy.pos, ship.stats.range)) {
      best = enemy;
      bestDist = d;
    }
  }
  return best;
}

/** Positions of the cannons of one board in world coordinates. */
export function cannonPositions(ship: Ship, side: Side): Vec2[] {
  const { cannonsPerSide: n, length, beam } = ship.stats;
  const forward = fromAngle(ship.heading);
  const out = fromAngle(broadsideAngle(ship.heading, side), beam / 2);
  return Array.from({ length: n }, (_, i) => {
    const offset = n === 1 ? 0 : -length * 0.3 + (length * 0.6 * i) / (n - 1);
    return add(add(ship.pos, forward, offset), out);
  });
}

/** Fires every cannon of one board at the target, leading moving targets. */
export function fireVolley(ship: Ship, side: Side, target: Ship, rng: Rng): Cannonball[] {
  const { ballSpeed, spread, range, damage } = ship.stats;
  const broadside = broadsideAngle(ship.heading, side);
  return cannonPositions(ship, side).map((origin) => {
    const time = dist(origin, target.pos) / ballSpeed;
    const lead = add(target.pos, target.velocity, time);
    const aim = angleTo(origin, lead) + (rng() * 2 - 1) * spread;
    const angle = broadside + clamp(wrapAngle(aim - broadside), -FIRING_ARC / 2, FIRING_ARC / 2);
    return {
      pos: origin,
      vel: fromAngle(angle, ballSpeed),
      traveled: 0,
      flight: Math.min(range * 1.15, dist(origin, lead) + 40),
      owner: ship.faction,
      damage,
    };
  });
}

/** Ships are approximated as a capsule along their heading. */
export function hitsShip(p: Vec2, ship: Ship): boolean {
  const half = fromAngle(ship.heading, ship.stats.length * 0.42);
  return distToSegment(p, add(ship.pos, half), add(ship.pos, half, -1)) < ship.stats.beam * 0.6 + 4;
}

/** Height of a ball above the water for rendering: a simple parabola. */
export function ballHeight(ball: Cannonball): number {
  const f = clamp(ball.traveled / ball.flight, 0, 1);
  return 6 + 4 * 26 * f * (1 - f);
}
