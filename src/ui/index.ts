import { onLanguageChange } from '../i18n';
import type { Port } from '../world/worldgen';
import type { GameApi } from './api';
import { type DialogSpec, showDialog } from './dialog';
import { el } from './dom';
import { Hud } from './hud';
import { Minimap } from './minimap';
import { PortPanel } from './portPanel';

const MAX_TOASTS = 3;

/** HTML overlay on top of the game canvas: HUD, minimap, port market, dialogs and messages. */
export class UI {
  private readonly hud: Hud;
  private readonly minimap: Minimap;
  private readonly portPanel: PortPanel;
  private readonly toasts = el('div', { class: 'toasts' });
  private readonly modals = el('div', { class: 'modals' });
  private dialogCount = 0;

  constructor(
    root: HTMLElement,
    private readonly api: GameApi,
    onHelp: () => void,
  ) {
    root.replaceChildren();
    this.hud = new Hud(root, { onEnterPort: (port) => api.enterPort(port.id), onHelp });
    this.minimap = new Minimap(root, api);
    root.append(this.toasts, this.modals);
    this.portPanel = new PortPanel(this.modals, api, (text) => this.toast(text));

    onLanguageChange(() => {
      this.hud.refreshTexts();
      this.minimap.refreshTexts();
      this.portPanel.render();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.portPanel.isOpen) api.leavePort();
    });
  }

  update(): void {
    this.hud.update(this.api.hudState());
    this.minimap.draw();
  }

  setDockPort(port: Port | null): void {
    this.hud.setDockPort(port);
  }

  openPort(port: Port): void {
    this.portPanel.open(port);
  }

  closePort(): void {
    this.portPanel.close();
  }

  toast(text: string): void {
    const item = el('div', { class: 'toast', text });
    this.toasts.append(item);
    while (this.toasts.children.length > MAX_TOASTS) this.toasts.firstElementChild?.remove();
    setTimeout(() => item.classList.add('hide'), 3200);
    setTimeout(() => item.remove(), 3700);
  }

  /** Shows a modal message; the game is paused until it is closed. */
  showDialog(spec: DialogSpec): void {
    const reason = `dialog-${++this.dialogCount}`;
    this.api.setPaused(reason, true);
    showDialog(this.modals, {
      ...spec,
      onClose: () => {
        this.api.setPaused(reason, false);
        spec.onClose?.();
      },
    });
  }
}
