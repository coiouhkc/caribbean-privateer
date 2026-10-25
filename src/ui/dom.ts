type Child = Node | string | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  title?: string;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  const node: HTMLElement = element;
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.title) element.title = props.title;
  if (props.onClick) node.addEventListener('click', props.onClick);
  if (element instanceof HTMLButtonElement) {
    element.type = 'button';
    if (props.disabled) element.disabled = true;
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

/** Sets text only when it changed, to keep per-frame HUD updates cheap. */
export function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
