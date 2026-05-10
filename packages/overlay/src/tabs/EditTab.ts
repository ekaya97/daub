import type { CssDelta } from '@daub/core';
import { captureStyles, diffStyles } from '@daub/core';
import { BoxModelSection } from '../edit-sections/BoxModelSection.js';
import { FlexboxSection } from '../edit-sections/FlexboxSection.js';
import { ColorsSection } from '../edit-sections/ColorsSection.js';
import { TypographySection } from '../edit-sections/TypographySection.js';
import { OverflowSection } from '../edit-sections/OverflowSection.js';
import { captureElement } from '../capture.js';

type CapturedStyles = ReturnType<typeof captureStyles>;

export class EditTab {
  private container: HTMLElement;
  private element: HTMLElement;
  private originalStyles: CapturedStyles;
  private dirty = false;
  private highlightOverlay: HTMLDivElement | null = null;
  private rafId: number | null = null;
  private disconnectedBanner: HTMLDivElement | null = null;

  private boxModel: BoxModelSection | null = null;
  private flexbox: FlexboxSection | null = null;
  private colors: ColorsSection | null = null;
  private typography: TypographySection | null = null;
  private overflow: OverflowSection | null = null;

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
    this.originalStyles = captureStyles(element);
  }

  mount(): void {
    // Add highlight overlay on the live element
    this.addHighlight();

    // Disconnected element banner (hidden by default)
    this.disconnectedBanner = document.createElement('div');
    this.disconnectedBanner.style.cssText = `
      display:none; padding:8px 12px; background:rgba(234,179,8,0.15);
      border:1px solid var(--daub-warning); border-radius:6px; color:var(--daub-warning);
      font-size:12px; margin-bottom:12px;
    `;
    this.disconnectedBanner.textContent = 'Component was unmounted. Edits paused. Close and re-select.';
    this.container.appendChild(this.disconnectedBanner);

    // Scroll-to-element link
    const scrollLink = document.createElement('button');
    scrollLink.style.cssText = `
      display:none; background:none; border:none; color:var(--daub-accent);
      font-size:12px; cursor:pointer; padding:0; margin-bottom:12px; text-decoration:underline;
    `;
    scrollLink.textContent = 'Scroll to element';
    scrollLink.addEventListener('click', () => {
      this.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    this.container.appendChild(scrollLink);

    const onEdit = () => {
      if (!this.element.isConnected) {
        this.showDisconnected();
        return;
      }
      this.dirty = true;
    };

    // Box model
    this.boxModel = new BoxModelSection(this.container, this.element);
    this.boxModel.onEdit(onEdit);
    this.boxModel.mount();

    // Flexbox (conditional)
    this.flexbox = new FlexboxSection(this.container, this.element);
    this.flexbox.onEdit(onEdit);
    this.flexbox.mount(); // internally checks shouldShow()

    // Colors
    this.colors = new ColorsSection(this.container, this.element);
    this.colors.onEdit(onEdit);
    this.colors.mount();

    // Typography
    this.typography = new TypographySection(this.container, this.element);
    this.typography.onEdit(onEdit);
    this.typography.mount();

    // Overflow
    this.overflow = new OverflowSection(this.container, this.element);
    this.overflow.onEdit(onEdit);
    this.overflow.mount();

    // HMR listener
    if (typeof (import.meta as any).hot !== 'undefined') {
      (import.meta as any).hot?.on('vite:afterUpdate', () => {
        if (!this.element.isConnected) {
          this.showDisconnected();
        }
      });
    }
  }

  unmount(): void {
    this.removeHighlight();
    this.container.innerHTML = '';
    this.boxModel = null;
    this.flexbox = null;
    this.colors = null;
    this.typography = null;
    this.overflow = null;
    this.disconnectedBanner = null;
  }

  getCssDelta(): CssDelta[] {
    if (!this.dirty) return [];
    return diffStyles(this.originalStyles, captureStyles(this.element));
  }

  hasEdits(): boolean {
    return this.dirty;
  }

  async captureAfterScreenshot(): Promise<string | null> {
    if (!this.dirty) return null;
    try {
      const { cropped } = await captureElement(this.element, false);
      return cropped;
    } catch {
      return null;
    }
  }

  resetEdits(): void {
    // Remove all inline style overrides
    const keys = Object.keys(this.originalStyles) as (keyof CapturedStyles)[];
    for (const key of keys) {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      this.element.style.removeProperty(cssKey);
    }
    this.dirty = false;
  }

  // -- Highlight overlay --

  private addHighlight(): void {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.style.cssText = `
      position:fixed; border:2px dashed #6366f1; background:rgba(99,102,241,0.05);
      pointer-events:none; z-index:2147483645; border-radius:3px;
    `;
    document.body.appendChild(this.highlightOverlay);
    this.updateHighlightPosition();
  }

  private updateHighlightPosition = (): void => {
    if (!this.highlightOverlay) return;

    if (!this.element.isConnected) {
      this.highlightOverlay.style.display = 'none';
      this.showDisconnected();
      return;
    }

    const rect = this.element.getBoundingClientRect();
    Object.assign(this.highlightOverlay.style, {
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    this.rafId = requestAnimationFrame(this.updateHighlightPosition);
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
