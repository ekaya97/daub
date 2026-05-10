const HEADER_STYLE =
  'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;cursor:pointer;';

const SELECT_STYLE =
  'width:100%;background:var(--daub-bg-surface);color:var(--daub-text);border:1px solid var(--daub-border);border-radius:4px;padding:6px 8px;font-size:12px;';

export class OverflowSection {
  private wrapper: HTMLDivElement | null = null;
  private editHandler: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    private element: HTMLElement,
  ) {}

  mount(): void {
    this.wrapper = document.createElement('div');
    this.wrapper.style.marginBottom = '16px';

    const header = document.createElement('div');
    header.style.cssText = HEADER_STYLE;
    header.textContent = 'Overflow';
    this.wrapper.appendChild(header);

    const computed = getComputedStyle(this.element);

    const select = document.createElement('select');
    select.style.cssText = SELECT_STYLE;

    const options = ['visible', 'hidden', 'scroll', 'auto'];
    const currentValue = computed.overflow || 'visible';

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (currentValue.includes(opt)) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.element.style.overflow = select.value;
      this.editHandler?.();
    });

    this.wrapper.appendChild(select);
    this.container.appendChild(this.wrapper);
  }

  unmount(): void {
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
    }
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }
}
