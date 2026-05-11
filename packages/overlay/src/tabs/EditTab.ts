import { createIcon } from '../icons.js';
import { captureStyles } from '@daub/core';
import type { CapturedStyles, CssDelta } from '@daub/core';
import { SpacingSection } from '../edit-sections/SpacingSection.js';
import { TypographySection } from '../edit-sections/TypographySection.js';
import { ColorSection } from '../edit-sections/ColorSection.js';
import { LayoutSection } from '../edit-sections/LayoutSection.js';
import { SizeSection } from '../edit-sections/SizeSection.js';

type EditSection = SpacingSection | SizeSection | LayoutSection | TypographySection | ColorSection;

export class EditTab {
  private container: HTMLElement;
  private rootElement: HTMLElement;
  private targetElement: HTMLElement;
  private originalStylesMap: Map<HTMLElement, CapturedStyles> = new Map();
  private inlineStyleMap: Map<HTMLElement, string> = new Map();

  private highlightOverlay: HTMLDivElement | null = null;
  private rafId: number | null = null;
  private editHandler: (() => void) | null = null;
  private mode: 'after' | 'before' = 'after';
  private inlineBackup: Map<HTMLElement, string> = new Map();

  private disconnectedBanner: HTMLDivElement | null = null;
  private navEl: HTMLDivElement | null = null;
  private breadcrumbEl: HTMLDivElement | null = null;
  private childrenEl: HTMLDivElement | null = null;
  private controlsEl: HTMLDivElement | null = null;
  private toggleLabel: HTMLSpanElement | null = null;
  private toggleButtons: HTMLButtonElement[] = [];

  private sections: EditSection[] = [];

  private screenshot: string;

  constructor(container: HTMLElement, element: HTMLElement, screenshot: string) {
    this.container = container;
    this.rootElement = element;
    this.targetElement = element;
    this.screenshot = screenshot;

    // Capture original styles and inline style for the root element
    this.originalStylesMap.set(element, captureStyles(element));
    this.inlineStyleMap.set(element, element.getAttribute('style') || '');
  }

  mount(): void {
    this.addHighlight();

    const root = document.createElement('div');
    root.className = 'daub-edit';

    // ---- Navigator (breadcrumb + toggle in one row) ----
    this.navEl = document.createElement('div');
    this.navEl.className = 'daub-edit-nav';

    // Top row: breadcrumb (left) + before/after toggle (right)
    const topRow = document.createElement('div');
    topRow.className = 'daub-edit-nav-row';

    this.breadcrumbEl = document.createElement('div');
    this.breadcrumbEl.className = 'daub-edit-breadcrumb';
    topRow.appendChild(this.breadcrumbEl);

    // Before/After toggle (inline in the top row)
    const toggle = document.createElement('div');
    toggle.className = 'daub-edit-toggle';

    const afterBtn = document.createElement('button');
    afterBtn.className = 'daub-edit-toggle-btn';
    afterBtn.setAttribute('data-active', 'true');
    afterBtn.textContent = 'after';
    afterBtn.addEventListener('click', () => this.setMode('after'));

    const beforeBtn = document.createElement('button');
    beforeBtn.className = 'daub-edit-toggle-btn';
    beforeBtn.setAttribute('data-active', 'false');
    beforeBtn.textContent = 'before';
    beforeBtn.addEventListener('click', () => this.setMode('before'));

    this.toggleButtons = [afterBtn, beforeBtn];

    this.toggleLabel = document.createElement('span');
    this.toggleLabel.className = 'daub-edit-toggle-label';
    this.updateToggleLabel();

    toggle.append(afterBtn, beforeBtn, this.toggleLabel);
    topRow.appendChild(toggle);

    this.navEl.appendChild(topRow);

    // Children row
    this.childrenEl = document.createElement('div');
    this.childrenEl.className = 'daub-edit-children';
    this.navEl.appendChild(this.childrenEl);

    root.appendChild(this.navEl);

    this.buildBreadcrumb();
    this.buildChildren();

    // ---- Controls (scrollable) ----
    this.controlsEl = document.createElement('div');
    this.controlsEl.className = 'daub-edit-controls';

    // Disconnected banner (hidden)
    this.disconnectedBanner = document.createElement('div');
    this.disconnectedBanner.style.cssText =
      'display:none;padding:8px 12px;background:rgba(234,179,8,0.12);border:1px solid oklch(0.78 0.16 80);border-radius:6px;color:oklch(0.78 0.16 80);font-size:11.5px;margin-bottom:8px;';
    this.disconnectedBanner.textContent = 'Element was removed from the DOM. Edits paused.';
    this.controlsEl.appendChild(this.disconnectedBanner);

    this.mountSections();

    root.appendChild(this.controlsEl);
    this.container.appendChild(root);
  }

  unmount(): void {
    this.removeHighlight();
    this.unmountSections();
    this.navEl = null;
    this.breadcrumbEl = null;
    this.childrenEl = null;
    this.controlsEl = null;
    this.toggleLabel = null;
    this.toggleButtons = [];
    this.disconnectedBanner = null;
    this.container.innerHTML = '';
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  getCssDelta(): CssDelta[] {
    const allDeltas: CssDelta[] = [];

    for (const [element, originalStyles] of this.originalStylesMap) {
      if (!element.isConnected) continue;

      const current = captureStyles(element);
      const keys = Object.keys(originalStyles) as (keyof CapturedStyles)[];
      const elementPath = this.getElementPath(element);

      for (const key of keys) {
        const before = originalStyles[key];
        const after = current[key];
        if (before !== after) {
          const cssProp = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          allDeltas.push({ property: `${elementPath} > ${cssProp}`, before, after });
        }
      }
    }

    return allDeltas;
  }

  getChangeCount(): number {
    return this.getCssDelta().length;
  }

  // ---- Navigator ----

  private buildBreadcrumb(): void {
    if (!this.breadcrumbEl) return;
    this.breadcrumbEl.innerHTML = '';

    const path = this.getAncestorPath(this.rootElement, this.targetElement);

    for (let i = 0; i < path.length; i++) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'daub-edit-breadcrumb-sep';
        sep.textContent = '/';
        this.breadcrumbEl.appendChild(sep);
      }

      const el = path[i];
      const item = document.createElement('span');
      item.className = 'daub-edit-breadcrumb-item';
      item.textContent = this.getElementLabel(el);

      if (el === this.targetElement) {
        item.classList.add('active');
      } else {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => this.drillTo(el));
      }

      this.breadcrumbEl.appendChild(item);
    }
  }

  private buildChildren(): void {
    if (!this.childrenEl) return;
    this.childrenEl.innerHTML = '';

    const children = Array.from(this.targetElement.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );

    for (const child of children) {
      const btn = document.createElement('button');
      btn.className = 'daub-edit-child';

      const tag = child.tagName.toLowerCase();
      const textContent = child.textContent?.trim() || '';
      let label = tag;
      if (textContent) {
        const truncated =
          textContent.length > 16 ? textContent.slice(0, 13) + '\u2026' : textContent;
        label = `${tag} "${truncated}"`;
      }
      btn.textContent = label;

      btn.addEventListener('click', () => this.drillTo(child));
      this.childrenEl!.appendChild(btn);
    }
  }

  private drillTo(element: HTMLElement): void {
    this.targetElement = element;

    // Capture original styles if first time visiting this element
    if (!this.originalStylesMap.has(element)) {
      this.originalStylesMap.set(element, captureStyles(element));
    }
    if (!this.inlineStyleMap.has(element)) {
      this.inlineStyleMap.set(element, element.getAttribute('style') || '');
    }

    // Unmount current sections
    this.unmountSections();

    // Rebuild navigator
    this.buildBreadcrumb();
    this.buildChildren();

    // Remount sections targeting the new element
    this.mountSections();

    // Move highlight overlay to the new element
    // (trackHighlight already reads from this.targetElement)

    // Update change count
    this.updateToggleLabel();
    this.editHandler?.();
  }

  private getElementLabel(el: HTMLElement): string {
    // Only check the fiber directly on this element (don't walk up)
    // Walking up would make every child show the parent component name
    const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      const fiber = (el as any)[fiberKey];
      if (fiber?.type && typeof fiber.type === 'function' && fiber.type.name) {
        const name = fiber.type.name;
        return name.length > 20 ? name.slice(0, 17) + '\u2026' : name;
      }
      if (fiber?.type && typeof fiber.type === 'object' && fiber.type.displayName) {
        const name = fiber.type.displayName;
        return name.length > 20 ? name.slice(0, 17) + '\u2026' : name;
      }
    }

    // Fallback: tagName + first class
    const tag = el.tagName.toLowerCase();
    const firstClass = el.classList[0];
    const label = firstClass ? `${tag}.${firstClass}` : tag;
    return label.length > 20 ? label.slice(0, 17) + '\u2026' : label;
  }

  private getAncestorPath(root: HTMLElement, target: HTMLElement): HTMLElement[] {
    const path: HTMLElement[] = [];
    let current: HTMLElement | null = target;

    while (current) {
      path.unshift(current);
      if (current === root) break;
      current = current.parentElement;
    }

    // If we didn't reach root (shouldn't happen), prepend it
    if (path[0] !== root) {
      path.unshift(root);
    }

    return path;
  }

  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== this.rootElement.parentElement) {
      path.unshift(this.getElementLabel(current));
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // ---- Sections ----

  private mountSections(): void {
    if (!this.controlsEl) return;

    const handleSectionEdit = () => {
      if (!this.targetElement.isConnected) {
        this.showDisconnected();
        return;
      }
      this.updateToggleLabel();
      this.editHandler?.();
    };

    const spacing = new SpacingSection(this.controlsEl, this.targetElement);
    spacing.onEdit(handleSectionEdit);
    spacing.mount();

    const size = new SizeSection(this.controlsEl, this.targetElement);
    size.onEdit(handleSectionEdit);
    size.mount();

    const layout = new LayoutSection(this.controlsEl, this.targetElement);
    layout.onEdit(handleSectionEdit);
    layout.mount();

    const typography = new TypographySection(this.controlsEl, this.targetElement);
    typography.onEdit(handleSectionEdit);
    typography.mount();

    const color = new ColorSection(this.controlsEl, this.targetElement);
    color.onEdit(handleSectionEdit);
    color.mount();

    this.sections = [spacing, size, layout, typography, color];
  }

  private unmountSections(): void {
    for (const section of this.sections) {
      section.unmount();
    }
    this.sections = [];
  }

  // ---- Before/After Toggle ----

  private setMode(newMode: 'after' | 'before'): void {
    if (newMode === this.mode) return;

    const prevMode = this.mode;
    this.mode = newMode;

    // Update button states
    for (const btn of this.toggleButtons) {
      btn.setAttribute('data-active', btn.textContent === newMode ? 'true' : 'false');
    }

    if (newMode === 'before') {
      // Save current inline styles to backup, then restore originals
      this.inlineBackup.clear();
      for (const [element, originalInline] of this.inlineStyleMap) {
        if (!element.isConnected) continue;
        this.inlineBackup.set(element, element.getAttribute('style') || '');
        element.setAttribute('style', originalInline);
      }
    } else if (prevMode === 'before') {
      // Restore from backup
      for (const [element, backedUp] of this.inlineBackup) {
        if (!element.isConnected) continue;
        element.setAttribute('style', backedUp);
      }
      this.inlineBackup.clear();
    }
  }

  private updateToggleLabel(): void {
    if (!this.toggleLabel) return;
    const count = this.getChangeCount();
    this.toggleLabel.textContent = `${count} change${count !== 1 ? 's' : ''}`;
  }

  // ---- Highlight overlay ----

  private addHighlight(): void {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.style.cssText =
      'position:fixed;outline:1.5px dashed oklch(0.72 0.18 45 / 0.4);outline-offset:2px;pointer-events:none;z-index:2147483645;';
    document.body.appendChild(this.highlightOverlay);
    this.trackHighlight();
  }

  private trackHighlight = (): void => {
    if (!this.highlightOverlay) return;

    if (!this.targetElement.isConnected) {
      this.highlightOverlay.style.display = 'none';
      this.showDisconnected();
      return;
    }

    const rect = this.targetElement.getBoundingClientRect();
    Object.assign(this.highlightOverlay.style, {
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    this.rafId = requestAnimationFrame(this.trackHighlight);
  };

  private removeHighlight(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.highlightOverlay?.remove();
    this.highlightOverlay = null;
  }

  private showDisconnected(): void {
    if (this.disconnectedBanner) {
      this.disconnectedBanner.style.display = 'block';
    }
  }
}
