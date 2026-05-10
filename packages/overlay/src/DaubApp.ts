import type { DaubConfig, ElementContext } from '@daub/core';
import { captureStyles, extractTailwindClasses, serializeDOM } from '@daub/core';
import { createStore } from './state.js';
import { applyStyles } from './styles.js';
import { TriggerButton } from './TriggerButton.js';
import { Picker } from './Picker.js';
import { resolveSource } from './source.js';
import { initScreenCapture, captureElement, releaseStream } from './capture.js';

export class DaubApp {
  private store = createStore();
  private trigger: TriggerButton;
  private picker: Picker | null = null;
  private hasScreenCapture = false;

  constructor(
    private shadow: ShadowRoot,
    private config: DaubConfig,
  ) {
    this.trigger = new TriggerButton(shadow, config);
  }

  mount(): void {
    applyStyles(this.shadow);
    this.trigger.mount();
    this.trigger.onClick(() => this.startPicking());
  }

  // -- State transitions ----------------------------------------------------

  private async startPicking(): Promise<void> {
    if (this.store.state !== 'IDLE') return;

    try {
      this.store.transition('PICKING');
      this.trigger.setActive(true);

      // Request screen capture once per session (v2 B1)
      this.hasScreenCapture = await initScreenCapture();

      this.picker = new Picker(
        (el) => this.onElementSelected(el),
        () => this.onCancel(),
      );
      this.picker.mount();
    } catch (e) {
      console.error('[Daub] Failed to start picking:', e);
      this.onCancel();
    }
  }

  private async onElementSelected(element: HTMLElement): Promise<void> {
    try {
      this.store.transition('CAPTURED');
      this.store.element = element;

      // Capture screenshot before panel opens
      const { full, cropped } = await captureElement(element, this.hasScreenCapture);
      this.store.screenshotBefore = full;
      this.store.croppedScreenshot = cropped;

      // Build ElementContext
      const source = resolveSource(element);
      const computed = captureStyles(element);
      const tailwind = extractTailwindClasses(element);
      const rect = element.getBoundingClientRect();

      const context: ElementContext = {
        source,
        tagName: element.tagName.toLowerCase(),
        domPath: getDomPath(element),
        classList: Array.from(element.classList),
        htmlSubtree: serializeDOM(element, 3),
        computedStyles: computed,
        tailwindClasses: tailwind,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        screenshotBefore: cropped,
        screenshotAfter: null,
        screenshotAnnotated: null,
        cssDelta: [],
        capturedAt: Date.now(),
        notes: '',
      };

      this.store.elementContext = context;
      this.store.transition('PANEL_OPEN');

      // Phase 2 stop-gap: log context, panel comes in Phase 3
      console.log('[Daub] Element captured:', {
        component: source?.componentName ?? element.tagName.toLowerCase(),
        file: source?.file ?? '(unknown)',
        line: source?.line ?? 0,
        tailwind: tailwind.join(' '),
        styles: `${Object.keys(computed).length} properties`,
      });
      console.log('[Daub] Full context:', context);

      // Return to idle for now (panel will take over in Phase 3)
      this.store.reset();
      this.trigger.setActive(false);
      releaseStream();
    } catch (e) {
      console.error('[Daub] Capture failed:', e);
      this.onCancel();
    }
  }

  private onCancel(): void {
    this.picker = null;
    this.store.reset();
    this.trigger.setActive(false);
    releaseStream();
  }

  destroy(): void {
    this.trigger.unmount();
    if (this.picker) {
      this.picker.unmount();
      this.picker = null;
    }
    releaseStream();
    this.store.reset();
  }
}

// -- Helpers ----------------------------------------------------------------

function getDomPath(element: HTMLElement): string {
  const parts: string[] = [];
  let el: HTMLElement | null = element;

  while (el && el !== document.body && el !== document.documentElement) {
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
    } else if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) selector += `.${cls}`;
    }
    parts.unshift(selector);
    el = el.parentElement;
  }

  return parts.join(' > ');
}
