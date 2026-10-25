/** Central place for gameplay tuning values. World units are roughly "pixels" before projection. */

export const WORLD_SIZE = 4000;
export const NAV_CELL = 40;
/** Minimum distance between a ship's center and the coast line. */
export const NAV_MARGIN = 38;

export const ISLAND_COUNT = 9;
export const PORT_COUNT = 6;

export const START_GOLD = 500;
export const GOAL_GOLD = 5000;
export const CARGO_CAPACITY = 20;

/** Pirates never enter this radius around a port's dock, and never shoot at ships inside it. */
export const PORT_SAFE_RADIUS = 420;
/** The player can enter a port when the ship is this close to its dock. */
export const DOCK_RADIUS = 130;

export const PIRATE_DETECT_RADIUS = 560;
export const PIRATE_ORBIT_RADIUS = 180;
export const MAX_PIRATES = 3;
export const INITIAL_PIRATES = 2;
export const PIRATE_RESPAWN_SECONDS = 25;

export const TREASURE_MIN = 80;
export const TREASURE_MAX = 200;
export const TREASURE_LIFETIME = 90;
export const TREASURE_PICKUP_RADIUS = 55;

export const REPAIR_COST_PER_HP = 1;
/** Share of the gold the pirates take when they defeat the player. */
export const DEFEAT_GOLD_LOSS = 0.1;
/** A harbour master helps out players who are completely broke. */
export const STARTER_GIFT = 100;
export const STARTER_GIFT_THRESHOLD = 50;

export const FIRING_ARC = (120 * Math.PI) / 180;

export interface ShipStats {
  maxSpeed: number;
  accel: number;
  /** Radians per second. */
  turnRate: number;
  maxHp: number;
  cannonsPerSide: number;
  /** Cooldown of one board in seconds. */
  reload: number;
  range: number;
  ballSpeed: number;
  damage: number;
  /** Random aiming error in radians. */
  spread: number;
  length: number;
  beam: number;
}

export const PLAYER_STATS: ShipStats = {
  maxSpeed: 130,
  accel: 70,
  turnRate: 1.7,
  maxHp: 100,
  cannonsPerSide: 3,
  reload: 2.5,
  range: 380,
  ballSpeed: 430,
  damage: 8,
  spread: 0.05,
  length: 64,
  beam: 22,
};

export const PIRATE_STATS: ShipStats = {
  maxSpeed: 108,
  accel: 60,
  turnRate: 1.5,
  maxHp: 60,
  cannonsPerSide: 2,
  reload: 3.5,
  range: 340,
  ballSpeed: 400,
  damage: 5,
  spread: 0.12,
  length: 58,
  beam: 20,
};
