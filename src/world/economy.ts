import { clamp } from '../core/math';
import { type Cargo, cargoUsed, GOOD_INFO, GOODS, type GoodId } from './goods';

export type PortSize = 'small' | 'medium' | 'large';
export type MarketRole = 'produce' | 'neutral' | 'demand';

export interface MarketEntry {
  role: MarketRole;
  /** Units the port can sell. Fractional while regenerating; shown rounded down. */
  stock: number;
  /** Stock level the port drifts back to over time. */
  targetStock: number;
  /** Grows when the player buys and shrinks when the player sells; moves the price. */
  pressure: number;
}

export type Market = Record<GoodId, MarketEntry>;

export interface Wallet {
  gold: number;
  cargo: Cargo;
  capacity: number;
}

export type TradeResult = 'ok' | 'noGold' | 'cargoFull' | 'soldOut' | 'nothingToSell';

const ROLE_FACTOR: Record<MarketRole, number> = { produce: 0.7, neutral: 1, demand: 1.5 };
const PRESSURE_PER_UNIT = 0.01;
const PRESSURE_DECAY_PER_SECOND = 0.1;
/** Ports buy goods for less than they sell them. */
const SELL_SPREAD = 0.85;
const STOCK_RECOVERY_SECONDS = 120;

const TARGET_STOCK: Record<PortSize, Record<MarketRole, number>> = {
  small: { produce: 25, neutral: 6, demand: 0 },
  medium: { produce: 40, neutral: 10, demand: 0 },
  large: { produce: 60, neutral: 15, demand: 0 },
};

export function createMarket(size: PortSize, produces: GoodId[], demands: GoodId[]): Market {
  return Object.fromEntries(
    GOODS.map((good) => {
      const role: MarketRole = produces.includes(good)
        ? 'produce'
        : demands.includes(good)
          ? 'demand'
          : 'neutral';
      const targetStock = TARGET_STOCK[size][role];
      return [good, { role, stock: targetStock, targetStock, pressure: 0 }];
    }),
  ) as Market;
}

function midPrice(good: GoodId, entry: MarketEntry): number {
  return (
    GOOD_INFO[good].basePrice *
    ROLE_FACTOR[entry.role] *
    clamp(1 + PRESSURE_PER_UNIT * entry.pressure, 0.6, 1.8)
  );
}

/** Price the player pays for one unit. */
export function buyPrice(market: Market, good: GoodId): number {
  return Math.max(1, Math.round(midPrice(good, market[good])));
}

/** Price the player receives for one unit. */
export function sellPrice(market: Market, good: GoodId): number {
  return Math.max(1, Math.round(midPrice(good, market[good]) * SELL_SPREAD));
}

export function availableStock(market: Market, good: GoodId): number {
  return Math.floor(market[good].stock);
}

/** Buys up to `quantity` units; stops at the first problem. Returns 'ok' if at least one unit was bought. */
export function buy(market: Market, wallet: Wallet, good: GoodId, quantity = 1): TradeResult {
  let bought = 0;
  for (let i = 0; i < quantity; i++) {
    const problem = buyProblem(market, wallet, good);
    if (problem) return bought > 0 ? 'ok' : problem;
    wallet.gold -= buyPrice(market, good);
    wallet.cargo[good] += 1;
    market[good].stock -= 1;
    market[good].pressure += 1;
    bought++;
  }
  return 'ok';
}

function buyProblem(market: Market, wallet: Wallet, good: GoodId): TradeResult | null {
  if (availableStock(market, good) < 1) return 'soldOut';
  if (cargoUsed(wallet.cargo) >= wallet.capacity) return 'cargoFull';
  if (wallet.gold < buyPrice(market, good)) return 'noGold';
  return null;
}

/** Sells up to `quantity` units (Infinity sells everything on board). */
export function sell(market: Market, wallet: Wallet, good: GoodId, quantity = 1): TradeResult {
  if (wallet.cargo[good] < 1) return 'nothingToSell';
  const count = Math.min(quantity, wallet.cargo[good]);
  for (let i = 0; i < count; i++) {
    wallet.gold += sellPrice(market, good);
    wallet.cargo[good] -= 1;
    market[good].stock += 1;
    market[good].pressure -= 1;
  }
  return 'ok';
}

/** Lets prices and stock drift back to normal while time passes. */
export function tickMarket(market: Market, dt: number): void {
  for (const good of GOODS) {
    const entry = market[good];
    const decay = PRESSURE_DECAY_PER_SECOND * dt;
    entry.pressure = entry.pressure > 0 ? Math.max(0, entry.pressure - decay) : Math.min(0, entry.pressure + decay);

    const step = (Math.max(entry.targetStock, 10) / STOCK_RECOVERY_SECONDS) * dt;
    entry.stock = entry.stock < entry.targetStock
      ? Math.min(entry.targetStock, entry.stock + step)
      : Math.max(entry.targetStock, entry.stock - step);
  }
}
