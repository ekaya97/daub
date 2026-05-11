import { createIcon } from '../icons.js';

export class SizeSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private section: HTMLElement | null = null;

  private initialWidth = '';
  private initialHeight = '';

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const computed = getComputedStyle(this.element);
    this.initialWidth = computed.width;
    this.initialHeight = computed.height;

    this.section = document.createElement('div');
    this.section.className = 'daub-edit-section';

    // Header
    const head = document.createElement('div');
    head.className = 'daub-edit-section-head';

    const titleSpan = document.createElement('span');
    titleSpan.appendChild(createIcon('spacing', 10));
    titleSpan.appendChild(document.createTextNode('Size'));
    head.appendChild(titleSpan);

    const dot = document.createElement('i');
    dot.className = 'daub-edit-section-dot';
    dot.style.display = 'none';
    head.appendChild(dot);

    this.section.appendChild(head);

    const checkChanged = () => {
      const c = getComputedStyle(this.element);
      const changed =
        c.width !== this.initialWidth ||
        c.height !== this.initialHeight;
      dot.style.display = changed ? '' : 'none';
    };

    // Row 1: Width
    this.buildTextInputRow('Width', computed.width, (val) => {
      this.element.style.width = val;
      checkChanged();
      this.editHandler?.();
    });

    // Row 2: Height
    this.buildTextInputRow('Height', computed.height, (val) => {
      this.element.style.height = val;
      checkChanged();
      this.editHandler?.();
    });

    this.container.appendChild(this.section);
  }

  unmount(): void {
    if (this.section) {
      this.section.remove();
      this.section = null;
    }
    this.editHandler = null;
  }

  private buildTextInputRow(
    label: string,
    initial: string,
    onChange: (val: string) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial;
    input.style.cssText =
      'appearance:none;background:var(--w-bg-2);border:1px solid var(--w-line);' +
      'color:var(--w-ink);font-family:var(--font-mono);font-size:11px;' +
      'padding:3px 6px;border-radius:4px;width:100%;outline:0;';

    input.addEventListener('focus', () => {
      input.style.borderColor = 'var(--w-accent)';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = 'var(--w-line)';
      onChange(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onChange(input.value);
        input.blur();
      }
    });

    // Empty span to fill the 3rd grid column
    const spacer = document.createElement('span');

    row.append(lbl, input, spacer);
    this.section!.appendChild(row);
  }
}
