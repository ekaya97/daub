export class OutputTabStub {
  constructor(private container: HTMLElement) {}

  mount(): void {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--daub-text-muted);font-size:13px;';
    el.textContent = 'Output tab — coming in Phase 5';
    this.container.appendChild(el);
  }

  unmount(): void {
    this.container.innerHTML = '';
  }

  getNotes() { return ''; }
  getMarkdown() { return ''; }
  updateContext(): void {}
}
