export class EditTabStub {
  constructor(private container: HTMLElement) {}

  mount(): void {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--daub-text-muted);font-size:13px;';
    el.textContent = 'Edit tab — coming in Phase 4';
    this.container.appendChild(el);
  }

  unmount(): void {
    this.container.innerHTML = '';
  }

  getCssDelta() { return []; }
  hasEdits() { return false; }
  captureAfterScreenshot(): Promise<string | null> { return Promise.resolve(null); }
  resetEdits(): void {}
}
