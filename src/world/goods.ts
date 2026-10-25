import type { MessageKey } from '../i18n';

export const GOODS = ['bananas', 'fish', 'cloth', 'cocoa', 'spices', 'tools'] as const;
export type GoodId = (typeof GOODS)[number];

export interface GoodInfo {
  basePrice: number;
  icon: string;
  nameKey: MessageKey;
}

export const GOOD_INFO: Record<GoodId, GoodInfo> = {
  bananas: { basePrice: 10, icon: '🍌', nameKey: 'good.bananas' },
  fish: { basePrice: 16, icon: '🐟', nameKey: 'good.fish' },
  cloth: { basePrice: 30, icon: '🧵', nameKey: 'good.cloth' },
  cocoa: { basePrice: 42, icon: '🍫', nameKey: 'good.cocoa' },
  spices: { basePrice: 60, icon: '🌶️', nameKey: 'good.spices' },
  tools: { basePrice: 80, icon: '🔨', nameKey: 'good.tools' },
};

export type Cargo = Record<GoodId, number>;

export function emptyCargo(): Cargo {
  return Object.fromEntries(GOODS.map((good) => [good, 0])) as Cargo;
}

export function cargoUsed(cargo: Cargo): number {
  return GOODS.reduce((sum, good) => sum + cargo[good], 0);
}
