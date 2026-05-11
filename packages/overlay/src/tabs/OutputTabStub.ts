export class OutputTabStub {
  constructor(private container: HTMLElement) {}

  mount(): void {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#6f6a5b;font-size:13px;background:#16140f;border:1px solid #2e2a22;border-radius:6px;margin:8px;';
    el.textContent = 'Capture an element to generate output';
    this.container.appendChild(el);
  }

  unmount(): void {
    this.container.innerHTML = '';
  }

  onCopy(_handler: () => void): void {}
  updateContext(): void {}
}
