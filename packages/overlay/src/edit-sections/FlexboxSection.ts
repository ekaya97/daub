export class FlexboxSection {
  private container: HTMLElement;
  private element: HTMLElement;
  private editHandler: (() => void) | null = null;
  private sectionEl: HTMLDivElement | null = null;

  constructor(container: HTMLElement, element: HTMLElement) {
    this.container = container;
    this.element = element;
  }

  onEdit(handler: () => void): void {
    this.editHandler = handler;
  }

  shouldShow(): boolean {
    const display = getComputedStyle(this.element).display;
    const parentDisplay = this.element.parentElement
      ? getComputedStyle(this.element.parentElement).display
      : '';
    return display.includes('flex') || parentDisplay.includes('flex');
  }

  mount(): void {
    if (!this.shouldShow()) return;

    this.sectionEl = document.createElement('div');
    this.sectionEl.style.marginBottom = '16px';

    const computed = getComputedStyle(this.element);
    const isContainer = computed.display.includes('flex');
    const isChild = this.element.parentElement
      ? getComputedStyle(this.element.parentElement).display.includes('flex')
      : false;

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:var(--daub-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    const roles = [isContainer && 'Container', isChild && 'Child'].filter(Boolean).join(' + ');
    header.textContent = `Flexbox (${roles})`;
    this.sectionEl.appendChild(header);

    if (isContainer) {
      this.addSelect('flex-direction', 'Direction', ['row', 'row-reverse', 'column', 'column-reverse'], computed.flexDirection);
      this.addSelect('flex-wrap', 'Wrap', ['nowrap', 'wrap', 'wrap-reverse'], computed.flexWrap);
      this.addSelect('justify-content', 'Justify', ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'], computed.justifyContent);
      this.addSelect('align-items', 'Align', ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'], computed.alignItems);
      this.addSlider('gap', 'Gap', 0, 64, 1, parseFloat(computed.gap) || 0, 'px');
    }

    if (isChild) {
      this.addSelect('align-self', 'Self Align', ['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'], computed.alignSelf);
      this.addSlider('flex-grow', 'Grow', 0, 10, 1, parseFloat(computed.flexGrow) || 0, '');
      this.addSlider('flex-shrink', 'Shrink', 0, 10, 1, parseFloat(computed.flexShrink) || 0, '');
    }

    this.container.appendChild(this.sectionEl);
  }

  unmount(): void {
    this.sectionEl?.remove();
    this.sectionEl = null;
  }

  private addSelect(prop: string, label: string, options: string[], current: string): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:11px;color:var(--daub-text-muted);width:60px;flex-shrink:0;';
    lbl.textContent = label;

    const select = document.createElement('select');
    select.style.cssText = `
      flex:1; background:var(--daub-bg-surface); color:var(--daub-text);
      border:1px solid var(--daub-border); border-radius:4px; padding:4px 6px;
      font-size:12px; outline:none;
    `;

    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (current.includes(opt) || opt === current) o.selected = true;
      select.appendChild(o);
    }

    select.addEventListener('change', () => {
      this.element.style.setProperty(prop, select.value);
      this.editHandler?.();
    });

    row.append(lbl, select);
    this.sectionEl!.appendChild(row);
  }

  private addSlider(prop: string, label: string, min: number, max: number, step: number, current: number, unit: string): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:11px;color:var(--daub-text-muted);width:60px;flex-shrink:0;';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(current);
    slider.style.cssText = 'flex:1;accent-color:var(--daub-accent);';

    const display = document.createElement('span');
    display.style.cssText = 'font-size:11px;color:var(--daub-text);width:36px;text-align:right;font-family:ui-monospace,monospace;';
    display.textContent = `${current}${unit}`;

    slider.addEventListener('input', () => {
      const val = slider.value;
      display.textContent = `${val}${unit}`;
      this.element.style.setProperty(prop, val + unit);
      this.editHandler?.();
    });

    row.append(lbl, slider, display);
    this.sectionEl!.appendChild(row);
  }
}
