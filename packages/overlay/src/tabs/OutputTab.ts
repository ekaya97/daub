import type { ElementContext } from '@daub/core';
import { serializeToMarkdown } from '@daub/core';

export class OutputTab {
  private textarea: HTMLTextAreaElement | null = null;
  private wrapper: HTMLDivElement | null = null;
  private lightbox: HTMLDivElement | null = null;
  private boundEscapeHandler = this.onEscape.bind(this);

  constructor(
    private container: HTMLElement,
    private context: ElementContext,
    private sessionId: string,
  ) {}

  mount(): void {
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText =
      'display:flex;flex-direction:column;gap:16px;padding:12px 0;overflow-y:auto;height:100%;';

    // 1. Before/After thumbnails
    this.renderThumbnails(this.wrapper);

    // 2. Annotations thumbnail
    this.renderAnnotations(this.wrapper);

    // 3. CSS Delta display
    this.renderCssDelta(this.wrapper);

    // 4. Notes textarea
    this.renderNotes(this.wrapper);

    // 5. Markdown preview
    this.renderMarkdownPreview(this.wrapper);

    this.container.appendChild(this.wrapper);
  }

  unmount(): void {
    this.closeLightbox();
    document.removeEventListener('keydown', this.boundEscapeHandler);
    this.container.innerHTML = '';
    this.textarea = null;
    this.wrapper = null;
  }

  getNotes(): string {
    return this.textarea?.value ?? '';
  }

  getMarkdown(): string {
    return serializeToMarkdown(this.context, this.sessionId);
  }

  updateContext(context: ElementContext): void {
    const notesValue = this.textarea?.value ?? '';
    this.context = context;
    this.unmount();
    this.mount();
    // Preserve notes textarea value
    if (this.textarea) {
      this.textarea.value = notesValue;
      this.context.notes = notesValue;
    }
  }

  // ---- Section renderers ----

  private renderThumbnails(parent: HTMLDivElement): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;';

    // Before
    const beforeCol = document.createElement('div');
    beforeCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    beforeCol.appendChild(this.createLabel('BEFORE'));
    beforeCol.appendChild(this.createThumbnail(this.context.screenshotBefore));
    row.appendChild(beforeCol);

    // After (conditional)
    if (this.context.screenshotAfter !== null) {
      const afterCol = document.createElement('div');
      afterCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      afterCol.appendChild(this.createLabel('AFTER'));
      afterCol.appendChild(this.createThumbnail(this.context.screenshotAfter));
      row.appendChild(afterCol);
    }

    parent.appendChild(row);
  }

  private renderAnnotations(parent: HTMLDivElement): void {
    if (this.context.screenshotAnnotated === null) return;

    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    section.appendChild(this.createLabel('ANNOTATIONS'));
    section.appendChild(this.createThumbnail(this.context.screenshotAnnotated));
    parent.appendChild(section);
  }

  private renderCssDelta(parent: HTMLDivElement): void {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    section.appendChild(this.createLabel('CSS DELTA'));

    if (this.context.cssDelta.length === 0) {
      const muted = document.createElement('span');
      muted.style.cssText = 'color:var(--daub-text-muted);font-size:12px;font-family:ui-monospace,monospace;';
      muted.textContent = '(no edits)';
      section.appendChild(muted);
    } else {
      for (const delta of this.context.cssDelta) {
        const line = document.createElement('div');
        line.style.cssText = 'font-family:ui-monospace,monospace;font-size:12px;color:var(--daub-text);';

        const propSpan = document.createTextNode(`${delta.property}: `);
        line.appendChild(propSpan);

        const beforeSpan = document.createElement('span');
        beforeSpan.style.cssText = 'color:var(--daub-danger);text-decoration:line-through;';
        beforeSpan.textContent = delta.before;
        line.appendChild(beforeSpan);

        const arrow = document.createTextNode(' \u2192 ');
        line.appendChild(arrow);

        const afterSpan = document.createElement('span');
        afterSpan.style.cssText = 'color:var(--daub-success);';
        afterSpan.textContent = delta.after;
        line.appendChild(afterSpan);

        section.appendChild(line);
      }
    }

    parent.appendChild(section);
  }

  private renderNotes(parent: HTMLDivElement): void {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    section.appendChild(this.createLabel('NOTES'));

    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = 'Add context for Claude...';
    this.textarea.value = this.context.notes ?? '';
    this.textarea.style.cssText =
      'width:100%;min-height:80px;resize:vertical;background:var(--daub-bg-surface);color:var(--daub-text);border:1px solid var(--daub-border);border-radius:6px;padding:8px;font-size:13px;font-family:system-ui;outline:none;box-sizing:border-box;';

    this.textarea.addEventListener('input', () => {
      this.context.notes = this.textarea?.value ?? '';
    });

    section.appendChild(this.textarea);
    parent.appendChild(section);
  }

  private renderMarkdownPreview(parent: HTMLDivElement): void {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const toggle = document.createElement('div');
    toggle.style.cssText = 'cursor:pointer;font-size:12px;color:var(--daub-text-muted);user-select:none;';
    toggle.textContent = '\u25B6 Show full output';

    let expanded = false;
    let preBlock: HTMLPreElement | null = null;

    toggle.addEventListener('click', () => {
      expanded = !expanded;
      if (expanded) {
        toggle.textContent = '\u25BC Hide full output';
        if (!preBlock) {
          preBlock = document.createElement('pre');
          preBlock.style.cssText =
            'background:#09090b;padding:12px;border-radius:6px;font-size:11px;font-family:ui-monospace,monospace;color:var(--daub-text-muted);overflow-x:auto;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
          section.appendChild(preBlock);
        }
        // Regenerate markdown on expand to reflect latest notes
        preBlock.textContent = this.getMarkdown();
        preBlock.style.display = 'block';
      } else {
        toggle.textContent = '\u25B6 Show full output';
        if (preBlock) {
          preBlock.style.display = 'none';
        }
      }
    });

    section.appendChild(toggle);
    parent.appendChild(section);
  }

  // ---- Helpers ----

  private createLabel(text: string): HTMLDivElement {
    const label = document.createElement('div');
    label.style.cssText =
      'font-size:10px;text-transform:uppercase;color:var(--daub-text-muted);letter-spacing:0.5px;';
    label.textContent = text;
    return label;
  }

  private createThumbnail(src: string): HTMLImageElement {
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText =
      'max-width:180px;border-radius:4px;border:1px solid var(--daub-border);cursor:pointer;';

    img.addEventListener('click', () => {
      this.openLightbox(src);
    });

    return img;
  }

  private openLightbox(src: string): void {
    this.closeLightbox();

    this.lightbox = document.createElement('div');
    this.lightbox.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;';

    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:90vw;max-height:90vh;';
    this.lightbox.appendChild(img);

    this.lightbox.addEventListener('click', () => {
      this.closeLightbox();
    });

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
}
