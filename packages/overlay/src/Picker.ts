import { resolveSource } from './source.js';

export class Picker {
  private overlay: HTMLDivElement;
  private highlight: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private currentTarget: HTMLElement | null = null;

  // Store bound references so removeEventListener works (v2 F8)
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundClick = this.onClick.bind(this);
  private boundKeyDown = this.onKeyDown.bind(this);

  constructor(
    private onSelect: (el: HTMLElement) => void,
    private onCancel: () => void,
  ) {
    // Full-screen dim overlay to intercept events
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:rgba(15, 14, 12, 0.18);';

    // Hover highlight box — dashed outline
    this.highlight = document.createElement('div');
    this.highlight.style.cssText = `
      position:fixed; outline:1.5px dashed oklch(0.72 0.18 45); outline-offset:2px;
      background:oklch(0.72 0.18 45 / 0.14); border-radius:4px; pointer-events:none;
      transition:all 0.08s ease; z-index:2147483646; display:none;
    `;

    // Tooltip showing component name + file
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position:fixed; background:#16140f; color:#f5efe0; font-size:10.5px;
      font-family:ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      padding:3px 7px; border-radius:5px; pointer-events:none; z-index:2147483647;
      display:none; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.4);
      border:1px solid #3a3528;
    `;
  }

  mount(): void {
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.highlight);
    document.body.appendChild(this.tooltip);

    this.overlay.addEventListener('mousemove', this.boundMouseMove);
    this.overlay.addEventListener('click', this.boundClick);
    document.addEventListener('keydown', this.boundKeyDown);
  }

  unmount(): void {
    this.overlay.removeEventListener('mousemove', this.boundMouseMove);
    this.overlay.removeEventListener('click', this.boundClick);
    document.removeEventListener('keydown', this.boundKeyDown);
    this.overlay.remove();
    this.highlight.remove();
    this.tooltip.remove();
    this.currentTarget = null;
  }

  private onMouseMove(e: MouseEvent): void {
    // Hide overlay temporarily to get element underneath
    this.overlay.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    this.overlay.style.display = '';

    if (!el || el === document.body || el === document.documentElement) {
      this.highlight.style.display = 'none';
      this.tooltip.style.display = 'none';
      return;
    }

    // Skip elements inside the Daub host
    if (el.closest('#__daub_host__')) {
      this.highlight.style.display = 'none';
      this.tooltip.style.display = 'none';
      return;
    }

    this.currentTarget = el;
    const rect = el.getBoundingClientRect();

    // Update highlight position
    this.highlight.style.display = 'block';
    this.highlight.style.top = `${rect.top}px`;
    this.highlight.style.left = `${rect.left}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;

    // Resolve source for tooltip label
    const source = resolveSource(el);
    const label = source
      ? `${source.componentName} \u00B7 ${source.file.split('/').pop()}:${source.line}`
      : el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ')[0]}` : '');

    // Set tooltip content with component name colored differently
    if (source) {
      this.tooltip.innerHTML = `<span style="color:oklch(0.74 0.18 45)">${source.componentName}</span> \u00B7 ${source.file.split('/').pop()}:${source.line}`;
    } else {
      this.tooltip.textContent = label;
    }
    this.tooltip.style.display = 'block';

    // Tooltip positioning with viewport clamping (v2 F6)
    const tooltipHeight = 24;
    const showAbove = rect.top > tooltipHeight + 8;
    this.tooltip.style.top = showAbove
      ? `${rect.top - tooltipHeight - 4}px`
      : `${rect.bottom + 4}px`;

    // Horizontal clamp
    const tooltipWidth = this.tooltip.offsetWidth;
    const left = Math.min(rect.left, window.innerWidth - tooltipWidth - 8);
    this.tooltip.style.left = `${Math.max(8, left)}px`;
  }

  private onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Use currentTarget from mousemove (identified via elementFromPoint).
    // composedPath()[0] would return the overlay itself since that's the click target.
    // For shadow DOM piercing (v2 F3), we hide the overlay and re-probe on click.
    this.overlay.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    this.overlay.style.display = '';

    const selected = target ?? this.currentTarget;
    if (!selected || selected === document.body || selected === document.documentElement) return;

    // Apply selected element highlight style
    selected.style.outline = '2px solid oklch(0.72 0.18 45)';
    selected.style.outlineOffset = '2px';
    selected.style.borderRadius = '4px';

    this.onSelect(selected);
    this.unmount();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.onCancel();
      this.unmount();
    }
  }
}
