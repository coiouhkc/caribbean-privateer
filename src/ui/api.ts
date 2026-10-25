import type { Vec2 } from '../core/math';
import type { Side } from '../game/combat';
import type { TradeResult } from '../world/economy';
import type { Cargo, GoodId } from '../world/goods';
import type { World } from '../world/worldgen';

export interface HudState {
  gold: number;
  cargoUsed: number;
  capacity: number;
  hp: number;
  maxHp: number;
  /** 0 = just fired, 1 = loaded. */
  reload: Record<Side, number>;
  goal: number;
}

export interface MinimapState {
  player: { pos: Vec2; heading: number };
  pirates: Vec2[];
  treasures: Vec2[];
  destination: Vec2 | null;
}

/** What the DOM user interface may ask of the game. Implemented by the game scene. */
export interface GameApi {
  readonly world: World;
  hudState(): HudState;
  minimapState(): MinimapState;
  playerCargo(): Readonly<Cargo>;
  sailTo(target: Vec2): void;
  enterPort(portId: number): void;
  leavePort(): void;
  buy(portId: number, good: GoodId, quantity: number): TradeResult;
  sell(portId: number, good: GoodId, quantity: number): TradeResult;
  /** Gold needed to fully repair the ship; 0 when it is undamaged. */
  repairCost(): number;
  repair(): boolean;
  setPaused(reason: string, paused: boolean): void;
}
