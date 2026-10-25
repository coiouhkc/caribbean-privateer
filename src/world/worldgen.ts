import {
  ISLAND_COUNT,
  NAV_CELL,
  NAV_MARGIN,
  PORT_COUNT,
  PORT_SAFE_RADIUS,
  WORLD_SIZE,
} from '../config';
import { add, dist, distToPolygonEdge, distToSegment, fromAngle, pointInPolygon, TAU, type Vec2 } from '../core/math';
import { createRng, randRange, type Rng, shuffle } from '../core/rng';
import type { MessageKey } from '../i18n';
import { createMarket, type Market, type PortSize } from './economy';
import { GOODS, type GoodId } from './goods';
import { NavGrid } from './navgrid';

export interface Island {
  id: number;
  center: Vec2;
  radius: number;
  /** Coast line, star-shaped around `center`. */
  poly: Vec2[];
  palms: Vec2[];
  portId: number | null;
}

export interface Port {
  id: number;
  nameKey: MessageKey;
  size: PortSize;
  islandId: number;
  /** Point in the water where ships dock. */
  dock: Vec2;
  /** Point on the coast where the pier starts. */
  shore: Vec2;
  town: Vec2;
  houses: Vec2[];
  produces: GoodId[];
  demands: GoodId[];
  market: Market;
}

export interface World {
  seed: number;
  size: number;
  islands: Island[];
  ports: Port[];
  nav: NavGrid;
  startPortId: number;
}

export const PORT_NAME_KEYS: MessageKey[] = [
  'portName.sunnyBay',
  'portName.turtleCove',
  'portName.coconutHarbor',
  'portName.parrotPoint',
  'portName.pearlTown',
  'portName.dolphinPort',
  'portName.mangoIsland',
  'portName.seashellBeach',
  'portName.starfishVillage',
  'portName.goldenSands',
  'portName.lagoonCity',
  'portName.pelicanRock',
];

/** Port sizes in order of island size (largest island first). */
const PORT_SIZES: PortSize[] = ['large', 'large', 'medium', 'medium', 'small', 'small'];
const HOUSE_COUNT: Record<PortSize, number> = { small: 3, medium: 5, large: 8 };
/** Islands may bulge up to this factor beyond their nominal radius. */
const MAX_BULGE = 1.35;

export function generateWorld(seed: number): World {
  for (let attempt = 0; attempt < 50; attempt++) {
    const world = tryGenerate((seed + attempt * 7919) >>> 0);
    if (world) return world;
  }
  throw new Error(`World generation failed for seed ${seed}`);
}

export function isLand(world: World, p: Vec2): boolean {
  return world.islands.some(
    (island) => dist(island.center, p) < island.radius * MAX_BULGE && pointInPolygon(p, island.poly),
  );
}

export function inSafeZone(world: World, p: Vec2, extra = 0): boolean {
  return world.ports.some((port) => dist(port.dock, p) < PORT_SAFE_RADIUS + extra);
}

function islandPolygon(rng: Rng, center: Vec2, radius: number): Vec2[] {
  const k = 28;
  const p1 = rng() * TAU;
  const p2 = rng() * TAU;
  const p3 = rng() * TAU;
  const poly: Vec2[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    const f = 1 + 0.16 * Math.sin(2 * a + p1) + 0.1 * Math.sin(3 * a + p2) + 0.06 * Math.sin(5 * a + p3);
    poly.push(add(center, fromAngle(a, radius * f)));
  }
  return poly;
}

function nearIsland(island: Island, p: Vec2, margin: number): boolean {
  if (dist(island.center, p) > island.radius * MAX_BULGE + margin) return false;
  return pointInPolygon(p, island.poly) || distToPolygonEdge(p, island.poly) < margin;
}

function tryGenerate(seed: number): World | null {
  const rng = createRng(seed);
  const islands: Island[] = [];
  for (let tries = 0; islands.length < ISLAND_COUNT && tries < 4000; tries++) {
    const radius = randRange(rng, 130, 300);
    const extent = radius * MAX_BULGE;
    const margin = extent + 160;
    const center = { x: randRange(rng, margin, WORLD_SIZE - margin), y: randRange(rng, margin, WORLD_SIZE - margin) };
    if (islands.some((o) => dist(o.center, center) < o.radius * MAX_BULGE + extent + 240)) continue;
    islands.push({ id: islands.length, center, radius, poly: islandPolygon(rng, center, radius), palms: [], portId: null });
  }
  if (islands.length < PORT_COUNT) return null;

  const nav = new NavGrid(WORLD_SIZE, NAV_CELL, (p) => islands.some((island) => nearIsland(island, p, NAV_MARGIN)));

  const portIslands = [...islands].sort((a, b) => b.radius - a.radius).slice(0, PORT_COUNT);
  const goodsOrder = shuffle(rng, GOODS);
  const names = shuffle(rng, PORT_NAME_KEYS);
  const slots = shuffle(rng, portIslands.map((_, i) => i));
  const ports: Port[] = [];

  for (const [k, island] of portIslands.entries()) {
    const size = PORT_SIZES[k];
    const placement = placeDock(rng, island, nav);
    if (!placement) return null;
    const { shore, dock } = placement;
    const town = add(island.center, { x: shore.x - island.center.x, y: shore.y - island.center.y }, 0.5);

    // Goods are assigned round-robin so that every good is produced somewhere and wanted somewhere else.
    const slot = slots[k];
    const goodAt = (offset: number) => goodsOrder[(slot + offset) % goodsOrder.length];
    const produces = size === 'small' ? [goodAt(0)] : [goodAt(0), goodAt(1)];
    const demands = size === 'small' ? [goodAt(3)] : size === 'medium' ? [goodAt(3), goodAt(4)] : [goodAt(3), goodAt(4), goodAt(5)];

    const port: Port = {
      id: ports.length,
      nameKey: names[k],
      size,
      islandId: island.id,
      dock,
      shore,
      town,
      houses: placeHouses(rng, island, town, HOUSE_COUNT[size]),
      produces,
      demands,
      market: createMarket(size, produces, demands),
    };
    island.portId = port.id;
    ports.push(port);
  }

  for (const island of islands) {
    const port = island.portId === null ? null : ports[island.portId];
    island.palms = placePalms(rng, island, port);
  }

  // Every port must be reachable by sea from every other port.
  for (const port of ports.slice(1)) {
    if (!nav.findPath(ports[0].dock, port.dock)) return null;
  }

  const startPort = ports.find((p) => p.size === 'small') ?? ports[0];
  return { seed, size: WORLD_SIZE, islands, ports, nav, startPortId: startPort.id };
}

function placeDock(rng: Rng, island: Island, nav: NavGrid): { shore: Vec2; dock: Vec2 } | null {
  const mapCenter = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
  const toCenter = Math.atan2(mapCenter.y - island.center.y, mapCenter.x - island.center.x);
  // Prefer coast that faces the middle of the map: it is easier to reach.
  const candidates = island.poly
    .map((shore) => {
      const facing = Math.cos(Math.atan2(shore.y - island.center.y, shore.x - island.center.x) - toCenter);
      return { shore, score: facing + rng() * 0.8 };
    })
    .sort((a, b) => b.score - a.score);

  for (const { shore } of candidates) {
    const dir = Math.atan2(shore.y - island.center.y, shore.x - island.center.x);
    for (const extra of [60, 90, 120, 150]) {
      const dock = add(shore, fromAngle(dir, extra));
      if (nav.isFree(dock) && nav.isFree(add(dock, fromAngle(dir, 40)))) return { shore, dock };
    }
  }
  return null;
}

function randomPointOnIsland(rng: Rng, island: Island): Vec2 {
  return add(island.center, fromAngle(rng() * TAU, Math.sqrt(rng()) * island.radius * 0.9));
}

function placeHouses(rng: Rng, island: Island, town: Vec2, count: number): Vec2[] {
  const houses: Vec2[] = [];
  for (let tries = 0; houses.length < count && tries < 400; tries++) {
    const spread = 25 + houses.length * 9;
    const p = add(town, fromAngle(rng() * TAU, randRange(rng, 0, spread)));
    if (!pointInPolygon(p, island.poly) || distToPolygonEdge(p, island.poly) < 30) continue;
    if (houses.some((h) => dist(h, p) < 30)) continue;
    houses.push(p);
  }
  return houses;
}

function placePalms(rng: Rng, island: Island, port: Port | null): Vec2[] {
  const palms: Vec2[] = [];
  const count = Math.round(island.radius / 22);
  for (let tries = 0; palms.length < count && tries < 400; tries++) {
    const p = randomPointOnIsland(rng, island);
    if (!pointInPolygon(p, island.poly) || distToPolygonEdge(p, island.poly) < 16) continue;
    if (palms.some((o) => dist(o, p) < 32)) continue;
    if (port && (port.houses.some((h) => dist(h, p) < 36) || distToSegment(p, port.town, port.shore) < 30)) continue;
    palms.push(p);
  }
  return palms;
}
