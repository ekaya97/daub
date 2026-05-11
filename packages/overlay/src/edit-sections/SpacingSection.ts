import { createIcon } from '../icons.js';

export class SpacingSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private section: HTMLElement | null = null;

  private initialPadY = 0;
  private initialPadX = 0;
  private initialMarginY = 0;
  private initialMarginX = 0;
  private initialRadius = 0;

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const computed = getComputedStyle(this.element);
    this.initialPadY = parseInt(computed.paddingTop, 10) || 0;
    this.initialPadX = parseInt(computed.paddingLeft, 10) || 0;
    this.initialMarginY = parseInt(computed.marginTop, 10) || 0;
    this.initialMarginX = parseInt(computed.marginLeft, 10) || 0;
    this.initialRadius = parseInt(computed.borderRadius, 10) || 0;

    this.section = document.createElement('div');
    this.section.className = 'daub-edit-section';

    // Header
    const head = document.createElement('div');
    head.className = 'daub-edit-section-head';

    const titleSpan = document.createElement('span');
    titleSpan.appendChild(createIcon('spacing', 10));
    titleSpan.appendChild(document.createTextNode('Spacing'));
    head.appendChild(titleSpan);

    const dot = document.createElement('i');
    dot.className = 'daub-edit-section-dot';
    dot.style.display = 'none';
    head.appendChild(dot);

    this.section.appendChild(head);

    const checkChanged = () => {
      const c = getComputedStyle(this.element);
      const curPadY = parseInt(c.paddingTop, 10) || 0;
      const curPadX = parseInt(c.paddingLeft, 10) || 0;
      const curMarginY = parseInt(c.marginTop, 10) || 0;
      const curMarginX = parseInt(c.marginLeft, 10) || 0;
      const curRadius = parseInt(c.borderRadius, 10) || 0;
      const changed =
        curPadY !== this.initialPadY ||
        curPadX !== this.initialPadX ||
        curMarginY !== this.initialMarginY ||
        curMarginX !== this.initialMarginX ||
        curRadius !== this.initialRadius;
      dot.style.display = changed ? '' : 'none';
    };

    // Row 1: Pad Y
    this.buildSliderRow('Pad Y', this.initialPadY, 0, 48, (val) => {
      this.element.style.paddingTop = val + 'px';
      this.element.style.paddingBottom = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Row 2: Pad X
    this.buildSliderRow('Pad X', this.initialPadX, 0, 48, (val) => {
      this.element.style.paddingLeft = val + 'px';
      this.element.style.paddingRight = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Row 3: Margin Y
    this.buildSliderRow('Margin Y', this.initialMarginY, 0, 48, (val) => {
      this.element.style.marginTop = val + 'px';
      this.element.style.marginBottom = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Row 4: Margin X
    this.buildSliderRow('Margin X', this.initialMarginX, 0, 48, (val) => {
      this.element.style.marginLeft = val + 'px';
      this.element.style.marginRight = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Row 5: Radius
    this.buildSliderRow('Radius', this.initialRadius, 0, 32, (val) => {
      this.element.style.borderRadius = val + 'px';
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
    slider.value = String(initial);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'daub-edit-row-value';
    valueDisplay.textContent = initial + 'px';

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      valueDisplay.textContent = val + 'px';
      const changed = val !== initial;
      slider.classList.toggle('changed', changed);
      valueDisplay.classList.toggle('changed', changed);
      onChange(val);
    });

    row.append(lbl, slider, valueDisplay);
    this.section!.appendChild(row);
  }
}
