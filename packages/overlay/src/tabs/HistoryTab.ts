import type { DaubSession } from '@daub/core';
import { CLOSE_ICON } from '../icons.js';
import { getSessions, deleteSession, clearHistory } from '../history.js';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export class HistoryTab {
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

  private async render(): Promise<void> {
    this.container.innerHTML = '';

    const sessions = await getSessions();

    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100%;color:var(--daub-text-muted);font-size:13px;';
      empty.textContent = 'No captures yet';
      this.container.appendChild(empty);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display:flex;flex-direction:column;gap:12px;height:100%;overflow-y:auto;padding:4px 0;';

    // Card grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

    for (const session of sessions) {
      const card = document.createElement('div');
      card.style.cssText =
        'position:relative;cursor:pointer;padding:8px;border-radius:6px;background:var(--daub-bg-surface);border:1px solid var(--daub-border);';

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--daub-accent)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'var(--daub-border)';
      });

      // Click card to restore
      card.addEventListener('click', () => {
        this.onRestore(session);
      });

      // Thumbnail
      const img = document.createElement('img');
      img.src = session.elementContext.screenshotBefore;
      img.style.cssText =
        'display:block;max-width:160px;height:100px;object-fit:cover;border-radius:4px;border:1px solid var(--daub-border);';
      card.appendChild(img);

      // Component name
      const name = document.createElement('div');
      name.style.cssText =
        'font-size:12px;font-weight:600;color:var(--daub-text);margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      name.textContent =
        session.elementContext.source?.componentName ??
        session.elementContext.tagName;
      card.appendChild(name);

      // Timestamp
      const time = document.createElement('div');
      time.style.cssText = 'font-size:11px;color:var(--daub-text-muted);';
      time.textContent = timeAgo(session.elementContext.capturedAt);
      card.appendChild(time);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.style.cssText =
        'position:absolute;top:4px;right:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:var(--daub-bg-surface);border:1px solid var(--daub-border);border-radius:4px;cursor:pointer;color:var(--daub-text-muted);padding:0;';
      deleteBtn.innerHTML = CLOSE_ICON;
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteSession(session.id);
        this.render();
      });
      card.appendChild(deleteBtn);

      grid.appendChild(card);
    }

    wrapper.appendChild(grid);

    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.style.cssText =
      'background:none;border:none;cursor:pointer;font-size:12px;color:var(--daub-danger);padding:4px 0;align-self:flex-start;';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', async () => {
      await clearHistory();
      this.render();
    });
    wrapper.appendChild(clearBtn);

    this.container.appendChild(wrapper);
  }
}
