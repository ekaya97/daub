import {
  PEN_ICON,
  ARROW_ICON,
  RECT_ICON,
  TEXT_ICON,
  ERASER_ICON,
  UNDO_ICON,
} from '../icons.js';

interface Stroke {
  tool: 'pen' | 'arrow' | 'rect' | 'text' | 'eraser';
  color: string;
  lineWidth: number;
  points: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
}

type ToolName = 'pen' | 'arrow' | 'rect' | 'text' | 'eraser' | 'undo';

const TOOLS: Array<{ name: ToolName; icon: string }> = [
  { name: 'pen', icon: PEN_ICON },
  { name: 'arrow', icon: ARROW_ICON },
  { name: 'rect', icon: RECT_ICON },
  { name: 'text', icon: TEXT_ICON },
  { name: 'eraser', icon: ERASER_ICON },
  { name: 'undo', icon: UNDO_ICON },
];

export class AnnotateTab {
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private activeTool: ToolName = 'pen';
  private activeColor = '#ef4444';

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private img!: HTMLImageElement;
  private toolbar!: HTMLDivElement;
  private canvasContainer!: HTMLDivElement;
  private resizeObserver: ResizeObserver | null = null;
  private toolButtons: Map<ToolName, HTMLButtonElement> = new Map();
  private undoBtn!: HTMLButtonElement;
  private activeTextInput: HTMLInputElement | null = null;

  // Bound handlers for clean removal
  private boundPointerDown = this.onPointerDown.bind(this);
  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);

  constructor(
    private container: HTMLElement,
    private screenshot: string,
  ) {}

  mount(): void {
    // --- Toolbar ---
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'daub-annotate-toolbar';

    for (const tool of TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'daub-tool-btn';
      if (tool.name === this.activeTool) btn.classList.add('active');
      btn.innerHTML = tool.icon;
      btn.setAttribute('data-tool', tool.name);

      if (tool.name === 'undo') {
        this.undoBtn = btn;
        this.updateUndoState();
        btn.addEventListener('click', () => this.undo());
      } else {
        btn.addEventListener('click', () => this.selectTool(tool.name));
      }

      this.toolButtons.set(tool.name, btn);
      this.toolbar.appendChild(btn);
    }

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'daub-color-input';
    colorPicker.value = this.activeColor;
    colorPicker.addEventListener('input', () => {
      this.activeColor = colorPicker.value;
    });
    this.toolbar.appendChild(colorPicker);

    this.container.appendChild(this.toolbar);

    // --- Canvas container ---
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'daub-canvas-container';

    this.img = document.createElement('img');
    this.img.src = this.screenshot;
    this.img.style.cssText = 'display:block;width:100%;';
    this.canvasContainer.appendChild(this.img);

    this.canvas = document.createElement('canvas');
    this.canvasContainer.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    this.img.addEventListener('load', () => {
      this.syncCanvasSize();
      this.redrawAll();
    });

    // If image is already cached / loaded
    if (this.img.complete && this.img.naturalWidth > 0) {
      this.syncCanvasSize();
      this.redrawAll();
    }

    // Pointer events on canvas
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);

    // ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasCSSSize();
    });
    this.resizeObserver.observe(this.canvasContainer);

    this.container.appendChild(this.canvasContainer);
  }

  unmount(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove active text input if any
    if (this.activeTextInput) {
      this.activeTextInput.remove();
      this.activeTextInput = null;
    }

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

    // Draw all strokes
    this.renderStrokes(offCtx, offscreen.width, offscreen.height);

    return offscreen.toDataURL('image/png');
  }

  hasAnnotations(): boolean {
    return this.strokes.length > 0;
  }

  // ---- Private helpers ----

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

  private selectTool(tool: ToolName): void {
    this.activeTool = tool;
    for (const [name, btn] of this.toolButtons) {
      if (name === 'undo') continue;
      btn.classList.toggle('active', name === tool);
    }
  }

  private updateUndoState(): void {
    if (this.undoBtn) {
      this.undoBtn.style.opacity = this.strokes.length === 0 ? '0.3' : '1';
    }
  }

  private undo(): void {
    if (this.strokes.length === 0) return;
    this.strokes.pop();
    this.redrawAll();
    this.updateUndoState();
  }

  private canvasCoords(e: PointerEvent): { x: number; y: number } {
    return {
      x: (e.offsetX / this.canvas.clientWidth) * this.canvas.width,
      y: (e.offsetY / this.canvas.clientHeight) * this.canvas.height,
    };
  }

  // ---- Pointer event handlers ----

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    const { x, y } = this.canvasCoords(e);

    if (this.activeTool === 'text') {
      this.startTextInput(e, x, y);
      return;
    }

    const lineWidth =
      this.activeTool === 'eraser' ? 20 : 2;

    this.currentStroke = {
      tool: this.activeTool as Stroke['tool'],
      color: this.activeColor,
      lineWidth,
      points: [{ x, y }],
    };

    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    e.preventDefault();
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
    if (!this.currentStroke) return;

    if (this.currentStroke.tool === 'arrow' || this.currentStroke.tool === 'rect') {
      // Finalize with just 2 points: start and end
      const start = this.currentStroke.points[0];
      const end = this.currentStroke.points[this.currentStroke.points.length - 1];
      this.currentStroke.points = [start, end];
    }

    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
    this.redrawAll();
    this.updateUndoState();
  }

  // ---- Text input ----

  private startTextInput(e: PointerEvent, canvasX: number, canvasY: number): void {
    // Remove any existing text input
    if (this.activeTextInput) {
      this.activeTextInput.remove();
      this.activeTextInput = null;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = `
      position:absolute;
      background:transparent;
      border:1px solid var(--daub-accent);
      color:var(--daub-text);
      font:14px monospace;
      outline:none;
      padding:2px 4px;
      min-width:60px;
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
          color: this.activeColor,
          lineWidth: 0,
          points: [{ x: canvasX, y: canvasY }],
          text: value,
          fontSize: 14,
        });
        this.redrawAll();
        this.updateUndoState();
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

    this.canvasContainer.appendChild(input);
    this.activeTextInput = input;
    input.focus();
  }

  // ---- Drawing helpers ----

  private redrawAll(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderStrokes(this.ctx, this.canvas.width, this.canvas.height);
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

    // Arrowhead
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 12;
    const a1 = angle + Math.PI + Math.PI / 6; // +30 degrees from reverse direction
    const a2 = angle + Math.PI - Math.PI / 6; // -30 degrees from reverse direction

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x + headLen * Math.cos(a1), end.y + headLen * Math.sin(a1));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x + headLen * Math.cos(a2), end.y + headLen * Math.sin(a2));
    ctx.stroke();
  }

  private drawRect(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): void {
    ctx.beginPath();
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.stroke();
  }

  private drawTextStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    if (!stroke.text || stroke.points.length === 0) return;
    const fontSize = stroke.fontSize ?? 14;
    // Scale font size relative to canvas resolution
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y + fontSize);
  }
}
