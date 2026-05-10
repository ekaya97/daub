import type { DaubConfig, ElementContext } from '@daub/core';
import { CLOSE_ICON, SWAP_ICON, HISTORY_ICON } from './icons.js';
import { AnnotateTab } from './tabs/AnnotateTab.js';
import { EditTab } from './tabs/EditTab.js';
import { OutputTabStub } from './tabs/OutputTabStub.js';

type TabName = 'annotate' | 'edit' | 'output';

interface TabInstance {
  mount(): void;
  unmount(): void;
}

export class Panel {
  private el: HTMLDivElement;
  private tabContent: HTMLDivElement;
  private activeTab: TabName = 'annotate';
  private currentTabInstance: TabInstance | null = null;
  private side: 'left' | 'right' = 'right';
  private context: ElementContext | null = null;

  private annotateTab: AnnotateTab | null = null;
  private editTab: EditTab | null = null;
  private outputTab: OutputTabStub | null = null;

  private liveElement: HTMLElement | null = null;
  private closeHandler: (() => void) | null = null;
  private copyHandler: (() => void) | null = null;

  // Resize state
  private resizing = false;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeUp = this.onResizeUp.bind(this);

  constructor(
    private shadow: ShadowRoot,
    private config: DaubConfig,
  ) {
    this.el = document.createElement('div');
    this.tabContent = document.createElement('div');
  }

  mount(context: ElementContext, liveElement?: HTMLElement): void {
    this.context = context;
    this.liveElement = liveElement ?? null;

    // Determine which side to open on (v2 F1)
    const rect = context.rect;
    const elementCenter = rect.left + rect.width / 2;
    this.side = elementCenter > window.innerWidth * 0.5 ? 'left' : 'right';

    this.buildDOM();

    // Slide in
    this.el.classList.add(this.side === 'right' ? 'slide-out-right' : 'slide-out-left');
    this.shadow.appendChild(this.el);
    // Force reflow then remove slide-out class to trigger animation
    this.el.offsetHeight;
    this.el.classList.remove('slide-out-right', 'slide-out-left');

    // Mount default tab
    this.switchTab('annotate');

    // Restore saved width
    const saved = localStorage.getItem('daub-panel-width');
    if (saved) this.el.style.width = saved;
  }

  unmount(): void {
    // Slide out animation
    this.el.classList.add(this.side === 'right' ? 'slide-out-right' : 'slide-out-left');
    const onEnd = () => {
      this.el.removeEventListener('transitionend', onEnd);
      this.currentTabInstance?.unmount();
      this.currentTabInstance = null;
      this.el.remove();
    };
    this.el.addEventListener('transitionend', onEnd);
    // Fallback if transition doesn't fire
    setTimeout(onEnd, 300);
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  onCopy(handler: () => void): void {
    this.copyHandler = handler;
  }

  getAnnotatedScreenshot(): string | null {
    return this.annotateTab?.getAnnotatedImage() ?? null;
  }

  getNotes(): string {
    return '';
  }

  getActiveTab(): TabName {
    return this.activeTab;
  }

  // ---- Private ----

  private buildDOM(): void {
    const ctx = this.context!;
    this.el.className = `daub-panel ${this.side}`;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Daub component inspector');
    this.el.setAttribute('aria-modal', 'false');

    // Header
    const header = document.createElement('div');
    header.className = 'daub-panel-header';

    const brand = document.createElement('span');
    brand.className = 'daub-panel-brand';
    brand.textContent = 'daub';

    const info = document.createElement('span');
    info.className = 'daub-panel-info';
    const name = ctx.source?.componentName ?? ctx.tagName;
    const file = ctx.source?.file ? `${ctx.source.file.split('/').pop()}:${ctx.source.line}` : '';
    info.textContent = file ? `${name} · ${file}` : name;
    info.title = ctx.source?.file ?? ctx.tagName;

    const swapBtn = document.createElement('button');
    swapBtn.className = 'daub-panel-swap';
    swapBtn.innerHTML = SWAP_ICON;
    swapBtn.setAttribute('aria-label', 'Swap panel side');
    swapBtn.addEventListener('click', () => this.swapSide());

    const closeBtn = document.createElement('button');
    closeBtn.className = 'daub-panel-close';
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.setAttribute('aria-label', 'Close Daub panel');
    closeBtn.addEventListener('click', () => this.closeHandler?.());

    header.append(brand, info, swapBtn, closeBtn);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'daub-tabs';
    tabBar.setAttribute('role', 'tablist');

    const tabs: { name: TabName; label: string }[] = [
      { name: 'annotate', label: 'Annotate' },
      { name: 'edit', label: 'Edit' },
      { name: 'output', label: 'Output' },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'daub-tab';
      btn.textContent = tab.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', tab.name === 'annotate' ? 'true' : 'false');
      btn.setAttribute('aria-controls', `daub-tab-${tab.name}`);
      btn.dataset.tab = tab.name;
      if (tab.name === 'annotate') btn.classList.add('active');
      btn.addEventListener('click', () => this.switchTab(tab.name));
      tabBar.appendChild(btn);
    }

    // Arrow key navigation for tabs (v2 F10)
    tabBar.addEventListener('keydown', (e) => {
      const tabBtns = Array.from(tabBar.querySelectorAll('.daub-tab')) as HTMLButtonElement[];
      const idx = tabBtns.indexOf(e.target as HTMLButtonElement);
      if (idx === -1) return;
      if (e.key === 'ArrowRight') {
        const next = tabBtns[(idx + 1) % tabBtns.length];
        next.focus();
        next.click();
      } else if (e.key === 'ArrowLeft') {
        const prev = tabBtns[(idx - 1 + tabBtns.length) % tabBtns.length];
        prev.focus();
        prev.click();
      }
    });

    // Tab content
    this.tabContent.className = 'daub-tab-content';
    this.tabContent.setAttribute('role', 'tabpanel');

    // Footer
    const footer = document.createElement('div');
    footer.className = 'daub-panel-footer';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'daub-btn-primary';
    copyBtn.textContent = 'Copy to Claude';
    copyBtn.addEventListener('click', () => this.copyHandler?.());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'daub-btn-secondary';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      this.annotateTab = null;
      this.editTab?.resetEdits();
      if (this.activeTab === 'annotate') this.switchTab('annotate');
    });

    footer.append(copyBtn, clearBtn);

    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'daub-resize-handle';
    handle.addEventListener('pointerdown', (e) => this.onResizeDown(e));

    this.el.append(header, tabBar, this.tabContent, footer, handle);
  }

  private switchTab(name: TabName): void {
    this.currentTabInstance?.unmount();
    this.tabContent.innerHTML = '';
    this.activeTab = name;

    // Update tab bar
    const tabs = this.el.querySelectorAll('.daub-tab');
    tabs.forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.tab === name;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    this.tabContent.id = `daub-tab-${name}`;

    const ctx = this.context!;

    switch (name) {
      case 'annotate': {
        if (!this.annotateTab) {
          this.annotateTab = new AnnotateTab(this.tabContent, ctx.screenshotBefore);
        } else {
          this.annotateTab = new AnnotateTab(this.tabContent, ctx.screenshotBefore);
        }
        this.currentTabInstance = this.annotateTab;
        break;
      }
      case 'edit': {
        if (this.liveElement) {
          this.editTab = new EditTab(this.tabContent, this.liveElement);
          this.currentTabInstance = this.editTab;
        }
        break;
      }
      case 'output': {
        this.outputTab = new OutputTabStub(this.tabContent);
        this.currentTabInstance = this.outputTab;
        break;
      }
    }

    this.currentTabInstance?.mount();
  }

  private swapSide(): void {
    this.side = this.side === 'right' ? 'left' : 'right';
    this.el.classList.remove('left', 'right');
    this.el.classList.add(this.side);
  }

  // -- Resize --

  private onResizeDown(e: PointerEvent): void {
    e.preventDefault();
    this.resizing = true;
    document.addEventListener('pointermove', this.boundResizeMove);
    document.addEventListener('pointerup', this.boundResizeUp);
  }

  private onResizeMove(e: PointerEvent): void {
    if (!this.resizing) return;
    const width = this.side === 'right'
      ? window.innerWidth - e.clientX
      : e.clientX;
    const clamped = Math.max(320, Math.min(width, window.innerWidth * 0.8));
    this.el.style.width = `${clamped}px`;
  }

  private onResizeUp(): void {
    this.resizing = false;
    document.removeEventListener('pointermove', this.boundResizeMove);
    document.removeEventListener('pointerup', this.boundResizeUp);
    localStorage.setItem('daub-panel-width', this.el.style.width);
  }
}
