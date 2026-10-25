import { formatNumber, type MessageKey, t } from '../i18n';
import { availableStock, buyPrice, sellPrice, type TradeResult } from '../world/economy';
import { cargoUsed, GOOD_INFO, GOODS, type GoodId } from '../world/goods';
import type { Port } from '../world/worldgen';
import type { GameApi } from './api';
import { el } from './dom';

const TRADE_MESSAGES: Record<Exclude<TradeResult, 'ok'>, MessageKey> = {
  noGold: 'trade.noGold',
  cargoFull: 'trade.cargoFull',
  soldOut: 'trade.soldOut',
  nothingToSell: 'trade.nothingToSell',
};

/** The market screen shown while the ship is in a port. The game is paused meanwhile. */
export class PortPanel {
  private backdrop: HTMLElement | null = null;
  private port: Port | null = null;

  constructor(
    private readonly layer: HTMLElement,
    private readonly api: GameApi,
    private readonly toast: (text: string) => void,
  ) {}

  get isOpen(): boolean {
    return this.port !== null;
  }

  open(port: Port): void {
    this.port = port;
    this.backdrop = el('div', { class: 'backdrop' });
    this.layer.append(this.backdrop);
    this.render();
  }

  close(): void {
    this.backdrop?.remove();
    this.backdrop = null;
    this.port = null;
  }

  render(): void {
    const { port, backdrop } = this;
    if (!port || !backdrop) return;
    const state = this.api.hudState();
    const cargo = this.api.playerCargo();
    const repairCost = this.api.repairCost();

    const rows = GOODS.map((good) => this.goodRow(port, good, cargo[good]));
    const panel = el('div', { class: 'modal port-panel' }, [
      el('header', {}, [
        el('h2', { text: `⚓ ${t(port.nameKey)}` }),
        el('div', { class: 'port-size', text: t(`portSize.${port.size}`) }),
      ]),
      el('div', { class: 'port-summary' }, [
        el('span', { text: `💰 ${formatNumber(state.gold)}` }),
        el('span', { class: cargoUsed(cargo) >= state.capacity ? 'full' : '', text: `📦 ${cargoUsed(cargo)} / ${state.capacity}` }),
      ]),
      el('div', { class: 'goods' }, rows),
      el('footer', {}, [
        repairCost > 0
          ? el('button', { class: 'repair', text: `🔧 ${t('port.repair', { cost: `${formatNumber(repairCost)} 💰` })}`, onClick: () => this.repair() })
          : el('span', { class: 'ship-ok', text: `✨ ${t('port.shipOk')}` }),
        el('button', { class: 'big-button leave', text: `⛵ ${t('port.leave')}`, onClick: () => this.api.leavePort() }),
      ]),
    ]);
    backdrop.replaceChildren(panel);
  }

  private goodRow(port: Port, good: GoodId, onBoard: number): HTMLElement {
    const info = GOOD_INFO[good];
    const market = port.market;
    const role = market[good].role;
    const stock = availableStock(market, good);
    const wantedIn = this.api.world.ports
      .filter((other) => other.id !== port.id && other.demands.includes(good))
      .map((other) => t(other.nameKey));

    const badge = role === 'produce'
      ? el('span', { class: 'badge cheap', text: t('port.cheap') })
      : role === 'demand'
        ? el('span', { class: 'badge wanted', text: t('port.wanted') })
        : null;

    return el('div', { class: `good-row ${role}` }, [
      el('div', { class: 'good-name' }, [
        el('span', { class: 'good-icon', text: info.icon }),
        el('span', { text: t(info.nameKey) }),
        badge,
      ]),
      el('div', { class: 'good-info' }, [
        el('span', { text: t('port.inPort', { count: stock }) }),
        el('span', { class: onBoard > 0 ? 'on-board' : '', text: t('port.onBoard', { count: onBoard }) }),
      ]),
      wantedIn.length > 0 ? el('div', { class: 'good-hint', text: t('port.wantedIn', { ports: wantedIn.join(', ') }) }) : null,
      el('div', { class: 'good-actions' }, [
        el('button', {
          class: 'sell',
          text: t('port.sell', { price: `${sellPrice(market, good)} 💰` }),
          disabled: onBoard === 0,
          onClick: () => this.trade(this.api.sell(port.id, good, 1)),
        }),
        el('button', {
          class: 'sell',
          text: t('port.sellAll'),
          disabled: onBoard === 0,
          onClick: () => this.trade(this.api.sell(port.id, good, Infinity)),
        }),
        el('button', {
          class: 'buy',
          text: t('port.buy', { price: `${buyPrice(market, good)} 💰` }),
          disabled: stock === 0,
          onClick: () => this.trade(this.api.buy(port.id, good, 1)),
        }),
        el('button', {
          class: 'buy',
          text: t('port.buyMore'),
          disabled: stock === 0,
          onClick: () => this.trade(this.api.buy(port.id, good, 5)),
        }),
      ]),
    ]);
  }

  private trade(result: TradeResult): void {
    if (result !== 'ok') this.toast(t(TRADE_MESSAGES[result]));
    this.render();
  }

  private repair(): void {
    if (this.api.repair()) this.toast(t('msg.repaired'));
    else this.toast(t('trade.noGold'));
    this.render();
  }
}
