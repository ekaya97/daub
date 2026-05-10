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
    // Full-screen transparent overlay to intercept events
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;';

    // Highlight box
    this.highlight = document.createElement('div');
    this.highlight.style.cssText = `
      position:fixed; border:2px solid #6366f1; background:rgba(99,102,241,0.08);
      border-radius:3px; pointer-events:none; transition:all 0.08s ease;
      z-index:2147483646; display:none;
    `;

    // Tooltip showing component name + file
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position:fixed; background:#18181b; color:#e4e4e7; font-size:11px;
      font-family:ui-monospace,monospace; padding:3px 8px; border-radius:4px;
      pointer-events:none; z-index:2147483647; display:none; white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.3); border:1px solid #3f3f46;
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
    this.highlight.style.top = `${rect.top - 1}px`;
    this.highlight.style.left = `${rect.left - 1}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;

    // Resolve source for tooltip label
    const source = resolveSource(el);
    const label = source
      ? `${source.componentName} · ${source.file.split('/').pop()}:${source.line}`
      : el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ')[0]}` : '');

    this.tooltip.textContent = label;
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

    // composedPath()[0] pierces shadow roots (v2 F3)
    const target = (e.composedPath()[0] as HTMLElement) ?? this.currentTarget;
    if (!target || target === document.body || target === document.documentElement) return;

    this.onSelect(target);
    this.unmount();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.onCancel();
      this.unmount();
    }
  }
}
