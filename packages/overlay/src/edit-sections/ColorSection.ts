import { createIcon } from '../icons.js';

const SWATCHES = ['#1a1816', '#d97757', '#5a7a8c', '#5b8a4f', '#524e47', '#f6f4ef'];

function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '';
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return '';
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

export class ColorSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private section: HTMLElement | null = null;

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const computed = getComputedStyle(this.element);

    this.section = document.createElement('div');
    this.section.className = 'daub-edit-section';

    // Header
    const head = document.createElement('div');
    head.className = 'daub-edit-section-head';

    const titleSpan = document.createElement('span');
    titleSpan.appendChild(createIcon('palette', 10));
    titleSpan.appendChild(document.createTextNode('Color'));
    head.appendChild(titleSpan);

    const dot = document.createElement('i');
    dot.className = 'daub-edit-section-dot';
    dot.style.display = 'none';
    head.appendChild(dot);

    this.section.appendChild(head);

    const initialBg = computed.backgroundColor;
    const initialFg = computed.color;
    const initialBorderColor = computed.borderColor;
    const initialBorderWidth = parseFloat(computed.borderWidth) || 0;

    const checkChanged = () => {
      const c = getComputedStyle(this.element);
      const curBorderWidth = parseFloat(c.borderWidth) || 0;
      const changed =
        c.backgroundColor !== initialBg ||
        c.color !== initialFg ||
        c.borderColor !== initialBorderColor ||
        curBorderWidth !== initialBorderWidth;
      dot.style.display = changed ? '' : 'none';
    };

    // Row 1: BG
    this.buildSwatchRow('BG', 'backgroundColor', computed.backgroundColor, () => {
      checkChanged();
      this.editHandler?.();
    });

    // Row 2: FG
    this.buildSwatchRow('FG', 'color', computed.color, () => {
      checkChanged();
      this.editHandler?.();
    });

    // Row 3: Border
    this.buildBorderRow(computed, checkChanged);

    this.container.appendChild(this.section);
  }

  unmount(): void {
    if (this.section) {
      this.section.remove();
      this.section = null;
    }
    this.editHandler = null;
  }

  private buildSwatchRow(
    label: string,
    cssProp: string,
    currentValue: string,
    onChange: () => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';
    row.style.gridTemplateColumns = '60px 1fr';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = label;

    const swatchRow = document.createElement('div');
    swatchRow.className = 'daub-edit-swatch-row';

    const currentHex = rgbToHex(currentValue).toLowerCase();
    const buttons: HTMLButtonElement[] = [];

    for (const color of SWATCHES) {
      const btn = document.createElement('button');
      btn.className = 'daub-edit-swatch';
      btn.style.background = color;

      if (color.toLowerCase() === currentHex) {
        btn.setAttribute('data-active', 'true');
      }

      btn.addEventListener('click', () => {
        for (const b of buttons) b.removeAttribute('data-active');
        btn.setAttribute('data-active', 'true');
        this.element.style[cssProp as any] = color;
        onChange();
      });

      buttons.push(btn);
      swatchRow.appendChild(btn);
    }

    row.append(lbl, swatchRow);
    this.section!.appendChild(row);
  }

  private buildBorderRow(
    computed: CSSStyleDeclaration,
    checkChanged: () => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';
    row.style.gridTemplateColumns = '60px 1fr';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = 'Border';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '6px';

    // Swatch row for border color
    const swatchRow = document.createElement('div');
    swatchRow.className = 'daub-edit-swatch-row';

    const currentHex = rgbToHex(computed.borderColor).toLowerCase();
    const buttons: HTMLButtonElement[] = [];

    for (const color of SWATCHES) {
      const btn = document.createElement('button');
      btn.className = 'daub-edit-swatch';
      btn.style.background = color;

      if (color.toLowerCase() === currentHex) {
        btn.setAttribute('data-active', 'true');
      }

      btn.addEventListener('click', () => {
        for (const b of buttons) b.removeAttribute('data-active');
        btn.setAttribute('data-active', 'true');
        this.element.style.borderColor = color;
        if (getComputedStyle(this.element).borderStyle === 'none') {
          this.element.style.borderStyle = 'solid';
        }
        checkChanged();
        this.editHandler?.();
      });

      buttons.push(btn);
      swatchRow.appendChild(btn);
    }

    wrapper.appendChild(swatchRow);

    // Small slider for border width
    const sliderWrap = document.createElement('div');
    sliderWrap.style.display = 'flex';
    sliderWrap.style.alignItems = 'center';
    sliderWrap.style.gap = '6px';

    const initialWidth = parseFloat(computed.borderWidth) || 0;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'daub-slider';
    slider.min = '0';
    slider.max = '4';
    slider.step = '0.5';
    slider.value = String(initialWidth);
    slider.style.flex = '1';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'daub-edit-row-value';
    valueDisplay.textContent = initialWidth + 'px';
    valueDisplay.style.minWidth = '32px';
    valueDisplay.style.textAlign = 'right';

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      valueDisplay.textContent = val + 'px';
      this.element.style.borderWidth = val + 'px';
      if (val > 0 && getComputedStyle(this.element).borderStyle === 'none') {
        this.element.style.borderStyle = 'solid';
      }
      const changed = val !== initialWidth;
      slider.classList.toggle('changed', changed);
      valueDisplay.classList.toggle('changed', changed);
      checkChanged();
      this.editHandler?.();
    });

    sliderWrap.append(slider, valueDisplay);
    wrapper.appendChild(sliderWrap);

    row.append(lbl, wrapper);
    this.section!.appendChild(row);
  }
}
