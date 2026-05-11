import { createIcon } from '../icons.js';

export class TypographySection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private section: HTMLElement | null = null;

  private initialSize = 16;
  private initialWeight = 400;
  private initialLineHeight = 1.5;
  private initialLetterSpacing = 0;

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const computed = getComputedStyle(this.element);
    this.initialSize = parseInt(computed.fontSize, 10) || 16;
    this.initialWeight = Math.round((parseInt(computed.fontWeight, 10) || 400) / 100) * 100;

    const parsedLH = parseFloat(computed.lineHeight) / parseFloat(computed.fontSize);
    this.initialLineHeight = isNaN(parsedLH) ? 1.5 : Math.round(parsedLH * 10) / 10;

    const parsedLS = parseFloat(computed.letterSpacing);
    this.initialLetterSpacing = isNaN(parsedLS) ? 0 : parsedLS;

    this.section = document.createElement('div');
    this.section.className = 'daub-edit-section';

    // Header
    const head = document.createElement('div');
    head.className = 'daub-edit-section-head';

    const titleSpan = document.createElement('span');
    titleSpan.appendChild(createIcon('type', 10));
    titleSpan.appendChild(document.createTextNode('Typography'));
    head.appendChild(titleSpan);

    const dot = document.createElement('i');
    dot.className = 'daub-edit-section-dot';
    dot.style.display = 'none';
    head.appendChild(dot);

    this.section.appendChild(head);

    const checkChanged = () => {
      const c = getComputedStyle(this.element);
      const curSize = parseInt(c.fontSize, 10) || 16;
      const curWeight = Math.round((parseInt(c.fontWeight, 10) || 400) / 100) * 100;
      const curLH = parseFloat(c.lineHeight) / parseFloat(c.fontSize);
      const curLineHeight = isNaN(curLH) ? 1.5 : Math.round(curLH * 10) / 10;
      const curLS = parseFloat(c.letterSpacing);
      const curLetterSpacing = isNaN(curLS) ? 0 : curLS;
      const changed =
        curSize !== this.initialSize ||
        curWeight !== this.initialWeight ||
        curLineHeight !== this.initialLineHeight ||
        curLetterSpacing !== this.initialLetterSpacing;
      dot.style.display = changed ? '' : 'none';
    };

    // Row 1: Size (slider)
    this.buildSliderRow('Size', this.initialSize, 8, 48, 1, 'px', (val) => {
      this.element.style.fontSize = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Row 2: Weight (segmented control)
    this.buildWeightRow(checkChanged);

    // Row 3: Line H (slider)
    this.buildSliderRow('Line H', this.initialLineHeight, 0.8, 3.0, 0.1, '', (val) => {
      this.element.style.lineHeight = String(val);
      checkChanged();
      this.editHandler?.();
    });

    // Row 4: Spacing (slider)
    this.buildSliderRow('Spacing', this.initialLetterSpacing, -2, 8, 0.5, 'px', (val) => {
      this.element.style.letterSpacing = val + 'px';
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

  private buildSliderRow(
    label: string,
    initial: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (val: number) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'daub-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initial);

    const formatValue = (v: number): string => {
      const display = step < 1 ? v.toFixed(1) : String(v);
      return unit ? display + unit : display;
    };

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'daub-edit-row-value';
    valueDisplay.textContent = formatValue(initial);

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      valueDisplay.textContent = formatValue(val);
      const changed = val !== initial;
      slider.classList.toggle('changed', changed);
      valueDisplay.classList.toggle('changed', changed);
      onChange(val);
    });

    row.append(lbl, slider, valueDisplay);
    this.section!.appendChild(row);
  }

  private buildWeightRow(checkChanged: () => void): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = 'Weight';

    const seg = document.createElement('div');
    seg.className = 'daub-edit-seg';
    seg.style.gridColumn = '2 / -1';

    const weights = [400, 500, 600, 700];
    const buttons: HTMLButtonElement[] = [];

    for (const w of weights) {
      const btn = document.createElement('button');
      btn.className = 'daub-edit-seg-btn';
      btn.textContent = String(w);
      if (w === this.initialWeight) {
        btn.setAttribute('data-active', 'true');
      }

      btn.addEventListener('click', () => {
        for (const b of buttons) b.removeAttribute('data-active');
        btn.setAttribute('data-active', 'true');
        this.element.style.fontWeight = String(w);
        checkChanged();
        this.editHandler?.();
      });

      buttons.push(btn);
      seg.appendChild(btn);
    }

    row.append(lbl, seg);
    this.section!.appendChild(row);
  }
}
