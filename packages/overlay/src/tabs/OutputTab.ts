import { createIcon } from '../icons.js';
import type { ElementContext } from '@daub/core';

type AttachmentChip = { label: string; on: boolean };

export class OutputTab {
  private container: HTMLElement;
  private context: ElementContext;
  private sessionId: string;

  private lightbox: HTMLDivElement | null = null;
  private boundEscapeHandler = this.onEscape.bind(this);
  private copyHandler: (() => void) | null = null;
  private chips: AttachmentChip[] = [];
  private copyBtn: HTMLButtonElement | null = null;
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;
  private previewWrapper: HTMLDivElement | null = null;
  private rootEl: HTMLDivElement | null = null;

  constructor(container: HTMLElement, context: ElementContext, sessionId: string) {
    this.container = container;
    this.context = context;
    this.sessionId = sessionId;

    this.chips = [
      { label: 'Screenshot', on: true },
      { label: 'Annotated overlay', on: !!context.screenshotAnnotated },
      { label: 'CSS diff', on: true },
      { label: 'Source location', on: true },
      { label: 'Tailwind classes', on: context.tailwindClasses.length > 0 },
      { label: 'DOM subtree', on: false },
    ];
  }

  mount(): void {
    const root = document.createElement('div');
    root.className = 'daub-output';
    this.rootEl = root;

    // ---- Output preview (what Claude gets) ----
    this.previewWrapper = this.buildOutputPreview();
    root.appendChild(this.previewWrapper);

    // ---- Attached section ----
    root.appendChild(this.buildAttachedSection());

    // ---- Action buttons ----
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;margin-top:auto';

    // Save draft
    const draftBtn = document.createElement('button');
    draftBtn.className = 'daub-btn daub-btn-ghost';
    draftBtn.style.flex = '0';
    draftBtn.appendChild(createIcon('file', 12));
    draftBtn.appendChild(document.createTextNode(' Save draft'));
    actions.appendChild(draftBtn);

    // Copy & hand off
    this.copyBtn = document.createElement('button');
    this.copyBtn.className = 'daub-btn daub-btn-primary';
    this.copyBtn.style.cssText = 'flex:1;justify-content:center';
    this.copyBtn.appendChild(createIcon('copy', 12));
    this.copyBtn.appendChild(document.createTextNode(' Copy & hand off to Claude Code'));

    this.copyBtn.addEventListener('click', () => {
      this.applyChipFilters();
      this.copyHandler?.();
      this.showCopiedFeedback();
    });

    actions.appendChild(this.copyBtn);
    root.appendChild(actions);

    this.container.appendChild(root);
  }

  unmount(): void {
    this.closeLightbox();
    document.removeEventListener('keydown', this.boundEscapeHandler);
    if (this.copyTimeout !== null) {
      clearTimeout(this.copyTimeout);
      this.copyTimeout = null;
    }
    this.copyBtn = null;
    this.container.innerHTML = '';
  }

  onCopy(handler: () => void): void {
    this.copyHandler = handler;
  }

  updateContext(context: ElementContext): void {
    this.context = context;
    this.unmount();
    this.mount();
  }

  // ---- Builders ----

  private buildOutputPreview(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'daub-output-summary';

    // Head
    const head = document.createElement('div');
    head.className = 'daub-output-summary-head';

    const headLabel = document.createElement('span');
    headLabel.style.cssText = 'display:flex;align-items:center;gap:5px';
    headLabel.appendChild(createIcon('diff', 11));
    headLabel.appendChild(document.createTextNode(' output preview'));
    head.appendChild(headLabel);

    const formatTag = document.createElement('span');
    formatTag.style.cssText = 'font-family:var(--font-mono);font-size:9.5px';
    formatTag.textContent = 'CLIPBOARD';
    head.appendChild(formatTag);

    wrapper.appendChild(head);

    // Body — scrollable document preview
    const body = document.createElement('div');
    body.className = 'daub-output-summary-body';

    const ctx = this.context;
    const componentName = ctx.source?.componentName || ctx.tagName;
    const sourceFile = ctx.source?.file || 'unknown';
    const sourceLine = ctx.source?.line;
    const intent = ctx.notes || 'visual changes';

    // Header section
    this.addLine(body, 'target', componentName);
    if (this.isChipOn('Source location')) {
      this.addLine(body, 'source', sourceFile + (sourceLine ? `:${sourceLine}` : ''));
    }
    this.addLine(body, 'intent', `"${intent}"`);

    // Screenshot (inline)
    if (this.isChipOn('Screenshot') && ctx.screenshotBefore) {
      this.addComment(body, '');
      this.addComment(body, 'screenshot');
      this.addInlineImage(body, ctx.screenshotBefore, 'capture');
    }

    // Annotated screenshot (inline)
    if (this.isChipOn('Annotated overlay') && ctx.screenshotAnnotated) {
      this.addComment(body, 'annotated overlay');
      this.addInlineImage(body, ctx.screenshotAnnotated, 'annotated');
    }

    // CSS deltas
    if (this.isChipOn('CSS diff') && ctx.cssDelta.length > 0) {
      this.addComment(body, '');
      this.addComment(body, `${ctx.cssDelta.length} css change${ctx.cssDelta.length !== 1 ? 's' : ''}`);

      for (const delta of ctx.cssDelta) {
        const deltaLine = document.createElement('div');
        deltaLine.innerHTML =
          `<span class="k">  ${this.escapeHtml(delta.property)}:</span> ` +
          `<span class="diff-del">${this.escapeHtml(delta.before)}</span> \u2192 ` +
          `<span class="diff-add">${this.escapeHtml(delta.after)}</span>`;
        body.appendChild(deltaLine);
      }
    }

    // Tailwind classes
    if (this.isChipOn('Tailwind classes') && ctx.tailwindClasses.length > 0) {
      this.addComment(body, `tailwind: ${ctx.tailwindClasses.join(' ')}`);
    }

    // DOM path
    if (ctx.domPath) {
      this.addComment(body, '');
      this.addLine(body, 'dom-path', ctx.domPath);
    }

    // HTML subtree
    if (this.isChipOn('DOM subtree') && ctx.htmlSubtree) {
      this.addComment(body, 'element html');
      const htmlBlock = document.createElement('div');
      htmlBlock.style.cssText = 'margin:4px 0;padding:6px 8px;background:var(--w-bg);border:1px solid var(--w-line);border-radius:4px;font-size:10.5px;white-space:pre-wrap;word-break:break-all;color:var(--w-ink-2);';
      htmlBlock.textContent = ctx.htmlSubtree;
      body.appendChild(htmlBlock);
    }

    wrapper.appendChild(body);
    return wrapper;
  }

  private buildAttachedSection(): HTMLDivElement {
    const section = document.createElement('div');

    const heading = document.createElement('div');
    heading.style.cssText =
      'font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--w-ink-3,#6f6a5b);margin-bottom:6px';
    heading.textContent = 'Attached';
    section.appendChild(heading);

    const chipContainer = document.createElement('div');
    chipContainer.className = 'daub-output-includes';

    for (const chip of this.chips) {
      const btn = document.createElement('button');
      btn.className = 'daub-output-chip';
      if (!chip.on) btn.classList.add('off');

      const checkSpan = document.createElement('span');
      checkSpan.className = 'daub-output-chip-check';
      checkSpan.textContent = chip.on ? '\u2713' : '';

      btn.appendChild(checkSpan);
      btn.appendChild(document.createTextNode(' ' + chip.label));

      btn.addEventListener('click', () => {
        chip.on = !chip.on;
        btn.classList.toggle('off', !chip.on);
        checkSpan.textContent = chip.on ? '\u2713' : '';
        this.rebuildPreview();
      });

      chipContainer.appendChild(btn);
    }

    section.appendChild(chipContainer);
    return section;
  }

  // ---- Helpers ----

  private isChipOn(label: string): boolean {
    return this.chips.find(c => c.label === label)?.on ?? true;
  }

  private rebuildPreview(): void {
    if (!this.previewWrapper || !this.rootEl) return;
    const newPreview = this.buildOutputPreview();
    this.rootEl.replaceChild(newPreview, this.previewWrapper);
    this.previewWrapper = newPreview;
  }

  private applyChipFilters(): void {
    if (!this.isChipOn('Screenshot')) {
      this.context.screenshotBefore = '';
    }
    if (!this.isChipOn('Annotated overlay')) {
      this.context.screenshotAnnotated = null;
    }
    if (!this.isChipOn('CSS diff')) {
      this.context.cssDelta = [];
    }
    if (!this.isChipOn('Source location')) {
      this.context.source = null;
    }
    if (!this.isChipOn('DOM subtree')) {
      this.context.htmlSubtree = '';
    }
  }

  private addLine(parent: HTMLElement, key: string, value: string): void {
    const line = document.createElement('div');
    line.innerHTML = `<span class="k">${this.escapeHtml(key)}:</span> <span class="v">${this.escapeHtml(value)}</span>`;
    parent.appendChild(line);
  }

  private addComment(parent: HTMLElement, text: string): void {
    const line = document.createElement('div');
    line.className = 'comment';
    line.textContent = text ? `# ${text}` : '';
    parent.appendChild(line);
  }

  private addInlineImage(parent: HTMLElement, src: string, label: string): void {
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'margin:4px 0 8px;position:relative;';

    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px;border:1px solid var(--w-line);cursor:pointer;';
    img.title = `${label} — click to enlarge`;
    img.addEventListener('click', () => this.openLightbox(src));
    imgWrap.appendChild(img);

    // Small label badge on top-right
    const badge = document.createElement('span');
    badge.style.cssText = 'position:absolute;top:4px;right:4px;font-size:9px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.05em;padding:1px 5px;border-radius:3px;background:rgba(22,20,15,0.75);color:var(--w-ink-3);';
    badge.textContent = label;
    imgWrap.appendChild(badge);

    parent.appendChild(imgWrap);
  }

  // ---- Copy feedback ----

  private showCopiedFeedback(): void {
    if (!this.copyBtn) return;

    this.copyBtn.innerHTML = '';
    this.copyBtn.appendChild(createIcon('check', 12));
    this.copyBtn.appendChild(document.createTextNode(' Copied to clipboard \u2014 paste in Claude Code'));

    if (this.copyTimeout !== null) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      if (!this.copyBtn) return;
      this.copyBtn.innerHTML = '';
      this.copyBtn.appendChild(createIcon('copy', 12));
      this.copyBtn.appendChild(document.createTextNode(' Copy & hand off to Claude Code'));
      this.copyTimeout = null;
    }, 1800);
  }

  // ---- Lightbox ----

  private openLightbox(src: string): void {
    this.closeLightbox();

    this.lightbox = document.createElement('div');
    this.lightbox.className = 'daub-lightbox';

    const img = document.createElement('img');
    img.src = src;
    this.lightbox.appendChild(img);

    this.lightbox.addEventListener('click', () => this.closeLightbox());
    document.addEventListener('keydown', this.boundEscapeHandler);
    document.body.appendChild(this.lightbox);
  }

  private closeLightbox(): void {
    if (this.lightbox) {
      this.lightbox.remove();
      this.lightbox = null;
      document.removeEventListener('keydown', this.boundEscapeHandler);
    }
  }

  private onEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.closeLightbox();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
