import Phaser from 'phaser';
import type { Ship } from '../game/ship';

export interface ShipPalette {
  hull: number;
  hullDark: number;
  deck: number;
  stripe: number;
  sail: number;
  sailEdge: number;
  flag: number;
  skull: boolean;
}

export const PLAYER_PALETTE: ShipPalette = {
  hull: 0xb06a32,
  hullDark: 0x7a4520,
  deck: 0xe8bb7a,
  stripe: 0x2d7dd2,
  sail: 0xfffaf0,
  sailEdge: 0xd6c8a8,
  flag: 0x2d7dd2,
  skull: false,
};

export const PIRATE_PALETTE: ShipPalette = {
  hull: 0x5a463c,
  hullDark: 0x33271f,
  deck: 0x8a6a4a,
  stripe: 0xd63c2f,
  sail: 0x3a3a3a,
  sailEdge: 0x1a1a1a,
  flag: 0x111111,
  skull: true,
};

/** Deck outline in model space: x points to the bow, y to starboard. Convex, counter-clockwise. */
const HULL: ReadonlyArray<readonly [number, number]> = [
  [32, 0], [18, 11], [-22, 11], [-30, 8], [-30, -8], [-22, -11], [18, -11],
];
const DECK_Z = 12;
const MASTS = [
  { x: -4, height: 56, bottomWidth: 18, topWidth: 13 },
  { x: 16, height: 44, bottomWidth: 14, topWidth: 10 },
];

type Point = { x: number; y: number };

/**
 * Draws a ship as a small extruded 3D model projected isometrically, so it looks right
 * at any heading. Coordinates are relative to the Graphics object's position.
 */
export function drawShip(g: Phaser.GameObjects.Graphics, ship: Ship, pal: ShipPalette, time: number): void {
  g.clear();
  // Ships are drawn a bit larger than their hit box so they read well on small screens.
  const scale = (ship.stats.length / 64) * 1.2;
  const cos = Math.cos(ship.heading);
  const sin = Math.sin(ship.heading);
  const bob = Math.sin(time * 2.2 + ship.id) * 1.2;
  const sink = ship.sinkProgress * 30;

  const rotate = (x: number, y: number) => ({ x: (x * cos - y * sin) * scale, y: (x * sin + y * cos) * scale });
  const project = (x: number, y: number, z: number, lift = bob - sink): Point => {
    const r = rotate(x, y);
    return { x: r.x - r.y, y: (r.x + r.y) / 2 - (z * scale + lift) };
  };

  g.setAlpha(1 - ship.sinkProgress * ship.sinkProgress);

  // Darker water under the hull.
  g.fillStyle(0x0b3d66, 0.22 * (1 - ship.sinkProgress));
  g.fillPoints(HULL.map(([x, y]) => project(x * 1.15, y * 1.4, 0, 0)), true);

  const bottom = HULL.map(([x, y]) => [x * 0.85, y * 0.72] as const);
  for (let i = 0; i < HULL.length; i++) {
    const j = (i + 1) % HULL.length;
    const edge = rotate(HULL[j][0] - HULL[i][0], HULL[j][1] - HULL[i][1]);
    // Outward normal of a CCW polygon is (ey, -ex); the camera looks from +x +y.
    const nx = edge.y;
    const ny = -edge.x;
    if (nx + ny <= 0) continue;
    const light = 0.55 + 0.45 * Math.max(0, (nx - ny * 0.3) / Math.hypot(nx, ny));
    g.fillStyle(lerpColor(pal.hullDark, pal.hull, light));
    const at = (k: number, z: number) => {
      const t = z / DECK_Z;
      return project(bottom[k][0] + (HULL[k][0] - bottom[k][0]) * t, bottom[k][1] + (HULL[k][1] - bottom[k][1]) * t, z);
    };
    g.fillPoints([at(i, 0), at(j, 0), at(j, DECK_Z), at(i, DECK_Z)], true);
    g.fillStyle(pal.stripe);
    g.fillPoints([at(i, 7), at(j, 7), at(j, 9.5), at(i, 9.5)], true);
  }

  g.fillStyle(pal.deck);
  g.fillPoints(HULL.map(([x, y]) => project(x, y, DECK_Z)), true);
  g.lineStyle(1.5, pal.hullDark, 1);
  g.strokePoints(HULL.map(([x, y]) => project(x, y, DECK_Z)), true);

  // Draw the mast that is further away from the camera first.
  const masts = [...MASTS].sort((a, b) => {
    const ra = rotate(a.x, 0);
    const rb = rotate(b.x, 0);
    return ra.x + ra.y - (rb.x + rb.y);
  });
  for (const mast of masts) drawMast(g, mast, pal, project, time + ship.id);

  if (!ship.dead && ship.hp < ship.stats.maxHp) drawHealthBar(g, ship, project(0, 0, 80));
}

function drawMast(
  g: Phaser.GameObjects.Graphics,
  mast: (typeof MASTS)[number],
  pal: ShipPalette,
  project: (x: number, y: number, z: number) => Point,
  time: number,
): void {
  const { x, height, bottomWidth: wb, topWidth: wt } = mast;
  const top = DECK_Z + height;
  const zb = DECK_Z + 10;
  const zt = top - 8;

  g.lineStyle(3, 0x5a3a1e, 1);
  g.lineBetween(project(x, 0, DECK_Z).x, project(x, 0, DECK_Z).y, project(x, 0, zt).x, project(x, 0, zt).y);

  const sail = [
    project(x, -wb, zb), project(x + 6, 0, zb - 2), project(x, wb, zb),
    project(x, wt, zt), project(x + 4, 0, zt + 1), project(x, -wt, zt),
  ];
  g.fillStyle(pal.sail);
  g.fillPoints(sail, true);
  g.lineStyle(1.5, pal.sailEdge, 1);
  g.strokePoints(sail, true);

  const yardA = project(x, -wt - 3, zt);
  const yardB = project(x, wt + 3, zt);
  g.lineStyle(2, 0x5a3a1e, 1);
  g.lineBetween(yardA.x, yardA.y, yardB.x, yardB.y);
  const mastTop = project(x, 0, top);
  g.lineStyle(3, 0x5a3a1e, 1);
  g.lineBetween(yardA.x / 2 + yardB.x / 2, yardA.y / 2 + yardB.y / 2, mastTop.x, mastTop.y);

  if (pal.skull && mast === MASTS[0]) {
    const c = project(x + 4, 0, (zb + zt) / 2);
    g.fillStyle(0xffffff);
    g.fillCircle(c.x, c.y - 1, 4.5);
    g.fillRect(c.x - 2.5, c.y + 2, 5, 3);
    g.fillStyle(0x222222);
    g.fillCircle(c.x - 1.8, c.y - 1.5, 1.3);
    g.fillCircle(c.x + 1.8, c.y - 1.5, 1.3);
  }

  const wave = Math.sin(time * 6) * 2;
  g.fillStyle(pal.flag);
  g.fillPoints([mastTop, project(x - 12, wave, top - 3), project(x, 0, top - 7)], true);
}

function drawHealthBar(g: Phaser.GameObjects.Graphics, ship: Ship, at: Point): void {
  const w = 36;
  const ratio = Math.max(0, ship.hp / ship.stats.maxHp);
  g.fillStyle(0x000000, 0.5);
  g.fillRoundedRect(at.x - w / 2 - 1, at.y - 1, w + 2, 7, 3);
  g.fillStyle(ratio > 0.5 ? 0x4cd964 : ratio > 0.25 ? 0xffcc00 : 0xff5a4f);
  g.fillRoundedRect(at.x - w / 2, at.y, w * ratio, 5, 2);
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gr = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gr << 8) | bl;
}
