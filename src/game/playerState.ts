import { CARGO_CAPACITY, START_GOLD } from '../config';
import { emptyCargo } from '../world/goods';
import type { Wallet } from '../world/economy';

export interface PlayerState extends Wallet {
  goalReached: boolean;
}

export function createPlayerState(): PlayerState {
  return { gold: START_GOLD, cargo: emptyCargo(), capacity: CARGO_CAPACITY, goalReached: false };
}
