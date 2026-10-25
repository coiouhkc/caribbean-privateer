import { PIRATE_DETECT_RADIUS, PIRATE_ORBIT_RADIUS, WORLD_SIZE } from '../config';
import { add, dist, fromAngle, type Vec2 } from '../core/math';
import { randRange, type Rng } from '../core/rng';
import { inSafeZone, type World } from '../world/worldgen';
import type { Ship } from './ship';

export interface PirateContext {
  world: World;
  player: Ship;
  /** False while the player is in a port's safe zone, docked, or defeated. */
  playerTargetable: boolean;
  rng: Rng;
}

/** Updates a pirate's goal. Returns 'spotted' when it starts chasing the player. */
export function updatePirate(pirate: Ship, ctx: PirateContext, dt: number): 'spotted' | null {
  const brain = pirate.brain;
  const { world, player } = ctx;
  brain.timer -= dt;
  const d = dist(pirate.pos, player.pos);

  if (brain.mode === 'patrol') {
    if (ctx.playerTargetable && d < PIRATE_DETECT_RADIUS && !inSafeZone(world, pirate.pos)) {
      brain.mode = 'chase';
      brain.timer = 0;
      return 'spotted';
    }
    if (pirate.path.length === 0 || brain.timer <= 0) {
      const goal = randomPatrolPoint(world, pirate.pos, ctx.rng);
      const path = goal && world.nav.findPath(pirate.pos, goal);
      if (path) pirate.setPath(path);
      brain.timer = 15;
    }
    return null;
  }

  if (!ctx.playerTargetable || d > PIRATE_DETECT_RADIUS * 1.7 || inSafeZone(world, pirate.pos)) {
    brain.mode = 'patrol';
    brain.timer = 0;
    pirate.stop();
    return null;
  }
  if (brain.timer <= 0) {
    brain.timer = 0.6;
    const goal = orbitPoint(pirate, player, world);
    const path = world.nav.lineOfSight(pirate.pos, goal) ? [goal] : world.nav.findPath(pirate.pos, goal);
    if (path) pirate.setPath(path);
  }
  return null;
}

/**
 * Pirates circle around their target: sailing tangentially keeps one of their boards
 * pointed at it, which is exactly where their cannons can fire.
 */
export function orbitPoint(pirate: Ship, target: Ship, world: World): Vec2 {
  const away = Math.atan2(pirate.pos.y - target.pos.y, pirate.pos.x - target.pos.x);
  let goal = add(target.pos, fromAngle(away + pirate.brain.orbit * 0.55, PIRATE_ORBIT_RADIUS));
  if (inSafeZone(world, goal)) goal = add(target.pos, fromAngle(away, PIRATE_ORBIT_RADIUS * 0.6));
  return world.nav.nearestFree(goal) ?? target.pos;
}

export function randomPatrolPoint(world: World, from: Vec2, rng: Rng): Vec2 | null {
  for (let i = 0; i < 40; i++) {
    const p = { x: randRange(rng, 100, WORLD_SIZE - 100), y: randRange(rng, 100, WORLD_SIZE - 100) };
    if (dist(p, from) < 1400 && world.nav.isFree(p) && !inSafeZone(world, p, 150)) return p;
  }
  return null;
}

/** A spawn point far from the player and from every port. */
export function pirateSpawnPoint(world: World, player: Vec2, rng: Rng): Vec2 | null {
  for (let i = 0; i < 200; i++) {
    const p = { x: randRange(rng, 150, WORLD_SIZE - 150), y: randRange(rng, 150, WORLD_SIZE - 150) };
    if (dist(p, player) > 1000 && world.nav.isFree(p) && !inSafeZone(world, p, 200)) return p;
  }
  return null;
}
