import type { ShipStats } from '../config';
import { angleTo, clamp, dist, type Vec2, wrapAngle } from '../core/math';
import type { NavGrid } from '../world/navgrid';
import type { Side } from './combat';

export type Faction = 'player' | 'pirate';

export interface PirateBrain {
  mode: 'patrol' | 'chase';
  /** Seconds until the next path update. */
  timer: number;
  /** +1 or -1: which way the pirate circles around its target. */
  orbit: number;
}

let nextShipId = 1;

/** Ship movement and health. Pure game logic, rendering lives in `render/shipArt.ts`. */
export class Ship {
  readonly id = nextShipId++;
  pos: Vec2;
  heading: number;
  speed = 0;
  hp: number;
  path: Vec2[] = [];
  reload: Record<Side, number> = { left: 0, right: 0 };
  dead = false;
  /** 0..1 while the ship sinks after being defeated. */
  sinkProgress = 0;
  brain: PirateBrain;

  constructor(
    readonly faction: Faction,
    readonly stats: ShipStats,
    pos: Vec2,
    heading = 0,
  ) {
    this.pos = { ...pos };
    this.heading = heading;
    this.hp = stats.maxHp;
    this.brain = { mode: 'patrol', timer: 0, orbit: this.id % 2 === 0 ? 1 : -1 };
  }

  get velocity(): Vec2 {
    return { x: Math.cos(this.heading) * this.speed, y: Math.sin(this.heading) * this.speed };
  }

  get destination(): Vec2 | null {
    return this.path.length > 0 ? this.path[this.path.length - 1] : null;
  }

  setPath(path: Vec2[]): void {
    this.path = path.map((p) => ({ ...p }));
  }

  stop(): void {
    this.path = [];
  }

  update(dt: number, nav: NavGrid): void {
    const { maxSpeed, accel, turnRate } = this.stats;
    let targetSpeed = 0;

    if (!this.dead && this.path.length > 0) {
      let target = this.path[0];
      let d = dist(this.pos, target);
      while (this.path.length > 1 && d < 60) {
        this.path.shift();
        target = this.path[0];
        d = dist(this.pos, target);
      }
      const last = this.path.length === 1;
      const diff = wrapAngle(angleTo(this.pos, target) - this.heading);
      // Arrived, or the target is so close behind us that circling around it would look silly.
      if (last && (d < 16 || (d < 40 && Math.abs(diff) > Math.PI / 2))) {
        this.path = [];
      } else {
        this.heading = wrapAngle(this.heading + clamp(diff, -turnRate * dt, turnRate * dt));
        const alignment = Math.cos(Math.min(Math.abs(diff), Math.PI / 2));
        targetSpeed = maxSpeed * Math.max(0.25, alignment);
        if (last) targetSpeed = Math.min(targetSpeed, Math.max(25, d * 1.2));
      }
    }

    this.speed = this.speed < targetSpeed
      ? Math.min(targetSpeed, this.speed + accel * dt)
      : Math.max(targetSpeed, this.speed - accel * 1.5 * dt);

    if (this.speed > 0.01) this.move(dt, nav);
  }

  private move(dt: number, nav: NavGrid): void {
    const step = this.speed * dt;
    const nx = this.pos.x + Math.cos(this.heading) * step;
    const ny = this.pos.y + Math.sin(this.heading) * step;
    // A ship that somehow ended up too close to land may always move, so it can sail free again.
    if (nav.isFree({ x: nx, y: ny }) || !nav.isFree(this.pos)) {
      this.pos = { x: nx, y: ny };
    } else if (nav.isFree({ x: nx, y: this.pos.y })) {
      // Slide along the coast instead of getting stuck.
      this.pos = { x: nx, y: this.pos.y };
      this.speed *= 0.9;
    } else if (nav.isFree({ x: this.pos.x, y: ny })) {
      this.pos = { x: this.pos.x, y: ny };
      this.speed *= 0.9;
    } else {
      this.speed = 0;
    }
  }
}
