const INPUT_STYLE =
  'background:var(--daub-bg-surface);color:var(--daub-text);border:1px solid var(--daub-border);border-radius:4px;padding:4px 6px;font-size:12px;font-family:ui-monospace,monospace;';

const HEADER_STYLE =
  'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;cursor:pointer;';

const LABEL_STYLE =
  'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;';

const WEIGHT_NAMES: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semi Bold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Black',
};

export class TypographySection {
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
    header.textContent = 'Typography';
    this.wrapper.appendChild(header);

    const computed = getComputedStyle(this.element);

    this.buildSliderRow('Size', 'fontSize', parseFloat(computed.fontSize) || 16, 8, 72, 1, 'px');
    this.buildWeightRow(computed);
    this.buildSliderRow(
      'Line Height',
      'lineHeight',
      computed.lineHeight === 'normal' ? 1.5 : parseFloat(computed.lineHeight) / (parseFloat(computed.fontSize) || 16),
      0.5,
      4.0,
      0.1,
      '',
    );
    this.buildSliderRow(
      'Spacing',
      'letterSpacing',
      computed.letterSpacing === 'normal' ? 0 : parseFloat(computed.letterSpacing),
      -2,
      10,
      0.5,
      'px',
    );
    this.buildAlignRow(computed);

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

  private buildSliderRow(
    label: string,
    cssProp: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    unit: string,
  ): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = LABEL_STYLE;
    lbl.textContent = label;

    const controlRow = document.createElement('div');
    controlRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initialValue);
    slider.style.cssText = 'flex:1;accent-color:var(--daub-accent);';

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = String(min);
    numInput.max = String(max);
    numInput.step = String(step);
    numInput.value = String(initialValue);
    numInput.style.cssText = INPUT_STYLE + 'width:60px;';

    const apply = (val: string) => {
      const applyValue = cssProp === 'lineHeight' && unit === ''
        ? val
        : val + unit;
      this.element.style[cssProp as any] = applyValue;
      this.editHandler?.();
    };

    slider.addEventListener('input', () => {
      numInput.value = slider.value;
      apply(slider.value);
    });

    numInput.addEventListener('input', () => {
      slider.value = numInput.value;
      apply(numInput.value);
    });

    controlRow.append(slider, numInput);
    row.append(lbl, controlRow);
    this.wrapper!.appendChild(row);
  }

  private buildWeightRow(computed: CSSStyleDeclaration): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = LABEL_STYLE;
    lbl.textContent = 'Weight';

    const controlRow = document.createElement('div');
    controlRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const initialWeight = parseInt(computed.fontWeight, 10) || 400;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '100';
    slider.max = '900';
    slider.step = '100';
    slider.value = String(initialWeight);
    slider.style.cssText = 'flex:1;accent-color:var(--daub-accent);';

    const display = document.createElement('span');
    display.style.cssText =
      'font-size:12px;color:var(--daub-text);white-space:nowrap;min-width:100px;';
    display.textContent = `${initialWeight} (${WEIGHT_NAMES[String(initialWeight)] || ''})`;

    slider.addEventListener('input', () => {
      const w = slider.value;
      const name = WEIGHT_NAMES[w] || '';
      display.textContent = `${w} (${name})`;
      this.element.style.fontWeight = w;
      this.editHandler?.();
    });

    controlRow.append(slider, display);
    row.append(lbl, controlRow);
    this.wrapper!.appendChild(row);
  }

  private buildAlignRow(computed: CSSStyleDeclaration): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = LABEL_STYLE;
    lbl.textContent = 'Text Align';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:4px;';

    const alignments: Array<{ value: string; label: string }> = [
      { value: 'left', label: 'L' },
      { value: 'center', label: 'C' },
      { value: 'right', label: 'R' },
      { value: 'justify', label: 'J' },
    ];

    const currentAlign = computed.textAlign || 'left';
    // Normalize: 'start' -> 'left', 'end' -> 'right'
    const normalizedAlign =
      currentAlign === 'start' ? 'left' : currentAlign === 'end' ? 'right' : currentAlign;

    const buttons: HTMLButtonElement[] = [];

    for (const align of alignments) {
      const btn = document.createElement('button');
      btn.textContent = align.label;
      btn.style.cssText =
        'padding:4px 10px;border:1px solid var(--daub-border);border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;';

      if (align.value === normalizedAlign) {
        btn.style.background = 'var(--daub-bg-surface)';
        btn.style.color = 'var(--daub-accent)';
      } else {
        btn.style.background = 'none';
        btn.style.color = 'var(--daub-text-muted)';
      }

      btn.addEventListener('click', () => {
        this.element.style.textAlign = align.value;
        for (const b of buttons) {
          b.style.background = 'none';
          b.style.color = 'var(--daub-text-muted)';
        }
        btn.style.background = 'var(--daub-bg-surface)';
        btn.style.color = 'var(--daub-accent)';
        this.editHandler?.();
      });

      buttons.push(btn);
      btnGroup.appendChild(btn);
    }

    row.append(lbl, btnGroup);
    this.wrapper!.appendChild(row);
  }
}
