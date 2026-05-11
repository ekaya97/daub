export class EditTabStub {
  constructor(private container: HTMLElement) {}

  mount(): void {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#6f6a5b;font-size:13px;background:#16140f;border:1px solid #2e2a22;border-radius:6px;margin:8px;';
    el.textContent = 'Select an element to start editing';
    this.container.appendChild(el);
  }

  unmount(): void {
    this.container.innerHTML = '';
  }

  getCssDelta() { return []; }
  getChangeCount() { return 0; }
  onEdit(_handler: () => void): void {}
}
