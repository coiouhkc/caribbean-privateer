import { formatNumber, getLanguage, LANGUAGES, setLanguage, t } from '../i18n';
import type { Port } from '../world/worldgen';
import type { HudState } from './api';
import { el, setText } from './dom';

export class Hud {
  private readonly gold = el('span', { class: 'value' });
  private readonly cargo = el('span', { class: 'value' });
  private readonly hpFill = el('div', { class: 'fill' });
  private readonly reloadLeft = el('div', { class: 'fill' });
  private readonly reloadRight = el('div', { class: 'fill' });
  private readonly goalFill = el('div', { class: 'fill' });
  private readonly goalLabel = el('span', { class: 'goal-label' });
  private readonly enterButton: HTMLButtonElement;
  private readonly langButtons = new Map<string, HTMLButtonElement>();
  private readonly helpButton: HTMLButtonElement;
  private readonly titled: Array<[HTMLElement, Parameters<typeof t>[0]]> = [];
  private dockPort: Port | null = null;
  private lastState: HudState | null = null;

  constructor(parent: HTMLElement, callbacks: { onEnterPort: (port: Port) => void; onHelp: () => void }) {
    const stat = (key: Parameters<typeof t>[0], icon: string, content: HTMLElement) => {
      const row = el('div', { class: 'stat' }, [el('span', { class: 'icon', text: icon }), content]);
      this.titled.push([row, key]);
      return row;
    };
    const bar = (fill: HTMLElement, extra = '') => el('div', { class: `bar ${extra}` }, [fill]);

    const stats = el('div', { class: 'panel hud-stats' }, [
      stat('hud.gold', '💰', this.gold),
      stat('hud.cargo', '📦', this.cargo),
      stat('hud.health', '⛵', bar(this.hpFill, 'hp')),
      stat('hud.cannons', '💥', el('div', { class: 'cannons' }, [
        el('span', { class: 'arrow', text: '◀' }), bar(this.reloadLeft, 'reload'),
        bar(this.reloadRight, 'reload'), el('span', { class: 'arrow', text: '▶' }),
      ])),
      el('div', { class: 'stat goal' }, [el('span', { class: 'icon', text: '🏆' }), el('div', { class: 'goal-box' }, [bar(this.goalFill, 'goal-bar'), this.goalLabel])]),
    ]);

    const lang = el('div', { class: 'panel lang' });
    for (const language of LANGUAGES) {
      const button = el('button', { text: language.toUpperCase(), onClick: () => setLanguage(language) });
      this.langButtons.set(language, button);
      lang.append(button);
    }
    this.helpButton = el('button', { class: 'panel help', text: '?', onClick: callbacks.onHelp });

    this.enterButton = el('button', {
      class: 'enter-port big-button',
      onClick: () => this.dockPort && callbacks.onEnterPort(this.dockPort),
    });
    this.enterButton.hidden = true;

    parent.append(stats, el('div', { class: 'hud-top-right' }, [lang, this.helpButton]), this.enterButton);
    this.refreshTexts();
  }

  setDockPort(port: Port | null): void {
    this.dockPort = port;
    this.enterButton.hidden = port === null;
    this.refreshTexts();
  }

  refreshTexts(): void {
    for (const [element, key] of this.titled) element.title = t(key);
    this.helpButton.title = t('hud.help');
    for (const [language, button] of this.langButtons) button.classList.toggle('active', language === getLanguage());
    if (this.dockPort) setText(this.enterButton, `⚓ ${t('hud.enterPort', { port: t(this.dockPort.nameKey) })}`);
    if (this.lastState) {
      const state = this.lastState;
      this.lastState = null;
      this.update(state);
    }
  }

  update(state: HudState): void {
    const prev = this.lastState;
    this.lastState = state;
    if (prev && JSON.stringify(prev) === JSON.stringify(state)) return;
    setText(this.gold, formatNumber(state.gold));
    setText(this.cargo, `${state.cargoUsed} / ${state.capacity}`);
    this.cargo.classList.toggle('full', state.cargoUsed >= state.capacity);
    this.hpFill.style.width = `${(100 * state.hp) / state.maxHp}%`;
    this.hpFill.classList.toggle('low', state.hp / state.maxHp < 0.3);
    this.setReload(this.reloadLeft, state.reload.left);
    this.setReload(this.reloadRight, state.reload.right);
    this.goalFill.style.width = `${Math.min(100, (100 * state.gold) / state.goal)}%`;
    setText(this.goalLabel, t('hud.goal', { amount: formatNumber(state.goal) }));
  }

  private setReload(fill: HTMLElement, value: number): void {
    fill.style.width = `${Math.round(value * 100)}%`;
    fill.classList.toggle('ready', value >= 1);
  }
}
