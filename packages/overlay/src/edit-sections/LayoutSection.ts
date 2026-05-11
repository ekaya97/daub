import { createIcon } from '../icons.js';

type DisplayValue = 'block' | 'flex' | 'inline-flex' | 'grid';

function normalizeDisplay(raw: string): DisplayValue {
  if (raw === 'flex') return 'flex';
  if (raw === 'inline-flex') return 'inline-flex';
  if (raw === 'grid') return 'grid';
  return 'block';
}

function normalizeJustify(raw: string): string {
  if (raw === 'flex-start' || raw === 'normal' || raw === 'start') return 'start';
  if (raw === 'flex-end' || raw === 'end') return 'end';
  if (raw === 'center') return 'center';
  if (raw === 'space-between') return 'between';
  if (raw === 'space-around') return 'around';
  return 'start';
}

function normalizeAlign(raw: string): string {
  if (raw === 'flex-start' || raw === 'start') return 'start';
  if (raw === 'flex-end' || raw === 'end') return 'end';
  if (raw === 'center') return 'center';
  if (raw === 'stretch' || raw === 'normal') return 'stretch';
  return 'stretch';
}

function normalizeTextAlign(raw: string): string {
  if (raw === 'start') return 'left';
  if (raw === 'end') return 'right';
  return raw;
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

export class LayoutSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private section: HTMLElement | null = null;

  private initialDisplay: DisplayValue = 'block';
  private initialDirection = 'row';
  private initialJustify = 'start';
  private initialAlign = 'stretch';
  private initialGap = 0;
  private initialTextAlign = 'left';

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  mount(): void {
    const computed = getComputedStyle(this.element);
    this.initialDisplay = normalizeDisplay(computed.display);
    this.initialDirection = computed.flexDirection || 'row';
    this.initialJustify = normalizeJustify(computed.justifyContent);
    this.initialAlign = normalizeAlign(computed.alignItems);
    this.initialGap = parseInt(computed.gap, 10) || 0;
    this.initialTextAlign = normalizeTextAlign(computed.textAlign || 'left');

    this.section = document.createElement('div');
    this.section.className = 'daub-edit-section';

    // Header
    const head = document.createElement('div');
    head.className = 'daub-edit-section-head';

    const titleSpan = document.createElement('span');
    titleSpan.appendChild(createIcon('layout', 10));
    titleSpan.appendChild(document.createTextNode('Layout'));
    head.appendChild(titleSpan);

    const dot = document.createElement('i');
    dot.className = 'daub-edit-section-dot';
    dot.style.display = 'none';
    head.appendChild(dot);

    this.section.appendChild(head);

    let currentDisplay = this.initialDisplay;

    const checkChanged = () => {
      const c = getComputedStyle(this.element);
      const curDisplay = normalizeDisplay(c.display);
      const curDirection = c.flexDirection || 'row';
      const curJustify = normalizeJustify(c.justifyContent);
      const curAlign = normalizeAlign(c.alignItems);
      const curGap = parseInt(c.gap, 10) || 0;
      const curTextAlign = normalizeTextAlign(c.textAlign || 'left');
      const changed =
        curDisplay !== this.initialDisplay ||
        curDirection !== this.initialDirection ||
        curJustify !== this.initialJustify ||
        curAlign !== this.initialAlign ||
        curGap !== this.initialGap ||
        curTextAlign !== this.initialTextAlign;
      dot.style.display = changed ? '' : 'none';
    };

    // Flex/grid-specific rows wrapper
    const flexRows = document.createElement('div');

    const updateFlexRowsVisibility = () => {
      const isFlexOrGrid =
        currentDisplay === 'flex' ||
        currentDisplay === 'inline-flex' ||
        currentDisplay === 'grid';
      flexRows.style.display = isFlexOrGrid ? '' : 'none';
    };

    // Row 1: Display (segmented)
    this.buildSegmentedRow(
      'Display',
      ['block', 'flex', 'inline-flex', 'grid'],
      this.initialDisplay,
      (val) => {
        currentDisplay = val as DisplayValue;
        this.element.style.display = val;
        updateFlexRowsVisibility();
        checkChanged();
        this.editHandler?.();
      },
    );

    // Flex/grid rows container
    this.section.appendChild(flexRows);

    // Row 2: Direction (flex/inline-flex only, but shown for grid too for simplicity)
    this.buildSegmentedRowInto(
      flexRows,
      'Direction',
      ['row', 'column'],
      this.initialDirection,
      (val) => {
        this.element.style.flexDirection = val;
        checkChanged();
        this.editHandler?.();
      },
    );

    // Row 3: Justify
    this.buildSegmentedRowInto(
      flexRows,
      'Justify',
      ['start', 'center', 'end', 'betw.', 'arnd.'],
      this.initialJustify === 'between'
        ? 'betw.'
        : this.initialJustify === 'around'
          ? 'arnd.'
          : this.initialJustify,
      (val) => {
        const mapped =
          val === 'betw.'
            ? 'between'
            : val === 'arnd.'
              ? 'around'
              : val;
        this.element.style.justifyContent = JUSTIFY_MAP[mapped] || mapped;
        checkChanged();
        this.editHandler?.();
      },
    );

    // Row 4: Align
    this.buildSegmentedRowInto(
      flexRows,
      'Align',
      ['start', 'center', 'end', 'stretch'],
      this.initialAlign,
      (val) => {
        this.element.style.alignItems = ALIGN_MAP[val] || val;
        checkChanged();
        this.editHandler?.();
      },
    );

    // Row 5: Gap (slider)
    this.buildSliderRowInto(flexRows, 'Gap', this.initialGap, 0, 48, (val) => {
      this.element.style.gap = val + 'px';
      checkChanged();
      this.editHandler?.();
    });

    // Set initial visibility
    updateFlexRowsVisibility();

    // Row 6: Text Align (always visible)
    this.buildSegmentedRow(
      'Text Align',
      ['left', 'center', 'right'],
      this.initialTextAlign,
      (val) => {
        this.element.style.textAlign = val;
        checkChanged();
        this.editHandler?.();
      },
    );

    this.container.appendChild(this.section);
  }

  unmount(): void {
    if (this.section) {
      this.section.remove();
      this.section = null;
    }
    this.editHandler = null;
  }

  private buildSegmentedRow(
    label: string,
    options: string[],
    active: string,
    onChange: (val: string) => void,
  ): void {
    this.buildSegmentedRowInto(this.section!, label, options, active, onChange);
  }

  private buildSegmentedRowInto(
    parent: HTMLElement,
    label: string,
    options: string[],
    active: string,
    onChange: (val: string) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'daub-edit-row';

    const lbl = document.createElement('span');
    lbl.className = 'daub-edit-row-label';
    lbl.textContent = label;

    const seg = document.createElement('div');
    seg.className = 'daub-edit-seg';
    seg.style.gridColumn = '2 / -1';

    const buttons: HTMLButtonElement[] = [];

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'daub-edit-seg-btn';
      btn.textContent = opt;
      if (opt === active) {
        btn.setAttribute('data-active', 'true');
      }

      btn.addEventListener('click', () => {
        for (const b of buttons) b.removeAttribute('data-active');
        btn.setAttribute('data-active', 'true');
        onChange(opt);
      });

      buttons.push(btn);
      seg.appendChild(btn);
    }

    row.append(lbl, seg);
    parent.appendChild(row);
  }

  private buildSliderRowInto(
    parent: HTMLElement,
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
    parent.appendChild(row);
  }
}
