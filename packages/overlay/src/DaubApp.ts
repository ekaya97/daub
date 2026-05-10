import type { DaubConfig, ElementContext } from '@daub/core';
import { captureStyles, extractTailwindClasses, serializeDOM } from '@daub/core';
import { createStore } from './state.js';
import { applyStyles } from './styles.js';
import { TriggerButton } from './TriggerButton.js';
import { Picker } from './Picker.js';
import { Panel } from './Panel.js';
import { resolveSource } from './source.js';
import { initScreenCapture, captureElement, releaseStream } from './capture.js';
import { copyToClipboard } from './clipboard.js';
import { showToast } from './Toast.js';
import { serializeToMarkdown } from '@daub/core';

export class DaubApp {
  private store = createStore();
  private trigger: TriggerButton;
  private picker: Picker | null = null;
  private panel: Panel | null = null;
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
    this.trigger.onClick(() => this.handleTriggerClick());

    // Keyboard shortcut
    document.addEventListener('keydown', this.boundKeyDown);
  }

  private boundKeyDown = (e: KeyboardEvent): void => {
    // Escape: cancel picking or close panel
    if (e.key === 'Escape') {
      if (this.store.state === 'PANEL_OPEN') {
        this.closePanel();
      }
      return;
    }

    // Configurable shortcut (default Alt+Shift+D)
    if (matchesShortcut(e, this.config.shortcut)) {
      e.preventDefault();
      this.handleTriggerClick();
    }
  };

  private handleTriggerClick(): void {
    if (this.store.state === 'IDLE') {
      this.startPicking();
    } else if (this.store.state === 'PANEL_OPEN') {
      this.closePanel();
    }
  }

  // -- State transitions ----------------------------------------------------

  private async startPicking(): Promise<void> {
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

      console.log('[Daub] Element captured:', {
        component: source?.componentName ?? element.tagName.toLowerCase(),
        file: source?.file ?? '(unknown)',
        line: source?.line ?? 0,
        tailwind: tailwind.join(' '),
      });

      // Open panel
      this.panel = new Panel(this.shadow, this.config);
      this.panel.onClose(() => this.closePanel());
      this.panel.onCopy(() => this.handleCopy());
      this.panel.mount(context, element);

      this.trigger.setActive(false);
    } catch (e) {
      console.error('[Daub] Capture failed:', e);
      this.onCancel();
    }
  }

  private closePanel(): void {
    this.panel?.unmount();
    this.panel = null;
    this.store.reset();
    this.trigger.setActive(false);
    releaseStream();
  }

  private async handleCopy(): Promise<void> {
    const ctx = this.store.elementContext;
    if (!ctx) return;

    // Gather final state
    const annotated = this.panel?.getAnnotatedScreenshot();
    if (annotated) ctx.screenshotAnnotated = annotated;

    const sessionId = crypto.randomUUID().replace(/-/g, '');
    const markdown = serializeToMarkdown(ctx, sessionId);

    console.log('[Daub] Copying to clipboard...', { sessionId });

    const result = await copyToClipboard(ctx, markdown, sessionId, this.config);

    if (result.success) {
      showToast(this.shadow, 'Copied! Paste into Claude Code.', 'success');
    } else {
      showToast(this.shadow, result.error ?? 'Copy failed.', 'error');
    }
  }

  private onCancel(): void {
    this.picker = null;
    this.store.reset();
    this.trigger.setActive(false);
    releaseStream();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    this.trigger.unmount();
    this.picker?.unmount();
    this.picker = null;
    this.panel?.unmount();
    this.panel = null;
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

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const needsAlt = parts.includes('Alt');
  const needsShift = parts.includes('Shift');
  const needsCtrl = parts.includes('Ctrl');
  const needsMeta = parts.includes('Meta');
  return (
    e.key.toUpperCase() === key.toUpperCase() &&
    e.altKey === needsAlt &&
    e.shiftKey === needsShift &&
    e.ctrlKey === needsCtrl &&
    e.metaKey === needsMeta
  );
}
