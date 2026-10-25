import { describe, expect, it } from 'vitest';
import { buy, buyPrice, createMarket, sell, sellPrice, tickMarket, type Wallet } from '../src/world/economy';
import { emptyCargo } from '../src/world/goods';

const wallet = (gold: number, capacity = 20): Wallet => ({ gold, cargo: emptyCargo(), capacity });

describe('economy', () => {
  it('makes produced goods cheap and demanded goods expensive', () => {
    const producer = createMarket('medium', ['spices'], ['tools']);
    const consumer = createMarket('medium', ['tools'], ['spices']);
    expect(buyPrice(producer, 'spices')).toBeLessThan(sellPrice(consumer, 'spices'));
  });

  it('does not sell demanded goods', () => {
    const market = createMarket('small', ['fish'], ['cloth']);
    expect(buy(market, wallet(1000), 'cloth')).toBe('soldOut');
  });

  it('respects gold and cargo capacity', () => {
    const market = createMarket('large', ['bananas'], ['tools']);
    expect(buy(market, wallet(0), 'bananas')).toBe('noGold');
    const w = wallet(10_000, 3);
    expect(buy(market, w, 'bananas', 5)).toBe('ok');
    expect(w.cargo.bananas).toBe(3);
    expect(buy(market, w, 'bananas')).toBe('cargoFull');
  });

  it('moves prices with trading and recovers over time', () => {
    const market = createMarket('large', ['cocoa'], []);
    const before = buyPrice(market, 'cocoa');
    buy(market, wallet(10_000), 'cocoa', 20);
    expect(buyPrice(market, 'cocoa')).toBeGreaterThan(before);
    tickMarket(market, 600);
    expect(buyPrice(market, 'cocoa')).toBe(before);
  });

  it('a full trade run between producer and consumer is profitable', () => {
    const producer = createMarket('medium', ['tools'], []);
    const consumer = createMarket('medium', [], ['tools']);
    const w = wallet(2000);
    buy(producer, w, 'tools', 20);
    const spent = 2000 - w.gold;
    const goldAfterBuying = w.gold;
    expect(sell(consumer, w, 'tools', Infinity)).toBe('ok');
    expect(w.cargo.tools).toBe(0);
    expect(w.gold - goldAfterBuying).toBeGreaterThan(spent * 1.3);
  });

  it('cannot sell what is not on board', () => {
    expect(sell(createMarket('small', [], []), wallet(0), 'fish')).toBe('nothingToSell');
  });
});
