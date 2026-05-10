const INPUT_STYLE =
  'background:var(--daub-bg-surface);color:var(--daub-text);border:1px solid var(--daub-border);border-radius:4px;padding:4px 6px;font-size:12px;font-family:ui-monospace,monospace;';

const HEADER_STYLE =
  'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;cursor:pointer;';

function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';

  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return '#000000';

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

function isTransparent(rgb: string): boolean {
  if (!rgb || rgb === 'transparent') return true;
  const match = rgb.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) === 0 : false;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export class ColorsSection {
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
    header.textContent = 'Colors';
    this.wrapper.appendChild(header);

    const computed = getComputedStyle(this.element);

    this.buildColorRow('Background', 'backgroundColor', computed.backgroundColor);
    this.buildColorRow('Text', 'color', computed.color);
    this.buildBorderRow(computed);

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

  private buildColorRow(label: string, cssProp: string, initialValue: string): void {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-bottom:8px;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;color:var(--daub-text-muted);width:80px;flex-shrink:0;';
    lbl.textContent = label;

    const hex = isTransparent(initialValue) ? '#000000' : rgbToHex(initialValue);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = hex;
    colorInput.style.cssText =
      'width:28px;height:28px;border-radius:4px;border:1px solid var(--daub-border);padding:0;cursor:pointer;background:none;';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = hex;
    textInput.style.cssText = INPUT_STYLE + 'width:80px;';

    colorInput.addEventListener('input', () => {
      const val = colorInput.value;
      textInput.value = val;
      this.element.style.setProperty(cssProp === 'backgroundColor' ? 'background-color' : cssProp, val);
      this.editHandler?.();
    });

    const applyTextValue = () => {
      let val = textInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        colorInput.value = val;
        this.element.style.setProperty(cssProp === 'backgroundColor' ? 'background-color' : cssProp, val);
        this.editHandler?.();
      }
    };

    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyTextValue();
    });
    textInput.addEventListener('blur', () => applyTextValue());

    row.append(lbl, colorInput, textInput);
    this.wrapper!.appendChild(row);
  }

  private buildBorderRow(computed: CSSStyleDeclaration): void {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;color:var(--daub-text-muted);width:80px;flex-shrink:0;';
    lbl.textContent = 'Border';

    const borderColorRaw = computed.borderColor;
    const hex = isTransparent(borderColorRaw) ? '#000000' : rgbToHex(borderColorRaw);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = hex;
    colorInput.style.cssText =
      'width:28px;height:28px;border-radius:4px;border:1px solid var(--daub-border);padding:0;cursor:pointer;background:none;';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = hex;
    textInput.style.cssText = INPUT_STYLE + 'width:80px;';

    const widthInput = document.createElement('input');
    widthInput.type = 'text';
    widthInput.value = computed.borderWidth || '0px';
    widthInput.style.cssText = INPUT_STYLE + 'width:50px;';
    widthInput.placeholder = '1px';

    const styleSelect = document.createElement('select');
    styleSelect.style.cssText = INPUT_STYLE;
    const borderStyles = ['none', 'solid', 'dashed', 'dotted', 'double'];
    for (const s of borderStyles) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === computed.borderStyle) opt.selected = true;
      styleSelect.appendChild(opt);
    }

    // Color input change
    colorInput.addEventListener('input', () => {
      const val = colorInput.value;
      textInput.value = val;
      this.element.style.setProperty('border-color', val);
      this.editHandler?.();
    });

    // Text input change
    const applyTextValue = () => {
      let val = textInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        colorInput.value = val;
        this.element.style.setProperty('border-color', val);
        this.editHandler?.();
      }
    };

    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyTextValue();
    });
    textInput.addEventListener('blur', () => applyTextValue());

    // Width input change
    const applyWidth = () => {
      this.element.style.setProperty('border-width', widthInput.value.trim());
      this.editHandler?.();
    };
    widthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyWidth();
    });
    widthInput.addEventListener('blur', () => applyWidth());

    // Style select change
    styleSelect.addEventListener('change', () => {
      this.element.style.setProperty('border-style', styleSelect.value);
      this.editHandler?.();
    });

    row.append(lbl, colorInput, textInput, widthInput, styleSelect);
    this.wrapper!.appendChild(row);
  }
}
