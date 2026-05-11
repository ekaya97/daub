import { createIcon } from '../icons.js';

interface Stroke {
  tool: 'pen' | 'arrow' | 'rect' | 'text' | 'eraser';
  color: string;
  lineWidth: number;
  points: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
}

type DrawingTool = 'grab' | 'pen' | 'arrow' | 'rect' | 'text' | 'eraser';

const DRAWING_TOOLS: Array<{ name: DrawingTool; label: string; icon: string }> = [
  { name: 'grab', label: 'Grab', icon: 'cursor' },
  { name: 'pen', label: 'Pen', icon: 'pen' },
  { name: 'arrow', label: 'Arrow', icon: 'arrow' },
  { name: 'rect', label: 'Rect', icon: 'rect' },
  { name: 'text', label: 'Text', icon: 'text' },
  { name: 'eraser', label: 'Eraser', icon: 'eraser' },
];

const ANNOTATION_COLORS = [
  'oklch(0.72 0.18 45)',
  '#d9b857',
  '#5b8a4f',
  '#5a7a8c',
  '#1a1816',
  '#ffffff',
];

const ERASER_CURSOR = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='none' stroke='%23f5efe0' stroke-width='1.5'/></svg>") 10 10, auto`;

const TOOL_CURSORS: Record<DrawingTool, string> = {
  grab: 'grab',
  pen: 'crosshair',
  arrow: 'crosshair',
  rect: 'crosshair',
  text: 'text',
  eraser: ERASER_CURSOR,
};

export class AnnotateTab {
  private strokes: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private currentTool: DrawingTool = 'pen';
  private currentColor: string = ANNOTATION_COLORS[0];

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private img!: HTMLImageElement;
  private canvasWrap!: HTMLDivElement;
  private imgContainer!: HTMLDivElement;
  private resizeObserver: ResizeObserver | null = null;
  private toolButtons: Map<string, HTMLButtonElement> = new Map();
  private colorButtons: HTMLButtonElement[] = [];
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private marksLabel!: HTMLSpanElement;
  private statsEl!: HTMLDivElement;
  private zoomLabel!: HTMLSpanElement;
  private activeTextInput: HTMLInputElement | null = null;
  private textLabels: HTMLDivElement[] = [];
  private capturedAtTime: number = Date.now();
  private shadow: ShadowRoot | null = null;
  private zoom: number = 1;
  private grabbing = false;
  private grabStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

  // Movable annotation state
  private draggingStroke: {
    stroke: Stroke;
    startPoints: Array<{ x: number; y: number }>;
    startX: number;
    startY: number;
  } | null = null;

  // Bound handlers for clean removal
  private boundPointerDown = this.onPointerDown.bind(this);
  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);
  private boundKeyDown = this.onKeyDown.bind(this);
  private boundWheel = this.onWheel.bind(this);

  constructor(
    private container: HTMLElement,
    private screenshot: string,
  ) {
    this.capturedAtTime = Date.now();
  }

  mount(): void {
    const root = document.createElement('div');
    root.className = 'daub-annotate';

    // --- Toolbar ---
    const toolbar = document.createElement('div');
    toolbar.className = 'daub-annotate-toolbar';

    // Tool group: drawing tools
    const toolGroup = document.createElement('div');
    toolGroup.className = 'daub-tool-group';

    for (const tool of DRAWING_TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'daub-tool';
      btn.setAttribute('data-active', tool.name === this.currentTool ? 'true' : 'false');
      btn.setAttribute('data-tool', tool.name);
      btn.title = tool.label;
      btn.appendChild(createIcon(tool.icon as any));
      btn.addEventListener('click', () => this.selectTool(tool.name));
      this.toolButtons.set(tool.name, btn);
      toolGroup.appendChild(btn);
    }

    toolbar.appendChild(toolGroup);

    // Separator
    const sep1 = document.createElement('div');
    sep1.className = 'daub-tool-sep';
    toolbar.appendChild(sep1);

    // Color row
    const colorRow = document.createElement('div');
    colorRow.className = 'daub-color-row';

    for (let i = 0; i < ANNOTATION_COLORS.length; i++) {
      const color = ANNOTATION_COLORS[i];
      const btn = document.createElement('button');
      btn.className = 'daub-tool';
      btn.setAttribute('data-active', color === this.currentColor ? 'true' : 'false');
      btn.title = color;
      btn.style.cssText = `width:16px;height:16px;min-width:16px;border-radius:50%;background:${color};padding:0;border:1.5px solid ${color === this.currentColor ? 'var(--w-ink-1)' : 'transparent'};`;
      btn.addEventListener('click', () => this.selectColor(i));
      this.colorButtons.push(btn);
      colorRow.appendChild(btn);
    }

    toolbar.appendChild(colorRow);

    // Separator
    const sep2 = document.createElement('div');
    sep2.className = 'daub-tool-sep';
    toolbar.appendChild(sep2);

    // Undo/Redo group
    const undoRedoGroup = document.createElement('div');
    undoRedoGroup.className = 'daub-tool-group';

    this.undoBtn = document.createElement('button');
    this.undoBtn.className = 'daub-tool';
    this.undoBtn.title = 'Undo';
    this.undoBtn.appendChild(createIcon('undo'));
    this.undoBtn.addEventListener('click', () => this.undo());
    undoRedoGroup.appendChild(this.undoBtn);

    this.redoBtn = document.createElement('button');
    this.redoBtn.className = 'daub-tool';
    this.redoBtn.title = 'Redo';
    this.redoBtn.appendChild(createIcon('redo'));
    this.redoBtn.addEventListener('click', () => this.redo());
    undoRedoGroup.appendChild(this.redoBtn);

    toolbar.appendChild(undoRedoGroup);

    // Separator
    const sep3 = document.createElement('div');
    sep3.className = 'daub-tool-sep';
    toolbar.appendChild(sep3);

    // Zoom controls
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'daub-tool-group';

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'daub-tool';
    zoomOutBtn.title = 'Zoom out';
    zoomOutBtn.appendChild(createIcon('min'));
    zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom - 0.25));
    zoomGroup.appendChild(zoomOutBtn);

    this.zoomLabel = document.createElement('span');
    this.zoomLabel.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--w-ink-3);padding:0 4px;min-width:32px;text-align:center;display:inline-flex;align-items:center;justify-content:center;';
    this.updateZoomLabel();
    zoomGroup.appendChild(this.zoomLabel);

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'daub-tool';
    zoomInBtn.title = 'Zoom in';
    zoomInBtn.appendChild(createIcon('search'));
    zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom + 0.25));
    zoomGroup.appendChild(zoomInBtn);

    toolbar.appendChild(zoomGroup);

    // Flex spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    toolbar.appendChild(spacer);

    // Marks count
    this.marksLabel = document.createElement('span');
    this.marksLabel.style.cssText = 'font-family:var(--font-mono);font-size:10.5px;color:var(--w-ink-3)';
    this.updateMarksLabel();
    toolbar.appendChild(this.marksLabel);

    root.appendChild(toolbar);

    // --- Canvas wrap ---
    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'daub-canvas-wrap';

    // Image + canvas container (constrains the screenshot)
    this.imgContainer = document.createElement('div');
    this.imgContainer.className = 'daub-canvas-img';
    this.imgContainer.style.cssText = 'position:relative;flex-shrink:0;';

    this.img = document.createElement('img');
    this.img.src = this.screenshot;
    this.img.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px;';
    this.imgContainer.appendChild(this.img);

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;cursor:${TOOL_CURSORS[this.currentTool]};`;
    this.imgContainer.appendChild(this.canvas);

    this.canvasWrap.appendChild(this.imgContainer);

    this.ctx = this.canvas.getContext('2d')!;

    // Stats line
    this.statsEl = document.createElement('div');
    this.statsEl.className = 'daub-canvas-stats';
    this.canvasWrap.appendChild(this.statsEl);

    this.img.addEventListener('load', () => {
      this.syncCanvasSize();
      this.redrawAll();
      this.updateStats();
    });

    // If image is already cached / loaded
    if (this.img.complete && this.img.naturalWidth > 0) {
      this.syncCanvasSize();
      this.redrawAll();
      this.updateStats();
    }

    // Pointer events on canvas
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);

    // Keyboard shortcuts (undo/redo)
    this.shadow = this.container.getRootNode() as ShadowRoot;
    this.shadow.addEventListener('keydown', this.boundKeyDown);

    // ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasCSSSize();
    });
    this.resizeObserver.observe(this.imgContainer);

    // Zoom via scroll wheel (Ctrl/Cmd + scroll)
    this.canvasWrap.addEventListener('wheel', this.boundWheel, { passive: false });

    root.appendChild(this.canvasWrap);
    this.container.appendChild(root);

    this.updateUndoRedoState();
  }

  unmount(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);

    if (this.shadow) {
      this.shadow.removeEventListener('keydown', this.boundKeyDown);
    }

    this.canvasWrap?.removeEventListener('wheel', this.boundWheel);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove active text input if any
    if (this.activeTextInput) {
      this.activeTextInput.remove();
      this.activeTextInput = null;
    }

    // Remove text labels
    for (const label of this.textLabels) {
      label.remove();
    }
    this.textLabels = [];

    this.container.innerHTML = '';
    // Do NOT clear strokes array — preserve across tab switches
  }

  getAnnotatedImage(): string | null {
    if (this.strokes.length === 0) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = this.img.naturalWidth;
    offscreen.height = this.img.naturalHeight;
    const offCtx = offscreen.getContext('2d')!;

    // Draw the screenshot
    offCtx.drawImage(this.img, 0, 0, offscreen.width, offscreen.height);

    // Draw all strokes (non-text)
    this.renderStrokes(offCtx, offscreen.width, offscreen.height);

    // Draw text strokes as canvas text for export
    for (const stroke of this.strokes) {
      if (stroke.tool !== 'text' || !stroke.text || stroke.points.length === 0) continue;
      const fontSize = stroke.fontSize ?? 14;
      offCtx.save();
      offCtx.font = `500 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
      offCtx.fillStyle = stroke.color;
      offCtx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y + fontSize);
      offCtx.restore();
    }

    return offscreen.toDataURL('image/png');
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  getStrokeCount(): number {
    return this.strokes.length;
  }

  hasAnnotations(): boolean {
    return this.strokes.length > 0;
  }

  // ---- Private helpers ----

  private updateStats(): void {
    if (!this.statsEl || !this.img) return;
    const w = this.img.naturalWidth;
    const h = this.img.naturalHeight;
    const elapsed = Math.floor((Date.now() - this.capturedAtTime) / 1000);
    let ago: string;
    if (elapsed < 2) {
      ago = 'just now';
    } else if (elapsed < 60) {
      ago = `${elapsed}s ago`;
    } else {
      ago = `${Math.floor(elapsed / 60)}m ago`;
    }
    this.statsEl.textContent = `${w}\u00d7${h} \u00b7 png \u00b7 captured ${ago}`;
  }

  private updateMarksLabel(): void {
    if (!this.marksLabel) return;
    const n = this.strokes.length;
    this.marksLabel.textContent = `${n} mark${n === 1 ? '' : 's'}`;
  }

  private syncCanvasSize(): void {
    this.canvas.width = this.img.naturalWidth;
    this.canvas.height = this.img.naturalHeight;
    this.syncCanvasCSSSize();
  }

  private syncCanvasCSSSize(): void {
    const displayedWidth = this.img.clientWidth;
    const displayedHeight = this.img.clientHeight;
    this.canvas.style.width = `${displayedWidth}px`;
    this.canvas.style.height = `${displayedHeight}px`;
  }

  private selectTool(tool: DrawingTool): void {
    this.currentTool = tool;
    for (const [name, btn] of this.toolButtons) {
      btn.setAttribute('data-active', name === tool ? 'true' : 'false');
    }
    // Update canvas cursor
    if (this.canvas) {
      this.canvas.style.cursor = TOOL_CURSORS[tool];
    }
  }

  private selectColor(index: number): void {
    this.currentColor = ANNOTATION_COLORS[index];
    for (let i = 0; i < this.colorButtons.length; i++) {
      const active = i === index;
      this.colorButtons[i].setAttribute('data-active', active ? 'true' : 'false');
      this.colorButtons[i].style.borderColor = active ? 'var(--w-ink-1)' : 'transparent';
    }
  }

  private onKeyDown(e: Event): void {
    const ev = e as KeyboardEvent;
    const isMod = ev.metaKey || ev.ctrlKey;

    if (isMod && ev.key === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      this.undo();
    } else if (isMod && ev.key === 'z' && ev.shiftKey) {
      ev.preventDefault();
      this.redo();
    } else if (!isMod && !ev.shiftKey && !ev.altKey) {
      // Single-key tool shortcuts
      switch (ev.key.toLowerCase()) {
        case 'g': this.selectTool('grab'); break;
        case 'p': this.selectTool('pen'); break;
        case 'a': this.selectTool('arrow'); break;
        case 'r': this.selectTool('rect'); break;
        case 't': this.selectTool('text'); break;
        case 'e': this.selectTool('eraser'); break;
      }
    }
  }

  private onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;

      // Cursor position relative to canvasWrap viewport
      const rect = this.canvasWrap.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      this.setZoom(this.zoom + delta, cursorX, cursorY);
    }
  }

  /**
   * Zoom anchored on a viewport point. If cursorX/cursorY are provided,
   * the content under that point stays fixed on screen.
   */
  private setZoom(level: number, cursorX?: number, cursorY?: number): void {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(4, level));

    // Calculate the content coordinate under the cursor before zoom
    if (cursorX != null && cursorY != null) {
      const contentX = (this.canvasWrap.scrollLeft + cursorX) / oldZoom;
      const contentY = (this.canvasWrap.scrollTop + cursorY) / oldZoom;

      // Apply new size
      this.applyZoomSize();

      // Adjust scroll so the same content point stays under the cursor
      this.canvasWrap.scrollLeft = contentX * this.zoom - cursorX;
      this.canvasWrap.scrollTop = contentY * this.zoom - cursorY;
    } else {
      this.applyZoomSize();
    }

    this.updateZoomLabel();
  }

  private applyZoomSize(): void {
    // Change actual width instead of CSS transform so scroll dimensions update
    const baseWidthPct = 86;
    const baseMaxWidth = 420;
    this.imgContainer.style.width = `${baseWidthPct * this.zoom}%`;
    this.imgContainer.style.maxWidth = `${baseMaxWidth * this.zoom}px`;
  }

  private updateZoomLabel(): void {
    if (!this.zoomLabel) return;
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private updateUndoRedoState(): void {
    if (this.undoBtn) {
      this.undoBtn.style.opacity = this.strokes.length === 0 ? '0.3' : '1';
    }
    if (this.redoBtn) {
      this.redoBtn.style.opacity = this.redoStack.length === 0 ? '0.3' : '1';
    }
  }

  private undo(): void {
    if (this.strokes.length === 0) return;
    const stroke = this.strokes.pop()!;
    this.redoStack.push(stroke);
    this.redrawAll();
    this.updateUndoRedoState();
    this.updateMarksLabel();
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    const stroke = this.redoStack.pop()!;
    this.strokes.push(stroke);
    this.redrawAll();
    this.updateUndoRedoState();
    this.updateMarksLabel();
  }

  private canvasCoords(e: PointerEvent): { x: number; y: number } {
    return {
      x: (e.offsetX / this.canvas.clientWidth) * this.canvas.width,
      y: (e.offsetY / this.canvas.clientHeight) * this.canvas.height,
    };
  }

  // ---- Hit-testing helpers ----

  /** Point-to-line-segment distance */
  private pointToSegmentDist(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  /** Check if point is within threshold of a rect stroke's edges */
  private hitTestRect(
    px: number, py: number,
    stroke: Stroke,
    threshold: number,
  ): boolean {
    if (stroke.points.length < 2) return false;
    const s = stroke.points[0];
    const e = stroke.points[1];
    const x1 = Math.min(s.x, e.x);
    const y1 = Math.min(s.y, e.y);
    const x2 = Math.max(s.x, e.x);
    const y2 = Math.max(s.y, e.y);

    // Check all 4 edges
    const dTop = this.pointToSegmentDist(px, py, x1, y1, x2, y1);
    const dBottom = this.pointToSegmentDist(px, py, x1, y2, x2, y2);
    const dLeft = this.pointToSegmentDist(px, py, x1, y1, x1, y2);
    const dRight = this.pointToSegmentDist(px, py, x2, y1, x2, y2);

    return Math.min(dTop, dBottom, dLeft, dRight) <= threshold;
  }

  /** Check if point is within threshold of an arrow stroke's line */
  private hitTestArrow(
    px: number, py: number,
    stroke: Stroke,
    threshold: number,
  ): boolean {
    if (stroke.points.length < 2) return false;
    const s = stroke.points[0];
    const e = stroke.points[1];
    return this.pointToSegmentDist(px, py, s.x, s.y, e.x, e.y) <= threshold;
  }

  /** Find the first canvas-drawn stroke (rect or arrow) hit at (px, py) */
  private hitTestCanvasStroke(px: number, py: number): Stroke | null {
    const threshold = 8;
    // Search in reverse so topmost strokes are hit first
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i];
      if (stroke.tool === 'rect' && this.hitTestRect(px, py, stroke, threshold)) {
        return stroke;
      }
      if (stroke.tool === 'arrow' && this.hitTestArrow(px, py, stroke, threshold)) {
        return stroke;
      }
    }
    return null;
  }

  // ---- Pointer event handlers ----

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();

    // Grab tool: check for movable strokes first, then fall back to panning
    if (this.currentTool === 'grab') {
      const { x, y } = this.canvasCoords(e);

      // Hit-test canvas shapes (rect, arrow)
      const hitStroke = this.hitTestCanvasStroke(x, y);
      if (hitStroke) {
        this.draggingStroke = {
          stroke: hitStroke,
          startPoints: hitStroke.points.map(p => ({ x: p.x, y: p.y })),
          startX: x,
          startY: y,
        };
        this.canvas.style.cursor = 'move';
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      // No stroke hit — start panning
      this.grabbing = true;
      this.grabStart = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: this.canvasWrap.scrollLeft,
        scrollTop: this.canvasWrap.scrollTop,
      };
      this.canvas.style.cursor = 'grabbing';
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const { x, y } = this.canvasCoords(e);

    if (this.currentTool === 'text') {
      this.startTextInput(e, x, y);
      return;
    }

    const lineWidth =
      this.currentTool === 'eraser' ? 24
      : this.currentTool === 'rect' ? 2.5
      : 3;

    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      lineWidth,
      points: [{ x, y }],
    };

    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    e.preventDefault();

    // Dragging a stroke (grab tool move mode)
    if (this.draggingStroke) {
      const { x, y } = this.canvasCoords(e);
      const dx = x - this.draggingStroke.startX;
      const dy = y - this.draggingStroke.startY;
      const stroke = this.draggingStroke.stroke;
      for (let i = 0; i < stroke.points.length; i++) {
        stroke.points[i] = {
          x: this.draggingStroke.startPoints[i].x + dx,
          y: this.draggingStroke.startPoints[i].y + dy,
        };
      }
      this.redrawAll();
      return;
    }

    // Grab tool: pan
    if (this.grabbing) {
      const dx = e.clientX - this.grabStart.x;
      const dy = e.clientY - this.grabStart.y;
      this.canvasWrap.scrollLeft = this.grabStart.scrollLeft - dx;
      this.canvasWrap.scrollTop = this.grabStart.scrollTop - dy;
      return;
    }

    // Grab tool: update cursor on hover for hit-test feedback
    if (this.currentTool === 'grab' && !this.currentStroke) {
      const { x, y } = this.canvasCoords(e);
      const hitStroke = this.hitTestCanvasStroke(x, y);
      this.canvas.style.cursor = hitStroke ? 'move' : 'grab';
      return;
    }

    if (!this.currentStroke) return;

    const { x, y } = this.canvasCoords(e);
    this.currentStroke.points.push({ x, y });

    if (this.currentStroke.tool === 'pen' || this.currentStroke.tool === 'eraser') {
      // Draw incremental line segment for performance
      const pts = this.currentStroke.points;
      const from = pts[pts.length - 2];
      const to = pts[pts.length - 1];
      this.ctx.save();
      this.ctx.strokeStyle = this.currentStroke.color;
      this.ctx.lineWidth = this.currentStroke.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      if (this.currentStroke.tool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
      }
      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (this.currentStroke.tool === 'arrow' || this.currentStroke.tool === 'rect') {
      // Redraw everything + temporary shape
      this.redrawAll();
      const start = this.currentStroke.points[0];
      const end = { x, y };
      this.ctx.save();
      this.ctx.strokeStyle = this.currentStroke.color;
      this.ctx.lineWidth = this.currentStroke.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      if (this.currentStroke.tool === 'arrow') {
        this.drawArrow(this.ctx, start, end);
      } else {
        this.drawRect(this.ctx, start, end);
      }

      this.ctx.restore();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    e.preventDefault();

    // Finish dragging a stroke
    if (this.draggingStroke) {
      this.draggingStroke = null;
      this.canvas.style.cursor = 'grab';
      return;
    }

    // Grab tool: stop panning
    if (this.grabbing) {
      this.grabbing = false;
      this.canvas.style.cursor = 'grab';
      return;
    }

    if (!this.currentStroke) return;

    if (this.currentStroke.tool === 'arrow' || this.currentStroke.tool === 'rect') {
      // Finalize with just 2 points: start and end
      const start = this.currentStroke.points[0];
      const end = this.currentStroke.points[this.currentStroke.points.length - 1];
      this.currentStroke.points = [start, end];
    }

    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
    // Clear redo stack on new action
    this.redoStack = [];
    this.redrawAll();
    this.updateUndoRedoState();
    this.updateMarksLabel();
  }

  // ---- Text input ----

  private startTextInput(_e: PointerEvent, canvasX: number, canvasY: number): void {
    // Remove any existing text input
    if (this.activeTextInput) {
      this.activeTextInput.remove();
      this.activeTextInput = null;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = `
      position:absolute;
      background:rgba(22, 20, 15, 0.8);
      border:1px solid var(--w-accent);
      color:var(--w-ink);
      font:14px var(--font-mono);
      outline:none;
      padding:2px 4px;
      min-width:60px;
      border-radius:4px;
      z-index:10;
    `;

    // Position relative to the canvas container, scaled to CSS coordinates
    const cssX = (canvasX / this.canvas.width) * this.canvas.clientWidth;
    const cssY = (canvasY / this.canvas.height) * this.canvas.clientHeight;
    input.style.left = `${cssX}px`;
    input.style.top = `${cssY}px`;

    const commitText = () => {
      const value = input.value.trim();
      if (value) {
        this.strokes.push({
          tool: 'text',
          color: this.currentColor,
          lineWidth: 0,
          points: [{ x: canvasX, y: canvasY }],
          text: value,
          fontSize: 14,
        });
        this.redoStack = [];
        this.redrawAll();
        this.updateUndoRedoState();
        this.updateMarksLabel();
      }
      input.remove();
      this.activeTextInput = null;
    };

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commitText();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        input.remove();
        this.activeTextInput = null;
      }
    });

    input.addEventListener('blur', () => {
      // Only commit if input is still in the DOM (not removed by Escape)
      if (input.parentNode) {
        commitText();
      }
    });

    this.imgContainer.appendChild(input);
    this.activeTextInput = input;
    input.focus();
  }

  // ---- Drawing helpers ----

  private redrawAll(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderStrokes(this.ctx, this.canvas.width, this.canvas.height);
    this.rebuildTextLabels();
  }

  private renderStrokes(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
  ): void {
    for (const stroke of this.strokes) {
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (stroke.tool) {
        case 'pen':
          this.drawPenStroke(ctx, stroke);
          break;
        case 'arrow':
          if (stroke.points.length >= 2) {
            this.drawArrow(ctx, stroke.points[0], stroke.points[1]);
          }
          break;
        case 'rect':
          if (stroke.points.length >= 2) {
            this.drawRect(ctx, stroke.points[0], stroke.points[1]);
          }
          break;
        case 'text':
          this.drawTextStroke(ctx, stroke);
          break;
        case 'eraser':
          ctx.globalCompositeOperation = 'destination-out';
          this.drawPenStroke(ctx, stroke);
          break;
      }

      ctx.restore();
    }
  }

  private drawPenStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): void {
    // Line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Filled triangle arrowhead (matching design marker)
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 10;
    const headAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - headAngle),
      end.y - headLen * Math.sin(angle - headAngle),
    );
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + headAngle),
      end.y - headLen * Math.sin(angle + headAngle),
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawRect(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): void {
    // Dashed stroke with rounded corners (matching design: strokeDasharray="3 2" rx="3")
    ctx.setLineDash([6, 4]); // scaled for canvas resolution
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const r = Math.min(6, w / 2, h / 2); // corner radius

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawTextStroke(_ctx: CanvasRenderingContext2D, _stroke: Stroke): void {
    // Text strokes are rendered as DOM labels, not on canvas
    // See rebuildTextLabels()
  }

  /** Rebuild DOM text labels from strokes (called after redrawAll) */
  private rebuildTextLabels(): void {
    // Remove existing labels
    for (const label of this.textLabels) {
      label.remove();
    }
    this.textLabels = [];

    // Create labels for text strokes
    for (const stroke of this.strokes) {
      if (stroke.tool !== 'text' || !stroke.text || stroke.points.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'daub-annot-label';
      label.textContent = stroke.text;
      label.style.borderColor = stroke.color;
      label.style.cursor = 'move';

      // Position relative to imgContainer, scaled from canvas coords to CSS coords
      const cssX = (stroke.points[0].x / this.canvas.width) * this.canvas.clientWidth;
      const cssY = (stroke.points[0].y / this.canvas.height) * this.canvas.clientHeight;
      label.style.left = `${cssX}px`;
      label.style.top = `${cssY}px`;

      // Make text labels draggable
      label.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startCanvasX = stroke.points[0].x;
        const startCanvasY = stroke.points[0].y;

        // Scale factor: canvas coords per CSS pixel
        const scaleX = this.canvas.width / this.canvas.clientWidth;
        const scaleY = this.canvas.height / this.canvas.clientHeight;

        const onMove = (moveEv: PointerEvent) => {
          moveEv.preventDefault();
          const dx = moveEv.clientX - startClientX;
          const dy = moveEv.clientY - startClientY;

          // Account for zoom: CSS pixels on screen map to fewer content pixels at higher zoom
          stroke.points[0] = {
            x: startCanvasX + dx * scaleX,
            y: startCanvasY + dy * scaleY,
          };

          // Reposition this label directly for smooth dragging
          const newCssX = (stroke.points[0].x / this.canvas.width) * this.canvas.clientWidth;
          const newCssY = (stroke.points[0].y / this.canvas.height) * this.canvas.clientHeight;
          label.style.left = `${newCssX}px`;
          label.style.top = `${newCssY}px`;
        };

        const onUp = () => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          // Final rebuild to sync everything
          this.rebuildTextLabels();
          this.redrawAll();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      this.imgContainer.appendChild(label);
      this.textLabels.push(label);
    }
  }
}
