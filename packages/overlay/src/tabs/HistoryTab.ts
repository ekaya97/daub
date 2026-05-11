import { createIcon } from '../icons.js';
import { getSessions, deleteSession, clearHistory } from '../history.js';
import type { DaubSession } from '@daub/core';

export class HistoryTab {
  private sessions: DaubSession[] = [];
  private listEl: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;

  constructor(
    private container: HTMLElement,
    private onRestore: (session: DaubSession) => void,
  ) {}

  mount(): void {
    this.render();
  }

  unmount(): void {
    this.container.innerHTML = '';
  }

  getSessionCount(): number {
    return this.sessions.length;
  }

  private async render(): Promise<void> {
    this.container.innerHTML = '';

    this.sessions = await getSessions();

    const root = document.createElement('div');
    root.className = 'daub-history';

    // --- Filter bar ---
    const filterBar = document.createElement('div');
    filterBar.className = 'daub-history-filter';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'daub-history-search';
    searchWrap.appendChild(createIcon('search', 11));

    this.searchInput = document.createElement('input');
    this.searchInput.placeholder = 'search by file, target, or note\u2026';
    this.searchInput.addEventListener('input', () => this.filterList());
    searchWrap.appendChild(this.searchInput);

    filterBar.appendChild(searchWrap);

    const allBtn = document.createElement('button');
    allBtn.className = 'daub-btn daub-btn-ghost';
    allBtn.style.cssText = 'padding:4px 8px;font-size:11px';
    allBtn.textContent = 'all';
    allBtn.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.filterList();
      }
    });
    filterBar.appendChild(allBtn);

    root.appendChild(filterBar);

    // --- List ---
    this.listEl = document.createElement('div');
    this.listEl.className = 'daub-history-list';

    this.renderItems(this.sessions);

    root.appendChild(this.listEl);
    this.container.appendChild(root);
  }

  private filterList(): void {
    if (!this.listEl || !this.searchInput) return;
    const query = this.searchInput.value.trim().toLowerCase();
    if (!query) {
      this.renderItems(this.sessions);
      return;
    }
    const filtered = this.sessions.filter((s) => {
      const componentName = s.elementContext.source?.componentName ?? '';
      const file = s.elementContext.source?.file ?? '';
      const tagName = s.elementContext.tagName ?? '';
      const notes = s.elementContext.notes ?? '';
      const haystack = `${componentName} ${file} ${tagName} ${notes}`.toLowerCase();
      return haystack.includes(query);
    });
    this.renderItems(filtered);
  }

  private renderItems(items: DaubSession[]): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'display:flex;align-items:center;justify-content:center;padding:32px 0;color:var(--w-ink-3);font-size:12px;';
      empty.textContent = this.sessions.length === 0 ? 'No captures yet' : 'No matches';
      this.listEl.appendChild(empty);
      return;
    }

    for (const session of items) {
      const item = document.createElement('div');
      item.className = 'daub-history-item';
      item.addEventListener('click', () => this.onRestore(session));

      // Thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'daub-history-thumb';
      this.renderThumb(thumb, session);
      item.appendChild(thumb);

      // Body
      const body = document.createElement('div');
      body.className = 'daub-history-body';

      const title = document.createElement('div');
      title.className = 'daub-history-title';
      const componentName = session.elementContext.source?.componentName ?? session.elementContext.tagName;
      const notes = session.elementContext.notes;
      title.textContent = notes
        ? `${componentName} \u2014 ${notes}`
        : componentName;
      body.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'daub-history-meta';

      const sourceFile = session.elementContext.source?.file ?? session.elementContext.domPath;
      const fileSpan = document.createElement('span');
      fileSpan.textContent = sourceFile;
      meta.appendChild(fileSpan);

      const dot = document.createElement('span');
      dot.className = 'dot';
      meta.appendChild(dot);

      const timeSpan = document.createElement('span');
      timeSpan.textContent = this.timeAgo(session.elementContext.capturedAt);
      meta.appendChild(timeSpan);

      body.appendChild(meta);
      item.appendChild(body);

      // Side
      const side = document.createElement('div');
      side.className = 'daub-history-side';

      const status = document.createElement('span');
      status.className = 'daub-history-status';
      status.textContent = '\u2713 saved';
      side.appendChild(status);

      item.appendChild(side);
      this.listEl.appendChild(item);
    }
  }

  private renderThumb(container: HTMLDivElement, session: DaubSession): void {
    const delta = session.elementContext.cssDelta;
    const barCount = Math.max(3, Math.min(6, delta.length || 3));
    const accentColor = 'var(--w-accent)';

    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      const heightPercent = 30 + Math.random() * 50;
      let color: string;
      if (delta.length > 0 && i < delta.length) {
        // Use a hash of the property name to pick a hue variation
        const hash = delta[i].property.length * 37 + i * 53;
        const hue = hash % 360;
        color = `oklch(0.65 0.12 ${hue})`;
      } else {
        color = accentColor;
      }
      bar.style.cssText = `width:4px;height:${heightPercent}%;border-radius:2px;background:${color};opacity:0.7;`;
      container.appendChild(bar);
    }
  }

  private timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }
}
