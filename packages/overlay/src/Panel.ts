import { createIcon } from './icons.js';
import type { ElementContext, DaubSession, DaubConfig } from '@daub/core';
import { AnnotateTab } from './tabs/AnnotateTab.js';
import { EditTab } from './tabs/EditTab.js';
import { OutputTab } from './tabs/OutputTab.js';
import { HistoryTab } from './tabs/HistoryTab.js';
import { EditTabStub } from './tabs/EditTabStub.js';
import { OutputTabStub } from './tabs/OutputTabStub.js';

type TabId = 'annotate' | 'edit' | 'output' | 'history';

interface TabInstance {
  mount(): void;
  unmount(): void;
}

export class Panel {
  private el: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;
  private footEl: HTMLDivElement | null = null;
  private footHint: HTMLDivElement | null = null;
  private footActions: HTMLDivElement | null = null;
  private tabButtons: Map<TabId, HTMLButtonElement> = new Map();
  private tabCountBadges: Map<TabId, HTMLSpanElement> = new Map();

  private activeTab: TabId = 'annotate';
  private currentTabInstance: TabInstance | null = null;

  private context: ElementContext | null = null;
  private liveElement: HTMLElement | null = null;

  private annotateTab: AnnotateTab | null = null;
  private editTab: (EditTab | EditTabStub) | null = null;
  private historyTab: HistoryTab | null = null;

  private minimized = false;

  // Panel name elements for updating on context change
  private nameTargetSpan: HTMLSpanElement | null = null;
  private sourceSpan: HTMLSpanElement | null = null;
  private sourceLineSpan: HTMLSpanElement | null = null;

  constructor(
    private shadow: ShadowRoot,
    private config: DaubConfig,
    private callbacks: {
      onClose: () => void;
      onCopy: () => void;
      onReselect: () => void;
    },
  ) {}

  mount(context: ElementContext, liveElement?: HTMLElement, initialTab?: 'annotate' | 'edit' | 'output' | 'history'): void {
    this.context = context;
    this.liveElement = liveElement ?? null;

    this.buildDOM();

    if (this.el) {
      this.shadow.appendChild(this.el);
    }

    this.switchTab(initialTab ?? 'annotate');
  }

  unmount(): void {
    this.currentTabInstance?.unmount();
    this.currentTabInstance = null;
    this.el?.remove();
    this.el = null;
  }

  getAnnotatedScreenshot(): string | null {
    return this.annotateTab?.getAnnotatedImage() ?? null;
  }

  getActiveTab(): TabId {
    return this.activeTab;
  }

  // ---- DOM Construction ----

  private buildDOM(): void {
    const ctx = this.context!;

    this.el = document.createElement('div');
    this.el.className = 'daub-panel';

    // --- Grip (draggable) ---
    const grip = document.createElement('div');
    grip.className = 'daub-panel-grip';
    grip.addEventListener('pointerdown', (e) => this.onDragStart(e));
    this.el.appendChild(grip);

    // --- Header ---
    const head = document.createElement('div');
    head.className = 'daub-panel-head';

    // Mark (logo/brand mark)
    const mark = document.createElement('div');
    mark.className = 'daub-panel-mark';
    head.appendChild(mark);

    // Title block
    const titleBlock = document.createElement('div');
    titleBlock.className = 'daub-panel-title';

    // Name row: Daub / <ComponentName />
    const nameRow = document.createElement('div');
    nameRow.className = 'daub-panel-name';

    const brandSpan = document.createElement('span');
    brandSpan.textContent = 'Daub';
    nameRow.appendChild(brandSpan);

    const sepSpan = document.createElement('span');
    sepSpan.className = 'daub-panel-name-sep';
    sepSpan.textContent = '/';
    nameRow.appendChild(sepSpan);

    this.nameTargetSpan = document.createElement('span');
    this.nameTargetSpan.className = 'daub-panel-name-target';
    const componentName = ctx.source?.componentName ?? ctx.tagName;
    this.nameTargetSpan.textContent = `<${componentName} />`;
    nameRow.appendChild(this.nameTargetSpan);

    titleBlock.appendChild(nameRow);

    // Source file row
    const sourceRow = document.createElement('div');
    sourceRow.className = 'daub-panel-source';

    sourceRow.appendChild(createIcon('file', 11));

    this.sourceSpan = document.createElement('span');
    const sourceFile = ctx.source?.file ?? ctx.domPath;
    this.sourceSpan.textContent = sourceFile;
    sourceRow.appendChild(this.sourceSpan);

    this.sourceLineSpan = document.createElement('span');
    this.sourceLineSpan.className = 'daub-panel-source-line';
    if (ctx.source?.line) {
      this.sourceLineSpan.textContent = `:${ctx.source.line}`;
    }
    sourceRow.appendChild(this.sourceLineSpan);

    titleBlock.appendChild(sourceRow);
    head.appendChild(titleBlock);

    // Head actions
    const headActions = document.createElement('div');
    headActions.className = 'daub-head-actions';

    // Reselect button
    const reselectBtn = document.createElement('button');
    reselectBtn.className = 'daub-icon-btn';
    reselectBtn.title = 'Reselect target';
    reselectBtn.appendChild(createIcon('target', 13));
    reselectBtn.addEventListener('click', () => this.callbacks.onReselect());
    headActions.appendChild(reselectBtn);

    // Minimize button
    const minBtn = document.createElement('button');
    minBtn.className = 'daub-icon-btn';
    minBtn.title = 'Minimize';
    minBtn.appendChild(createIcon('min', 13));
    minBtn.addEventListener('click', () => this.toggleMinimize());
    headActions.appendChild(minBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'daub-icon-btn';
    closeBtn.title = 'Close';
    closeBtn.appendChild(createIcon('close', 13));
    closeBtn.addEventListener('click', () => this.callbacks.onClose());
    headActions.appendChild(closeBtn);

    head.appendChild(headActions);
    this.el.appendChild(head);

    // --- Tabs ---
    const tabs = document.createElement('div');
    tabs.className = 'daub-tabs';

    const tabDefs: Array<{ id: TabId; label: string; hasCount: boolean }> = [
      { id: 'annotate', label: 'Annotate', hasCount: true },
      { id: 'edit', label: 'Edit', hasCount: true },
      { id: 'output', label: 'Output', hasCount: false },
      { id: 'history', label: 'History', hasCount: true },
    ];

    for (const def of tabDefs) {
      const btn = document.createElement('button');
      btn.className = 'daub-tab';
      btn.dataset.tab = def.id;
      btn.dataset.active = def.id === 'annotate' ? 'true' : 'false';
      btn.textContent = def.label;

      if (def.hasCount) {
        // Append a space before the badge
        btn.append(' ');
        const badge = document.createElement('span');
        badge.className = 'daub-tab-num';
        badge.textContent = '0';
        btn.appendChild(badge);
        this.tabCountBadges.set(def.id, badge);
      }

      btn.addEventListener('click', () => this.switchTab(def.id));
      this.tabButtons.set(def.id, btn);
      tabs.appendChild(btn);
    }

    // Grow spacer
    const tabGrow = document.createElement('div');
    tabGrow.className = 'daub-tab-grow';
    tabs.appendChild(tabGrow);

    // Status indicator
    const tabStatus = document.createElement('div');
    tabStatus.className = 'daub-tab-status';

    const statusDot = document.createElement('span');
    statusDot.className = 'daub-tab-status-dot';
    tabStatus.appendChild(statusDot);

    const statusLabel = document.createElement('span');
    const port = this.extractPort();
    statusLabel.textContent = `vite \u00b7 :${port}`;
    tabStatus.appendChild(statusLabel);

    tabs.appendChild(tabStatus);
    this.el.appendChild(tabs);

    // --- Body (tab content) ---
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'daub-body';
    this.el.appendChild(this.bodyEl);

    // --- Footer ---
    this.footEl = document.createElement('div');
    this.footEl.className = 'daub-foot';

    // Hint area
    this.footHint = document.createElement('div');
    this.footHint.className = 'daub-foot-hint';
    this.footEl.appendChild(this.footHint);

    // Action buttons wrapper
    this.footActions = document.createElement('div');
    this.footActions.style.cssText = 'display:flex;gap:8px;align-items:center;';

    // Discard button
    const discardBtn = document.createElement('button');
    discardBtn.className = 'daub-btn daub-btn-ghost';
    discardBtn.style.fontSize = '11px';
    discardBtn.textContent = 'Discard';
    discardBtn.addEventListener('click', () => this.handleDiscard());
    this.footActions.appendChild(discardBtn);

    // Hand off button
    const handoffBtn = document.createElement('button');
    handoffBtn.className = 'daub-btn daub-btn-primary';
    handoffBtn.appendChild(createIcon('zap', 12));
    handoffBtn.append(' Hand off');
    handoffBtn.addEventListener('click', () => this.handleHandoff());
    this.footActions.appendChild(handoffBtn);

    this.footEl.appendChild(this.footActions);
    this.el.appendChild(this.footEl);

    // --- Resize handles (top, left, top-left corner) ---
    for (const edge of ['top', 'left', 'top-left'] as const) {
      const handle = document.createElement('div');
      handle.className = 'daub-resize-handle';
      handle.setAttribute('data-edge', edge);
      handle.addEventListener('pointerdown', (e) => this.onResizeStart(e, edge));
      this.el.appendChild(handle);
    }
  }

  // ---- Tab Switching ----

  private switchTab(tabId: TabId): void {
    // Unmount current tab instance
    this.currentTabInstance?.unmount();
    this.currentTabInstance = null;

    // Clear body
    if (this.bodyEl) {
      this.bodyEl.innerHTML = '';
    }

    this.activeTab = tabId;

    // Update tab button active states
    for (const [id, btn] of this.tabButtons) {
      btn.dataset.active = id === tabId ? 'true' : 'false';
    }

    const ctx = this.context!;

    // Create or reuse tab instances
    switch (tabId) {
      case 'annotate': {
        if (!this.annotateTab) {
          this.annotateTab = new AnnotateTab(this.bodyEl!, ctx.screenshotBefore);
        } else {
          this.annotateTab.setContainer(this.bodyEl!);
        }
        this.currentTabInstance = this.annotateTab;
        break;
      }
      case 'edit': {
        if (this.liveElement) {
          if (!this.editTab || this.editTab instanceof EditTabStub) {
            this.editTab = new EditTab(this.bodyEl!, this.liveElement, ctx.screenshotBefore);
          } else {
            this.editTab.setContainer(this.bodyEl!);
          }
          this.currentTabInstance = this.editTab;
        } else {
          const stub = new EditTabStub(this.bodyEl!);
          this.editTab = stub;
          this.currentTabInstance = stub;
        }
        break;
      }
      case 'output': {
        // Enrich context with latest annotations and edits
        if (this.annotateTab) {
          ctx.screenshotAnnotated = this.annotateTab.getAnnotatedImage();
        }
        if (this.editTab && 'getCssDelta' in this.editTab) {
          ctx.cssDelta = this.editTab.getCssDelta();
        }

        const sessionId = crypto.randomUUID().replace(/-/g, '');
        const outputTab = new OutputTab(this.bodyEl!, ctx, sessionId);
        outputTab.onCopy(() => this.callbacks.onCopy());
        this.currentTabInstance = outputTab;
        break;
      }
      case 'history': {
        if (!this.historyTab) {
          this.historyTab = new HistoryTab(this.bodyEl!, (session: DaubSession) => {
            // Restore a previous session
            this.context = session.elementContext;
            // Reset annotate tab so it picks up the new screenshot
            this.annotateTab = null;
            this.switchTab('annotate');
          });
        } else {
          this.historyTab = new HistoryTab(this.bodyEl!, (session: DaubSession) => {
            this.context = session.elementContext;
            this.annotateTab = null;
            this.switchTab('annotate');
          });
        }
        this.currentTabInstance = this.historyTab;
        break;
      }
    }

    // Mount the tab
    this.currentTabInstance?.mount();

    // Update footer
    this.updateFooterHint(tabId);
    this.updateFooterActions(tabId);

    // Update count badges
    this.updateTabCountBadges();
  }

  // ---- Footer Hints ----

  private updateFooterHint(tabId: TabId): void {
    if (!this.footHint) return;
    this.footHint.innerHTML = '';

    switch (tabId) {
      case 'annotate':
        this.footHint.append(
          this.kbd('P'),
          this.kbd('A'),
          this.kbd('R'),
          this.textNode(' tools \u00b7 '),
          this.kbd('\u2318Z'),
          this.textNode(' undo'),
        );
        break;
      case 'edit':
        this.footHint.append(
          this.kbd('\u2191\u2193'),
          this.textNode(' nudge \u00b7 '),
          this.kbd('\u21E7'),
          this.textNode(' coarse \u00b7 '),
          this.kbd('\u2318R'),
          this.textNode(' reset'),
        );
        break;
      case 'output':
        this.footHint.append(
          this.kbd('\u2318\u21E7C'),
          this.textNode(' copy & close'),
        );
        break;
      case 'history':
        this.footHint.append(
          this.textNode(`${this.historyTab?.getSessionCount() ?? 0} daubs \u00b7 `),
          this.kbd('\u2318K'),
          this.textNode(' search'),
        );
        break;
    }
  }

  private updateFooterActions(tabId: TabId): void {
    if (!this.footActions) return;
    // Hide action buttons on output tab (output has its own copy button)
    this.footActions.style.display = tabId === 'output' ? 'none' : 'flex';
  }

  // ---- Tab Count Badges ----

  private updateTabCountBadges(): void {
    const annotateBadge = this.tabCountBadges.get('annotate');
    if (annotateBadge) {
      const count = this.annotateTab?.getStrokeCount() ?? 0;
      annotateBadge.textContent = String(count);
    }

    const editBadge = this.tabCountBadges.get('edit');
    if (editBadge) {
      let count = 0;
      if (this.editTab && 'getCssDelta' in this.editTab) {
        count = this.editTab.getCssDelta().length;
      }
      editBadge.textContent = String(count);
    }

    const historyBadge = this.tabCountBadges.get('history');
    if (historyBadge) {
      const count = this.historyTab?.getSessionCount() ?? 0;
      historyBadge.textContent = String(count);
    }
  }

  // ---- Action Handlers ----

  private toggleMinimize(): void {
    this.minimized = !this.minimized;
    if (this.el) {
      this.el.classList.toggle('minimized', this.minimized);
    }
  }

  private onDragStart(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (!this.el) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = this.el.getBoundingClientRect();
    const startRight = window.innerWidth - rect.right;
    const startBottom = window.innerHeight - rect.bottom;
    const margin = 16;

    this.el.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      if (!this.el) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const panelW = this.el.offsetWidth;
      const panelH = this.el.offsetHeight;

      let newRight = startRight - dx;
      let newBottom = startBottom - dy;

      // Clamp to viewport with 16px margin
      newRight = Math.max(margin, Math.min(newRight, window.innerWidth - panelW - margin));
      newBottom = Math.max(margin, Math.min(newBottom, window.innerHeight - panelH - margin));

      this.el.style.right = `${newRight}px`;
      this.el.style.bottom = `${newBottom}px`;
    };

    const onUp = () => {
      if (this.el) this.el.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  private onResizeStart(e: PointerEvent, edge: 'top' | 'left' | 'top-left'): void {
    e.preventDefault();
    e.stopPropagation();
    if (!this.el) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = this.el.offsetWidth;
    const startH = this.el.offsetHeight;

    const onMove = (ev: PointerEvent) => {
      if (!this.el) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (edge === 'left' || edge === 'top-left') {
        const newW = Math.max(360, Math.min(startW - dx, window.innerWidth - 32));
        this.el.style.width = `${newW}px`;
      }
      if (edge === 'top' || edge === 'top-left') {
        const newH = Math.max(300, Math.min(startH - dy, window.innerHeight - 32));
        this.el.style.height = `${newH}px`;
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  private handleDiscard(): void {
    // Close the panel entirely
    this.callbacks.onClose();
  }

  private handleHandoff(): void {
    // Enrich context before switching to output
    const ctx = this.context!;
    ctx.screenshotAnnotated = this.annotateTab?.getAnnotatedImage() ?? null;
    if (this.editTab && 'getCssDelta' in this.editTab) {
      ctx.cssDelta = this.editTab.getCssDelta();
    }

    // Switch to output tab
    this.switchTab('output');
  }

  // ---- Helpers ----

  private kbd(text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'kbd';
    span.textContent = text;
    return span;
  }

  private textNode(text: string): Text {
    return document.createTextNode(text);
  }

  private extractPort(): string {
    // Try to extract port from writeEndpoint or fall back to 5173
    try {
      const url = new URL(this.config.writeEndpoint);
      return url.port || '5173';
    } catch {
      return '5173';
    }
  }
}
