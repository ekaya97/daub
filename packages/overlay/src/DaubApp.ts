import type { DaubConfig, ElementContext, DaubSession } from '@daub/core';
import { captureStyles, extractTailwindClasses, serializeDOM } from '@daub/core';
import { serializeToMarkdown } from '@daub/core';
import { createStore } from './state.js';
import { applyStyles } from './styles.js';
import { TriggerButton } from './TriggerButton.js';
import { Picker } from './Picker.js';
import { Panel } from './Panel.js';
import { resolveSource } from './source.js';
import { captureElement } from './capture.js';
import { copyToClipboard } from './clipboard.js';
import { showToast } from './Toast.js';
import { saveSession } from './history.js';

export class DaubApp {
  private store = createStore();
  private trigger: TriggerButton;
  private picker: Picker | null = null;
  private panel: Panel | null = null;

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
    this.trigger.onHistoryClick(() => this.openPanelToHistory());
    document.addEventListener('keydown', this.boundKeyDown);
  }

  // -- Keyboard handling ----------------------------------------------------

  private boundKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.store.state === 'PICKING') {
        // Picker handles its own Escape, but just in case
        this.onCancel();
      } else if (this.store.state === 'PANEL_OPEN') {
        this.closePanel();
      }
      return;
    }

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

      // Capture screenshot
      let screenshotData: { full: string; cropped: string };
      try {
        screenshotData = await captureElement(element);
      } catch (e) {
        console.warn('[Daub] Screenshot failed:', e);
        showToast(this.shadow, 'Screenshot failed. Context will be text-only.', 'warning');
        screenshotData = { full: '', cropped: '' };
      }

      this.store.screenshotBefore = screenshotData.full;
      this.store.croppedScreenshot = screenshotData.cropped;

      // Build ElementContext — each part wrapped so one failure doesn't block the rest
      const source = safeCall(() => resolveSource(element), null);
      const computed = safeCall(() => captureStyles(element), {} as ReturnType<typeof captureStyles>);
      const tailwind = safeCall(() => extractTailwindClasses(element), []);
      const rect = element.getBoundingClientRect();

      const context: ElementContext = {
        source,
        tagName: element.tagName.toLowerCase(),
        domPath: safeCall(() => getDomPath(element), element.tagName.toLowerCase()),
        classList: Array.from(element.classList),
        htmlSubtree: safeCall(() => serializeDOM(element, 3), `<${element.tagName.toLowerCase()} />`),
        computedStyles: computed,
        tailwindClasses: tailwind,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        screenshotBefore: screenshotData.cropped,
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
      console.log('[Daub] Opening panel...');
      try {
        this.panel = new Panel(this.shadow, this.config, {
          onClose: () => this.closePanel(),
          onCopy: () => this.handleCopy(),
          onReselect: () => {
            this.closePanel();
            this.startPicking();
          },
        });
        this.panel.mount(context, element);
        console.log('[Daub] Panel mounted successfully');
      } catch (panelErr) {
        console.error('[Daub] Panel failed to mount:', panelErr);
        throw panelErr;
      }

      this.trigger.setActive(false);
    } catch (e) {
      console.error('[Daub] Capture failed:', e);
      showToast(this.shadow, 'Capture failed. Please try again.', 'error');
      this.onCancel();
    }
  }

  private closePanel(): void {
    this.panel?.unmount();
    this.panel = null;
    this.store.reset();
    this.trigger.setActive(false);
  }

  private openPanelToHistory(): void {
    if (this.store.state === 'PANEL_OPEN') {
      // Panel is already open — just close it
      this.closePanel();
      return;
    }

    // Create a minimal context for history-only viewing
    const emptyContext: ElementContext = {
      source: null,
      tagName: '',
      domPath: '',
      classList: [],
      htmlSubtree: '',
      computedStyles: {} as ElementContext['computedStyles'],
      tailwindClasses: [],
      rect: { top: 0, left: 0, width: 0, height: 0 },
      screenshotBefore: '',
      screenshotAfter: null,
      screenshotAnnotated: null,
      cssDelta: [],
      capturedAt: Date.now(),
      notes: '',
    };

    // Skip PICKING/CAPTURED — go straight to PANEL_OPEN
    if (this.store.state === 'IDLE') {
      this.store.transition('PICKING');
      this.store.transition('CAPTURED');
      this.store.transition('PANEL_OPEN');
    }

    this.panel = new Panel(this.shadow, this.config, {
      onClose: () => this.closePanel(),
      onCopy: () => this.handleCopy(),
      onReselect: () => {
        this.closePanel();
        this.startPicking();
      },
    });
    this.panel.mount(emptyContext, undefined, 'history');
  }

  private async handleCopy(): Promise<void> {
    const ctx = this.store.elementContext;
    if (!ctx) return;

    try {
      // Gather final state
      const annotated = this.panel?.getAnnotatedScreenshot();
      if (annotated) ctx.screenshotAnnotated = annotated;

      const sessionId = crypto.randomUUID().replace(/-/g, '');
      const markdown = serializeToMarkdown(ctx, sessionId);

      console.log('[Daub] Copying to clipboard...', { sessionId });

      const result = await copyToClipboard(ctx, markdown, sessionId, this.config);

      if (result.success) {
        showToast(this.shadow, 'Copied! Paste into Claude Code.', 'success');

        // Save to history (non-blocking)
        const session: DaubSession = { id: sessionId, elementContext: ctx, outputMarkdown: markdown };
        saveSession(session).catch(e => console.warn('[Daub] Failed to save session:', e));
      } else {
        showToast(this.shadow, result.error ?? 'Copy failed.', 'error');
      }
    } catch (e) {
      console.error('[Daub] Copy failed:', e);
      showToast(this.shadow, 'Copy failed. Use the markdown preview to copy manually.', 'error');
    }
  }

  private onCancel(): void {
    this.picker = null;
    this.store.reset();
    this.trigger.setActive(false);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    this.trigger.unmount();
    this.picker?.unmount();
    this.picker = null;
    this.panel?.unmount();
    this.panel = null;
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

/** Call fn, return fallback on any error. Never throws. */
function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.warn('[Daub]', e);
    return fallback;
  }
}
