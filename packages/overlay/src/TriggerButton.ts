import type { DaubConfig } from '@daub/core';
import { DAUB_ICON, HELP_ICON } from './icons.js';

export class TriggerButton {
  private el: HTMLButtonElement;
  private tooltip: HTMLDivElement;

  constructor(private shadow: ShadowRoot, private config: DaubConfig) {
    this.el = document.createElement('button');
    this.el.className = 'daub-trigger';
    this.el.innerHTML = DAUB_ICON;
    this.el.setAttribute('aria-label', 'Open Daub — pick a component');
    this.applyPosition();

    // Help tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'daub-trigger-tooltip';
    this.tooltip.innerHTML = `${HELP_ICON} Navigate to the state you want to capture, then click to pick a component.`;
    this.tooltip.style.cssText = `
      display: none; position: fixed; padding: 6px 10px; background: var(--daub-bg);
      border: 1px solid var(--daub-border); border-radius: 6px; color: var(--daub-text-muted);
      font-size: 11px; font-family: system-ui, sans-serif; max-width: 220px; line-height: 1.4;
      pointer-events: none; z-index: 2147483647; gap: 6px; align-items: flex-start;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    this.el.addEventListener('mouseenter', this.showTooltip);
    this.el.addEventListener('mouseleave', this.hideTooltip);
  }

  mount(): void {
    this.shadow.appendChild(this.el);
    this.shadow.appendChild(this.tooltip);
  }

  unmount(): void {
    this.el.removeEventListener('mouseenter', this.showTooltip);
    this.el.removeEventListener('mouseleave', this.hideTooltip);
    this.el.remove();
    this.tooltip.remove();
  }

  onClick(handler: () => void): void {
    this.el.addEventListener('click', handler);
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active);
  }

  private applyPosition(): void {
    const pos = this.config.position;
    this.el.style.bottom = pos.includes('bottom') ? '20px' : 'auto';
    this.el.style.top = pos.includes('top') ? '20px' : 'auto';
    this.el.style.right = pos.includes('right') ? '20px' : 'auto';
    this.el.style.left = pos.includes('left') ? '20px' : 'auto';
  }

  private showTooltip = (): void => {
    const rect = this.el.getBoundingClientRect();
    const pos = this.config.position;

    this.tooltip.style.display = 'flex';

    // Position tooltip away from the button
    if (pos.includes('bottom')) {
      this.tooltip.style.bottom = 'auto';
      this.tooltip.style.top = `${rect.top - this.tooltip.offsetHeight - 8}px`;
    } else {
      this.tooltip.style.top = `${rect.bottom + 8}px`;
      this.tooltip.style.bottom = 'auto';
    }

    if (pos.includes('right')) {
      this.tooltip.style.right = '20px';
      this.tooltip.style.left = 'auto';
    } else {
      this.tooltip.style.left = '20px';
      this.tooltip.style.right = 'auto';
    }
  };

  private hideTooltip = (): void => {
    this.tooltip.style.display = 'none';
  };
}
