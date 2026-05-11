import { createIcon } from './icons.js';
import type { DaubConfig } from '@daub/core';

export class TriggerButton {
  private el: HTMLDivElement | null = null;
  private mainBtn: HTMLDivElement | null = null;
  private actionBtn: HTMLButtonElement | null = null;
  private clickHandler: (() => void) | null = null;
  private historyClickHandler: (() => void) | null = null;

  constructor(private shadow: ShadowRoot, private config: DaubConfig) {}

  mount(): void {
    // Root container
    const root = document.createElement('div');
    root.className = 'daub-trigger';
    if (this.config.triggerStyle === 'compact') {
      root.classList.add('compact');
    }
    this.el = root;

    // Main clickable area (activates picker)
    const main = document.createElement('div');
    main.className = 'daub-trigger-main';
    main.setAttribute('role', 'button');
    main.setAttribute('tabindex', '0');
    main.setAttribute('aria-label', 'Open Daub — pick a component');

    // Gradient circle mark
    const mark = document.createElement('div');
    mark.className = 'daub-trigger-mark';

    // Label
    const label = document.createElement('span');
    label.className = 'daub-trigger-label';
    label.textContent = 'daub';

    // Keyboard shortcut badge
    const kbd = document.createElement('span');
    kbd.className = 'daub-trigger-kbd';
    kbd.textContent = this.formatShortcut(this.config.shortcut);

    main.appendChild(mark);
    main.appendChild(label);
    main.appendChild(kbd);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'daub-trigger-sep';

    // Action button (opens history)
    const action = document.createElement('button');
    action.className = 'daub-trigger-action';
    action.setAttribute('aria-label', 'Open history');
    action.appendChild(createIcon('layers', 12));

    root.appendChild(main);
    root.appendChild(sep);
    root.appendChild(action);

    this.mainBtn = main;
    this.actionBtn = action;

    // Re-attach handlers if they were registered before mount
    if (this.clickHandler) {
      this.mainBtn.addEventListener('click', this.clickHandler);
    }
    if (this.historyClickHandler) {
      this.actionBtn.addEventListener('click', this.historyClickHandler);
    }

    this.shadow.appendChild(root);
  }

  unmount(): void {
    if (this.mainBtn && this.clickHandler) {
      this.mainBtn.removeEventListener('click', this.clickHandler);
    }
    if (this.actionBtn && this.historyClickHandler) {
      this.actionBtn.removeEventListener('click', this.historyClickHandler);
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.mainBtn = null;
    this.actionBtn = null;
  }

  setActive(active: boolean): void {
    if (this.el) {
      this.el.classList.toggle('selecting', active);
    }
  }

  onClick(handler: () => void): void {
    this.clickHandler = handler;
    if (this.mainBtn) {
      this.mainBtn.addEventListener('click', handler);
    }
  }

  onHistoryClick(handler: () => void): void {
    this.historyClickHandler = handler;
    if (this.actionBtn) {
      this.actionBtn.addEventListener('click', handler);
    }
  }

  private formatShortcut(shortcut: string): string {
    const replacements: Record<string, string> = {
      'Alt': '\u2325',
      'Ctrl': '\u2303',
      'Shift': '\u21E7',
      'Meta': '\u2318',
      'Cmd': '\u2318',
    };

    return shortcut
      .split('+')
      .map((part) => {
        const trimmed = part.trim();
        return replacements[trimmed] ?? trimmed;
      })
      .join('');
  }
}
