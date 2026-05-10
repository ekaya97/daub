export class BoxModelSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private els: HTMLElement[] = [];

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const section = document.createElement('div');
    section.style.marginBottom = '16px';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    header.textContent = 'Box Model';
    section.appendChild(header);

    const computed = getComputedStyle(this.element);

    // Box model visual
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;border:1px solid var(--daub-border);border-radius:6px;padding:8px;background:var(--daub-bg-surface);';

    // Margin row
    const marginRow = this.createRow('Margin', [
      { prop: 'marginTop', value: computed.marginTop },
      { prop: 'marginRight', value: computed.marginRight },
      { prop: 'marginBottom', value: computed.marginBottom },
      { prop: 'marginLeft', value: computed.marginLeft },
    ], 'M');
    box.appendChild(marginRow);

    // Padding row
    const paddingRow = this.createRow('Padding', [
      { prop: 'paddingTop', value: computed.paddingTop },
      { prop: 'paddingRight', value: computed.paddingRight },
      { prop: 'paddingBottom', value: computed.paddingBottom },
      { prop: 'paddingLeft', value: computed.paddingLeft },
    ], 'P');
    box.appendChild(paddingRow);

    // Width x Height
    const dimRow = document.createElement('div');
    dimRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;';

    const wLabel = document.createElement('span');
    wLabel.style.cssText = 'font-size:11px;color:var(--daub-text-muted);';
    wLabel.textContent = 'W';

    const wInput = this.createInput(computed.width, (val) => {
      this.element.style.width = this.appendUnit(val);
      this.editHandler?.();
    });

    const xLabel = document.createElement('span');
    xLabel.style.cssText = 'font-size:11px;color:var(--daub-text-muted);';
    xLabel.textContent = '×';

    const hLabel = document.createElement('span');
    hLabel.style.cssText = 'font-size:11px;color:var(--daub-text-muted);';
    hLabel.textContent = 'H';

    const hInput = this.createInput(computed.height, (val) => {
      this.element.style.height = this.appendUnit(val);
      this.editHandler?.();
    });

    dimRow.append(wLabel, wInput, xLabel, hLabel, hInput);
    box.appendChild(dimRow);

    section.appendChild(box);
    this.container.appendChild(section);
  }

  unmount(): void {
    for (const el of this.els) el.remove();
    this.els = [];
  }

  private createRow(
    _label: string,
    fields: { prop: string; value: string }[],
    prefix: string,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
    this.els.push(row);

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:11px;color:var(--daub-text-muted);width:14px;';
    lbl.textContent = prefix;
    row.appendChild(lbl);

    for (const field of fields) {
      const input = this.createInput(field.value, (val) => {
        this.element.style[field.prop as any] = this.appendUnit(val);
        this.editHandler?.();
      });
      row.appendChild(input);
    }

    return row;
  }

  private createInput(initialValue: string, onChange: (val: string) => void): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = parseFloat(initialValue) ? String(Math.round(parseFloat(initialValue))) : initialValue;
    input.style.cssText = `
      width:44px; background:var(--daub-bg); color:var(--daub-text); border:1px solid var(--daub-border);
      border-radius:4px; padding:2px 4px; font-size:11px; font-family:ui-monospace,monospace;
      text-align:center; outline:none;
    `;

    input.addEventListener('focus', () => input.select());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
        return;
      }
      const numeric = parseFloat(input.value);
      if (isNaN(numeric)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        input.value = String(numeric + step);
        onChange(input.value);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        input.value = String(numeric - step);
        onChange(input.value);
      }
    });

    input.addEventListener('blur', () => {
      onChange(input.value);
    });

    this.els.push(input);
    return input;
  }

  private appendUnit(val: string): string {
    // Don't append px for auto, %, calc, etc.
    if (/^-?\d+(\.\d+)?$/.test(val.trim())) {
      return val.trim() + 'px';
    }
    return val.trim();
  }
}
