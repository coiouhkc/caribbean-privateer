import { onLanguageChange } from '../i18n';
import { el } from './dom';

export interface DialogSpec {
  icon?: string;
  /** Text producers are re-evaluated when the language changes while the dialog is open. */
  title: () => string;
  paragraphs: () => string[];
  button: () => string;
  onClose?: () => void;
}

export function showDialog(layer: HTMLElement, spec: DialogSpec): void {
  const backdrop = el('div', { class: 'backdrop' });
  const box = el('div', { class: 'modal dialog' });
  backdrop.append(box);

  const render = () => {
    box.replaceChildren(
      ...(spec.icon ? [el('div', { class: 'dialog-icon', text: spec.icon })] : []),
      el('h2', { text: spec.title() }),
      ...spec.paragraphs().map((text) => el('p', { text })),
      el('button', { class: 'big-button', text: spec.button(), onClick: close }),
    );
  };
  const unsubscribe = onLanguageChange(render);
  function close() {
    unsubscribe();
    backdrop.remove();
    spec.onClose?.();
  }
  render();
  layer.append(backdrop);
  box.querySelector('button')?.focus();
}
