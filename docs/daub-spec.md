# Daub — Full Implementation Spec
> Visual component context tool for AI-assisted UI development  
> Version: 1.0.0-spec | Status: Ready for implementation

---

## 1. What This Is

Daub is a Vite plugin (+ Next.js adapter + browser extension) that injects a floating widget into your running dev app. The developer clicks any UI component, annotates what's wrong or sketches what they want using a Figma-like editor, then copies a rich context bundle — screenshot, CSS delta, source file location, annotated image — to clipboard. That bundle is pasted into Claude Code (or any AI coding assistant), giving the model precise visual and structural context without the developer having to describe anything in words.

**Core loop:**
1. Click the Daub button (floating, bottom-right)
2. Hover to highlight components → click one to select
3. Screenshot is frozen instantly as "before"
4. Panel opens with two tabs: **Annotate** and **Edit**
5. Annotate: draw on the frozen screenshot (arrows, shapes, text)
6. Edit: manipulate the live component (padding, colors, flex, etc.)
7. Switch to **Output** tab: review and edit the full context bundle
8. Click **Copy to Claude** — done

---

## 2. Repository Structure

```
daub/
├── packages/
│   ├── core/               # Shared types, utilities, serialization
│   ├── plugin/             # Vite plugin (main package)
│   ├── overlay/            # Browser UI — injected into dev app
│   ├── next/               # Next.js adapter
│   └── extension/          # Chrome/Firefox extension (v2, stub for now)
├── docs/                   # GitHub Pages site (Astro or plain HTML)
├── examples/
│   ├── react-vite/
│   ├── vue-vite/
│   └── nextjs/
├── package.json            # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .github/
    └── workflows/
        ├── ci.yml
        └── docs.yml
```

---

## 3. Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces | Standard for plugin ecosystems |
| Build | tsup | Simple, fast, ESM+CJS dual output |
| Overlay UI | Vanilla TS + Shadow DOM | Zero CSS conflict, no framework dep |
| Canvas (annotation) | Native HTML5 Canvas API | No deps, ~300 lines, sufficient |
| Screenshot | Screen Capture API (`preferCurrentTab`) | Pixel-perfect, captures real render |
| Source mapping (React) | Fiber traversal via `__reactFiber$` | No build transform needed in dev mode |
| Source mapping (Vue) | `__vueParentComponent` runtime property | Available in dev mode |
| Source mapping (Svelte) | `element.__svelte_component__` | Available in dev mode |
| Persistent storage | IndexedDB (via `idb` — tiny wrapper) | No permission prompt, origin-scoped |
| Disk writes | Vite middleware POST endpoint | Writes to `.daub-output/` in project root |
| Clipboard output | `navigator.clipboard.write()` | Rich copy: image + text |
| Package name | `vite-plugin-daub` | Clear, available, convention-compliant |

---

## 4. Package: `packages/core`

Shared types and utilities imported by both `plugin` and `overlay`.

### 4.1 Types (`types.ts`)

```ts
export interface SourceLocation {
  file: string;        // absolute path
  line: number;
  column: number;
  componentName: string;
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
}

export interface ElementContext {
  // Source
  source: SourceLocation | null;

  // DOM
  tagName: string;
  domPath: string;           // e.g. "div > section > article.card"
  classList: string[];
  htmlSubtree: string;       // outerHTML of element (depth-limited to 3 levels)

  // Styles
  computedStyles: CapturedStyles;
  tailwindClasses: string[]; // extracted from classList

  // Dimensions
  rect: DOMRect;

  // Screenshots (base64 PNG)
  screenshotBefore: string;
  screenshotAfter: string | null;
  screenshotAnnotated: string | null;

  // Diff
  cssDelta: CssDelta[];

  // Meta
  capturedAt: number;        // Date.now()
  notes: string;             // developer-added text
}

export interface CapturedStyles {
  // Layout
  display: string;
  position: string;
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;

  // Box model
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  margin: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Flexbox
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignSelf: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;

  // Grid
  gridTemplateColumns: string;
  gridTemplateRows: string;

  // Visual
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  borderRadius: string;
  opacity: string;
  overflow: string;
  overflowX: string;
  overflowY: string;

  // Typography
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textOverflow: string;
  whiteSpace: string;
}

export interface CssDelta {
  property: string;
  before: string;
  after: string;
}

export interface DaubSession {
  id: string;               // uuid
  elementContext: ElementContext;
  outputMarkdown: string;   // final assembled markdown
}
```

### 4.2 Serializer (`serializer.ts`)

Converts `ElementContext` into the clipboard markdown string.

```ts
export function serializeToMarkdown(ctx: ElementContext): string
```

Output format (must match exactly):

```markdown
## Component: {componentName}
**File:** {file}:{line}
**Element:** {tagName}.{classList.join('.')}
**DOM path:** {domPath}

---

### Before
> Screenshot saved to: .daub-output/{id}/before.png

### After (your sketch)
> Screenshot saved to: .daub-output/{id}/after.png

### Annotations
> Screenshot saved to: .daub-output/{id}/annotated.png

---

### CSS delta
| Property | Before | After |
|---|---|---|
{cssDelta rows}

### Tailwind classes on element
`{tailwindClasses.join(' ')}`

### DOM subtree (depth 3)
```html
{htmlSubtree}
```

### Notes
{notes || '(none)'}

---
*Generated by Daub — .daub-output/{id}/*
```

If `screenshotAfter` and `screenshotAnnotated` are null (developer didn't edit or annotate), omit those sections.

### 4.3 Style capturer (`styles.ts`)

```ts
export function captureStyles(element: HTMLElement): CapturedStyles
// Calls getComputedStyle, extracts only the properties defined in CapturedStyles

export function diffStyles(before: CapturedStyles, after: CapturedStyles): CssDelta[]
// Returns only properties where before !== after

export function extractTailwindClasses(element: HTMLElement): string[]
// Filters classList to only classes that appear to be Tailwind utility classes
// Heuristic: match against known Tailwind prefixes (p-, m-, flex, grid, bg-, text-, etc.)
// Does NOT require Tailwind to be installed
```

### 4.4 Source resolver (`source.ts`)

Framework detection and fiber/component traversal.

```ts
export function detectFramework(element: HTMLElement): 'react' | 'vue' | 'svelte' | 'unknown'

export function resolveSource(element: HTMLElement): SourceLocation | null
```

**React implementation:**
```ts
function resolveReact(element: HTMLElement): SourceLocation | null {
  // Find __reactFiber$ key (name varies by React version)
  const fiberKey = Object.keys(element).find(k => 
    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (!fiberKey) return null;

  let fiber = (element as any)[fiberKey];
  
  // Walk fiber tree upward looking for _debugSource
  while (fiber) {
    if (fiber._debugSource) {
      return {
        file: fiber._debugSource.fileName,
        line: fiber._debugSource.lineNumber,
        column: fiber._debugSource.columnNumber ?? 0,
        componentName: getComponentName(fiber),
        framework: 'react'
      };
    }
    fiber = fiber.return;
  }
  return null;
}

function getComponentName(fiber: any): string {
  // Walk up to find nearest named component (not DOM element fiber)
  let f = fiber;
  while (f) {
    const type = f.type;
    if (type && typeof type === 'function' && type.name) return type.name;
    if (type && typeof type === 'object' && type.displayName) return type.displayName;
    f = f.return;
  }
  return 'Unknown';
}
```

**Vue implementation:**
```ts
function resolveVue(element: HTMLElement): SourceLocation | null {
  const component = (element as any).__vueParentComponent;
  if (!component) return null;
  
  const file = component.type?.__file;
  if (!file) return null;
  
  return {
    file,
    line: 0,  // Vue doesn't expose line without additional tooling
    column: 0,
    componentName: component.type?.name ?? component.type?.__name ?? 'Unknown',
    framework: 'vue'
  };
}
```

**Svelte implementation:**
```ts
function resolveSvelte(element: HTMLElement): SourceLocation | null {
  // Svelte attaches component info differently per version
  // Try __svelte_component__ (Svelte 4) and $$owner (Svelte 5)
  const comp = (element as any).__svelte_component__ ?? 
                findSvelteAncestor(element);
  if (!comp) return null;
  
  return {
    file: comp.constructor?.name ?? 'Unknown',
    line: 0,
    column: 0,
    componentName: comp.constructor?.name ?? 'Unknown',
    framework: 'svelte'
  };
}
```

---

## 5. Package: `packages/plugin`

The Vite plugin. This is the primary installation surface.

### 5.1 Plugin entry (`index.ts`)

```ts
import type { Plugin } from 'vite';

export interface DaubOptions {
  enabled?: boolean;           // default: process.env.NODE_ENV === 'development'
  outputDir?: string;          // default: '.daub-output'
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'; // default: 'bottom-right'
}

export default function daub(options: DaubOptions = {}): Plugin {
  const opts = {
    enabled: options.enabled ?? true,
    outputDir: options.outputDir ?? '.daub-output',
    position: options.position ?? 'bottom-right',
  };

  return {
    name: 'vite-plugin-daub',
    apply: 'serve',             // ONLY in dev server, never in build
    
    configureServer(server) {
      // Register POST endpoint for disk writes
      server.middlewares.use('/daub-write', handleDaubWrite(opts.outputDir));
    },

    transformIndexHtml() {
      // Inject the overlay bootstrap script
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: generateBootstrapScript(opts),
          injectTo: 'body',
        }
      ];
    }
  };
}
```

### 5.2 Middleware (`middleware.ts`)

Handles file writes from the overlay.

```ts
import type { Connect } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

interface WritePayload {
  sessionId: string;
  files: {
    'before.png'?: string;      // base64
    'after.png'?: string;       // base64
    'annotated.png'?: string;   // base64
    'context.md': string;       // markdown text
  };
}

export function handleDaubWrite(outputDir: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next();

    // Parse JSON body
    const body: WritePayload = await parseBody(req);
    const sessionDir = path.resolve(process.cwd(), outputDir, body.sessionId);
    
    await fs.mkdir(sessionDir, { recursive: true });
    
    // Write each file
    for (const [filename, content] of Object.entries(body.files)) {
      if (!content) continue;
      const filePath = path.join(sessionDir, filename);
      
      if (filename.endsWith('.png')) {
        const buffer = Buffer.from(content, 'base64');
        await fs.writeFile(filePath, buffer);
      } else {
        await fs.writeFile(filePath, content, 'utf-8');
      }
    }

    // Ensure .daub-output is in .gitignore
    await ensureGitignore(outputDir);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: sessionDir }));
  };
}

async function ensureGitignore(outputDir: string) {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes(outputDir)) {
      await fs.appendFile(gitignorePath, `\n# Daub output\n${outputDir}/\n`);
    }
  } catch {
    // .gitignore doesn't exist, create it
    await fs.writeFile(gitignorePath, `# Daub output\n${outputDir}/\n`);
  }
}
```

### 5.3 Bootstrap script generator (`bootstrap.ts`)

Generates the inline script injected into the HTML. This script imports the overlay bundle.

```ts
export function generateBootstrapScript(opts: Required<DaubOptions>): string {
  return `
    import { mountDaub } from '/@daub/overlay';
    mountDaub({
      position: ${JSON.stringify(opts.position)},
      outputDir: ${JSON.stringify(opts.outputDir)},
    });
  `;
}
```

The plugin must also handle the virtual module `/@daub/overlay` — serve the compiled overlay bundle from `packages/overlay/dist/overlay.js`.

```ts
// In the plugin's load hook:
resolveId(id) {
  if (id === '/@daub/overlay') return id;
},
load(id) {
  if (id === '/@daub/overlay') {
    // Return the bundled overlay JS inline
    return fs.readFileSync(
      path.resolve(__dirname, '../overlay/dist/overlay.js'), 
      'utf-8'
    );
  }
}
```

---

## 6. Package: `packages/overlay`

The entire browser-side UI. Compiled to a single self-contained JS bundle. Must have **zero external dependencies at runtime** (all deps bundled in). Uses Shadow DOM for complete CSS isolation.

### 6.1 Entry (`index.ts`)

```ts
export function mountDaub(config: DaubConfig): void {
  // Prevent double-mounting
  if (document.getElementById('__daub_host__')) return;

  // Create shadow host
  const host = document.createElement('div');
  host.id = '__daub_host__';
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  
  // Mount components into shadow root
  const app = new DaubApp(shadow, config);
  app.mount();
}
```

### 6.2 DaubApp state machine

The app has these global states:

```
IDLE → PICKING → CAPTURED → PANEL_OPEN
  ↑                              ↓
  └──────────── CLOSED ──────────┘
```

- **IDLE**: Only the floating trigger button is visible
- **PICKING**: Picker overlay active, hover highlights elements
- **CAPTURED**: Screenshot frozen, panel animating in
- **PANEL_OPEN**: Full panel visible with all tabs

### 6.3 Floating trigger button (`TriggerButton.ts`)

```ts
class TriggerButton {
  private el: HTMLButtonElement;

  constructor(shadow: ShadowRoot, config: DaubConfig) {
    this.el = document.createElement('button');
    this.el.id = 'daub-trigger';
    this.applyStyles(config.position);
    this.el.innerHTML = DaubIcon; // SVG icon
    this.el.setAttribute('aria-label', 'Open Daub');
    this.el.style.pointerEvents = 'auto';
    shadow.appendChild(this.el);
  }

  private applyStyles(position: DaubConfig['position']) {
    const pos: Record<string, string> = {
      bottom: position.includes('bottom') ? '20px' : 'auto',
      top: position.includes('top') ? '20px' : 'auto',
      right: position.includes('right') ? '20px' : 'auto',
      left: position.includes('left') ? '20px' : 'auto',
    };
    
    Object.assign(this.el.style, {
      position: 'fixed',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      background: '#18181b',
      border: '1.5px solid #3f3f46',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'transform 0.15s ease, background 0.15s ease',
      pointerEvents: 'auto',
      ...pos,
    });
  }

  onClick(handler: () => void) {
    this.el.addEventListener('click', handler);
  }
}
```

**Daub icon**: A small paintbrush/daub SVG. Simple, recognizable at 44px.

### 6.4 Picker overlay (`Picker.ts`)

Activated when user clicks the trigger button. Overlays the entire document.

```ts
class Picker {
  private overlay: HTMLDivElement;
  private highlight: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private currentTarget: HTMLElement | null = null;
  private onSelect: (el: HTMLElement) => void;

  mount(document: Document, onSelect: (el: HTMLElement) => void) {
    this.onSelect = onSelect;

    // Full-screen transparent overlay to intercept events
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      cursor: 'crosshair',
    });

    // Highlight box
    this.highlight = document.createElement('div');
    Object.assign(this.highlight.style, {
      position: 'fixed',
      border: '2px solid #6366f1',       // indigo
      background: 'rgba(99,102,241,0.08)',
      borderRadius: '3px',
      pointerEvents: 'none',
      transition: 'all 0.08s ease',
      zIndex: '2147483646',
      display: 'none',
    });

    // Tooltip showing component name + file
    this.tooltip = document.createElement('div');
    Object.assign(this.tooltip.style, {
      position: 'fixed',
      background: '#18181b',
      color: '#e4e4e7',
      fontSize: '11px',
      fontFamily: 'monospace',
      padding: '3px 8px',
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex: '2147483647',
      display: 'none',
      whiteSpace: 'nowrap',
    });

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.highlight);
    document.body.appendChild(this.tooltip);

    this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.overlay.addEventListener('click', this.onClick.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this)); // Escape to cancel
  }

  private onMouseMove(e: MouseEvent) {
    // Hide overlay temporarily to get element underneath
    this.overlay.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    this.overlay.style.display = '';

    if (!el || el === document.body || el === document.documentElement) return;

    this.currentTarget = el;
    const rect = el.getBoundingClientRect();

    // Update highlight
    Object.assign(this.highlight.style, {
      display: 'block',
      top: `${rect.top - 1}px`,
      left: `${rect.left - 1}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    // Update tooltip
    const source = resolveSource(el);
    const label = source 
      ? `${source.componentName} · ${source.file.split('/').pop()}:${source.line}`
      : el.tagName.toLowerCase();
    
    this.tooltip.textContent = label;
    this.tooltip.style.display = 'block';
    this.tooltip.style.top = `${rect.top - 28}px`;
    this.tooltip.style.left = `${rect.left}px`;
  }

  private async onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.currentTarget) return;
    this.onSelect(this.currentTarget);
    this.unmount();
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.unmount();
  }

  unmount() {
    this.overlay.remove();
    this.highlight.remove();
    this.tooltip.remove();
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
  }
}
```

### 6.5 Screenshot capture (`capture.ts`)

Called immediately on element selection, before the panel opens.

```ts
export async function captureScreenshot(): Promise<string> {
  // Use Screen Capture API with preferCurrentTab
  // This skips the OS picker and captures the current tab directly
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'browser',
      width: { ideal: window.screen.width * devicePixelRatio },
      height: { ideal: window.screen.height * devicePixelRatio },
    },
    // @ts-ignore — preferCurrentTab is Chrome 107+
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  });

  const track = stream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(track);
  const bitmap = await imageCapture.grabFrame();
  track.stop();

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  return canvas.toDataURL('image/png');
}

export function cropToElement(fullScreenshot: string, rect: DOMRect): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scaleX = img.width / window.screen.width;
      const scaleY = img.height / window.screen.height;
      const padding = 32;

      const canvas = document.createElement('canvas');
      canvas.width = (rect.width + padding * 2) * scaleX;
      canvas.height = (rect.height + padding * 2) * scaleY;
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(
        img,
        (rect.left - padding) * scaleX,
        (rect.top - padding) * scaleY,
        canvas.width,
        canvas.height,
        0, 0, canvas.width, canvas.height
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = fullScreenshot;
  });
}
```

**Fallback for browsers without `preferCurrentTab`**: If `getDisplayMedia` is unavailable or fails, fall back to `html2canvas` scoped to the selected element. Import `html2canvas` lazily (dynamic import) so it doesn't inflate the bundle when not needed.

### 6.6 Panel (`Panel.ts`)

The main panel. Slides in from the right (or bottom on narrow viewports). Does not take over the screen — developer can still see the app behind it.

**Panel layout:**
```
┌─────────────────────────────────────────────┐
│  daub  [ComponentName · file.tsx:42]    [×] │  ← header
├──────────────────────────────────────────────┤
│  [Annotate]  [Edit]  [Output]                │  ← tabs
├──────────────────────────────────────────────┤
│                                              │
│  [tab content — see below]                  │
│                                              │
├──────────────────────────────────────────────┤
│  [Copy to Claude]            [Clear]         │  ← footer
└─────────────────────────────────────────────┘
```

**Panel dimensions:** 420px wide, 100vh tall, fixed right-0. On viewports < 640px: full-width, 60vh tall, fixed bottom-0.

**Panel styles:** Dark theme (#18181b background, #27272a borders, #e4e4e7 text). Matches Claude Code's terminal aesthetic.

**Header:** Shows component name + file:line from source resolution. If source unavailable, shows element tag + class.

**Resize handle:** 4px drag handle on the left edge of the panel allowing developer to widen it.

### 6.7 Annotate tab (`AnnotateTab.ts`)

Shows the frozen "before" screenshot with a canvas layer on top for drawing.

```
┌────────────────────────────────┐
│ [pen] [arrow] [rect] [text]   │  ← toolbar
│ [eraser] [color] [undo]       │
├────────────────────────────────┤
│                                │
│   [screenshot as img]          │
│   [canvas overlay on top]      │
│                                │
└────────────────────────────────┘
```

**Tools:**
- **Pen** — freehand draw, follows pointer. Stroke width: 2px. Default color: #ef4444 (red).
- **Arrow** — click drag to draw arrow. Arrowhead at endpoint.
- **Rect** — click drag to draw rectangle (outline only, 2px stroke).
- **Text** — click to place text label. Opens inline text input at position.
- **Eraser** — freehand erase.
- **Color picker** — native `<input type="color">` for stroke color.
- **Undo** — pops last drawn stroke (maintain strokes as array of path objects).

**Canvas implementation:**
- Canvas positioned absolutely over the screenshot image, same dimensions
- Mouse/pointer events on canvas
- Each stroke stored as `{ tool, color, points: [x,y][], text? }` in an array
- Undo removes last element from array and redraws

**Capture method:** When switching to Output tab or hitting Copy, call `canvas.toDataURL('image/png')` to get the annotated image.

### 6.8 Edit tab (`EditTab.ts`)

Shows the live component (not a screenshot) with CSS editing controls.

```
┌───────────────────────────────────────┐
│ LIVE COMPONENT PREVIEW               │
│ [the actual element, visible through │
│  the panel — element is highlighted  │
│  with a subtle overlay in the page]  │
│                                      │
│ CSS CONTROLS                         │
│ ┌──────────────────────────────────┐ │
│ │ Box Model                        │ │
│ │  [visual box model diagram]      │ │
│ │  P: [8] [8] [8] [8] ← padding  │ │
│ │  M: [0] [16] [0] [0] ← margin  │ │
│ │  W: [320px]  H: [auto]          │ │
│ ├──────────────────────────────────┤ │
│ │ Flexbox (shown if flex parent)   │ │
│ │  Dir: [row ▾] Wrap: [no ▾]      │ │
│ │  Justify: [flex-start ▾]         │ │
│ │  Align: [stretch ▾]              │ │
│ │  Gap: [────●────] 8px            │ │
│ ├──────────────────────────────────┤ │
│ │ Colors                           │ │
│ │  BG: [■ #ffffff] Text: [■ #000] │ │
│ │  Border: [■ #e5e7eb]             │ │
│ ├──────────────────────────────────┤ │
│ │ Typography                       │ │
│ │  Size: [14px] Weight: [400]     │ │
│ │  Line-height: [1.5]              │ │
│ ├──────────────────────────────────┤ │
│ │ Overflow                         │ │
│ │  [visible ▾]                     │ │
│ └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

**Edit mechanics:** Changes applied directly via `element.style.setProperty()` on the selected element. This modifies the live DOM immediately. The visual update is instant because the actual element is still rendered in the page behind the panel.

**Box model diagram:** An SVG showing margin > border > padding > content boxes. Clicking any numeric field makes it editable. Arrow-key support for incrementing (+1 / +10 with shift).

**Flex controls:** Only shown when `getComputedStyle(element).display === 'flex'` OR `getComputedStyle(element.parentElement).display === 'flex'`. Show both element-as-container and element-as-child controls as appropriate.

**Color pickers:** Native `<input type="color">`. For background/text/border, display a color swatch preview next to the hex value.

**Typography sliders:** Range inputs for font-size (8-72px), font-weight (100-900 step 100), line-height (1.0-3.0 step 0.1).

**Overflow dropdown:** `<select>` with options: visible, hidden, scroll, auto.

**State tracking:** On mount, capture `originalStyles = captureStyles(element)`. On tab switch or Copy, compute `cssDelta = diffStyles(originalStyles, captureStyles(element))`.

**"After" screenshot:** Taken when the developer leaves the Edit tab or clicks Copy. Uses the same `captureScreenshot()` + `cropToElement()` flow, capturing the modified state of the live element.

### 6.9 Output tab (`OutputTab.ts`)

The review and edit layer before copying.

```
┌──────────────────────────────────────────┐
│ BEFORE                    AFTER          │
│ [thumbnail 180px]   [thumbnail 180px]   │
│                      (if annotations    │
│                       or edits made)    │
├──────────────────────────────────────────┤
│ ANNOTATIONS                              │
│ [thumbnail 180px — annotated image]     │
│ (only shown if annotations drawn)        │
├──────────────────────────────────────────┤
│ CSS DELTA                                │
│ padding: 8px → 24px                     │
│ gap: 4px → 16px                         │
│ (none if no edits)                       │
├──────────────────────────────────────────┤
│ NOTES                                    │
│ [textarea — placeholder: "Add context   │
│  for Claude..."]                         │
├──────────────────────────────────────────┤
│ MARKDOWN PREVIEW (collapsed by default) │
│ [▶ Show full output]                     │
│ (expands to show raw markdown)           │
└──────────────────────────────────────────┘
```

The "Notes" textarea content is included in the serialized markdown under the `### Notes` section.

The collapsed markdown preview shows the exact text that will go to clipboard. Developer can expand to verify or copy manually.

### 6.10 Copy to Claude (`clipboard.ts`)

```ts
export async function copyToClipboard(
  ctx: ElementContext,
  markdown: string
): Promise<void> {
  // First: POST to Vite middleware to write files to disk
  const sessionId = ctx.capturedAt.toString(36);
  
  await fetch('/daub-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      files: {
        'before.png': ctx.screenshotBefore,
        ...(ctx.screenshotAfter ? { 'after.png': ctx.screenshotAfter } : {}),
        ...(ctx.screenshotAnnotated ? { 'annotated.png': ctx.screenshotAnnotated } : {}),
        'context.md': markdown,
      }
    })
  });

  // Then: copy markdown to clipboard
  // Also attempt to copy the "after" or "before" image as image/png
  // so pasting into tools that accept images works
  const primaryImage = ctx.screenshotAnnotated ?? ctx.screenshotAfter ?? ctx.screenshotBefore;
  const imageBlob = await dataUrlToBlob(primaryImage);
  
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([markdown], { type: 'text/plain' }),
        'image/png': imageBlob,
      })
    ]);
  } catch {
    // Fallback: text only
    await navigator.clipboard.writeText(markdown);
  }

  // Show toast: "Copied! Paste into Claude Code."
  showToast('Copied! Paste into Claude Code.');
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then(r => r.blob());
}
```

### 6.11 Session history (`history.ts`)

IndexedDB store for the last 20 captures. Uses the `idb` npm package (2.3kb gzipped).

```ts
import { openDB } from 'idb';

const DB_NAME = 'daub';
const STORE = 'sessions';
const MAX_SESSIONS = 20;

export async function saveSession(session: DaubSession): Promise<void>
export async function getSessions(): Promise<DaubSession[]>  // newest first
export async function getSession(id: string): Promise<DaubSession | undefined>
export async function deleteSession(id: string): Promise<void>
```

**History tab** (fourth tab, icon-only in tab bar): Grid of thumbnail cards, each showing the before screenshot, component name, and timestamp. Clicking a card reopens that capture in the panel for re-editing or re-copying.

### 6.12 Toast notification (`Toast.ts`)

Simple fixed-position toast for success/error feedback.

```ts
export function showToast(message: string, type: 'success' | 'error' = 'success'): void
```

Appears bottom-center, auto-dismisses after 2.5s, slide-up animation.

---

## 7. Package: `packages/next`

Next.js adapter. Wraps the core overlay for Next.js apps using webpack or Turbopack.

### 7.1 `next.config.js` plugin

```ts
// packages/next/index.ts
export function withDaub(nextConfig: any = {}, options: DaubOptions = {}) {
  return {
    ...nextConfig,
    webpack(config: any, context: any) {
      if (context.dev && !context.isServer) {
        // Inject daub entry point
        const originalEntry = config.entry;
        config.entry = async () => {
          const entries = await originalEntry();
          // Add daub bootstrap to main entry
          if (entries['main.js']) {
            entries['main.js'] = [
              ...entries['main.js'],
              require.resolve('@daub/next/client'),
            ];
          }
          return entries;
        };
      }
      
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, context);
      }
      return config;
    }
  };
}
```

### 7.2 Client entry (`client.ts`)

```ts
// Mounts Daub in Next.js app router and pages router
import { mountDaub } from 'vite-plugin-daub/overlay';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}

function mount() {
  mountDaub({ position: 'bottom-right', outputDir: '.daub-output' });
}
```

### 7.3 Source resolution for Next.js

Next.js App Router (React 18+): Standard fiber traversal works. `_debugSource` is available in dev mode.

Next.js Pages Router: Same.

Next.js with Turbopack: Fiber traversal works. `_debugSource` may have different path formats — normalize to relative paths from `process.cwd()`.

---

## 8. Package: `packages/extension` (stub)

Chrome/Firefox extension for universal fallback (non-Vite, non-Next.js apps).

**v1 scope:** Stub only. Create the manifest, basic content script structure, and a README explaining it's coming. Do not implement functionality in v1.

```
extension/
├── manifest.json      # Chrome MV3
├── content.ts         # Stub: logs "Daub extension loaded"
├── background.ts      # Stub
└── README.md          # "Full extension support coming in v1.1"
```

---

## 9. Docs site (`docs/`)

**Technology:** Astro (static, zero JS by default, fast). Deployed to GitHub Pages via GitHub Actions.

**Pages:**

```
/                  # Landing page
/docs/             # Getting started
/docs/vite         # Vite installation
/docs/nextjs       # Next.js installation  
/docs/output       # Understanding the output format
/docs/faq          # FAQ
```

### 9.1 Landing page sections

1. **Hero** — "Show Claude what you mean. Stop describing UI bugs." + demo GIF/video
2. **How it works** — 3-step visual: Click → Sketch → Copy
3. **Install** — single code block: `npm install -D vite-plugin-daub`
4. **Output format** — shows an example of the markdown Claude receives
5. **FOSS badge** — MIT license, GitHub link

### 9.2 Getting started (`/docs/`)

```md
## Installation (Vite)

npm install -D vite-plugin-daub

## vite.config.ts

import { defineConfig } from 'vite'
import daub from 'vite-plugin-daub'

export default defineConfig({
  plugins: [daub()]
})

That's it. Start your dev server and look for the ◉ button in the bottom-right corner.
```

### 9.3 GitHub Actions (`.github/workflows/docs.yml`)

```yaml
name: Deploy docs
on:
  push:
    branches: [main]
    paths: ['docs/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd docs && npm ci && npm run build
      - uses: actions/deploy-pages@v4
```

---

## 10. Build Configuration

### 10.1 Root `package.json`

```json
{
  "name": "daub",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "lint": "eslint packages/*/src --ext .ts",
    "changeset": "changeset",
    "release": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.x",
    "eslint": "^9.x",
    "typescript": "^5.x",
    "tsup": "^8.x"
  }
}
```

### 10.2 `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'docs'
  - 'examples/*'
```

### 10.3 `packages/plugin/tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['vite'],
});
```

### 10.4 `packages/overlay/tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],          // Single self-contained bundle
  globalName: 'DaubOverlay',
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  clean: true,
  minify: true,
  bundle: true,              // Bundle all deps including idb
  noExternal: [/.*/],        // No external deps — everything bundled
});
```

### 10.5 `packages/plugin/package.json`

```json
{
  "name": "vite-plugin-daub",
  "version": "0.1.0",
  "description": "Visual component context tool for AI-assisted UI development",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "keywords": ["vite", "vite-plugin", "ai", "devtools", "claude", "ui"],
  "peerDependencies": {
    "vite": ">=4.0.0"
  },
  "dependencies": {
    "@daub/core": "workspace:*",
    "@daub/overlay": "workspace:*"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  },
  "license": "MIT"
}
```

---

## 11. Implementation Order

Build in this sequence. Each phase is a working, usable milestone.

### Phase 1 — Core + Plugin skeleton (Day 1)

- [ ] Set up pnpm monorepo
- [ ] `packages/core`: types, serializer skeleton
- [ ] `packages/plugin`: Vite plugin that injects a `console.log('Daub loaded')` script
- [ ] Verify injection works in a `examples/react-vite` app
- [ ] Vite middleware for file writes

### Phase 2 — Picker + screenshot (Day 1-2)

- [ ] `packages/overlay`: Shadow DOM mount
- [ ] Floating trigger button (styled, correct positioning)
- [ ] Picker overlay (hover highlight, tooltip, click to select)
- [ ] Source resolver (React fiber only for now)
- [ ] Screen Capture API screenshot + crop
- [ ] `html2canvas` fallback
- [ ] Verify: clicking a component produces a cropped screenshot

### Phase 3 — Panel + Annotate tab (Day 2-3)

- [ ] Panel layout (slide-in, tabs, header, footer)
- [ ] Annotate tab: frozen screenshot + canvas overlay
- [ ] All annotation tools (pen, arrow, rect, text, eraser, color, undo)
- [ ] Verify: can draw on the screenshot

### Phase 4 — Edit tab (Day 3-4)

- [ ] CSS property capture
- [ ] Box model section (visual + editable fields, live update)
- [ ] Flexbox section (conditional display, controls)
- [ ] Colors section (color pickers)
- [ ] Typography section (sliders)
- [ ] Overflow section (dropdown)
- [ ] CSS delta computation
- [ ] "After" screenshot capture on tab leave

### Phase 5 — Output + clipboard (Day 4)

- [ ] `packages/core`: serializer (full markdown template)
- [ ] Output tab (thumbnails, CSS delta display, notes textarea, markdown preview)
- [ ] Clipboard write (rich: image + text)
- [ ] File writes via Vite middleware
- [ ] `.gitignore` management

### Phase 6 — History + polish (Day 5)

- [ ] IndexedDB session store
- [ ] History tab (thumbnail grid, reopen)
- [ ] Toast notifications
- [ ] Vue source resolution
- [ ] Svelte source resolution
- [ ] Panel resize handle
- [ ] Keyboard shortcuts (Escape to cancel, Cmd+Shift+D to open)
- [ ] All CSS polished to match spec

### Phase 7 — Next.js adapter + docs (Day 5-6)

- [ ] `packages/next`: webpack plugin + client entry
- [ ] `examples/nextjs` working
- [ ] Docs site (Astro, all pages)
- [ ] GitHub Actions for docs deploy
- [ ] README.md (install, usage, options, output format)

### Phase 8 — Release prep

- [ ] Changesets configured
- [ ] CI workflow (build, lint on PR)
- [ ] `vite-plugin-daub` published to npm
- [ ] `@daub/next` published to npm
- [ ] GitHub repo public
- [ ] Docs live at GitHub Pages

---

## 12. Non-goals (explicitly out of scope for v1)

- MCP server integration
- Angular support
- Chrome/Firefox extension functionality (stub only)
- Cloud sync or sharing of captures
- Any telemetry or analytics
- React Native
- Webpack standalone (non-Next.js) — proxy approach deferred to v1.1
- Figma plugin
- Direct code writing (Daub only captures context — it does not modify source files)

---

## 13. Key constraints for implementation

1. **The overlay bundle must be zero-dependency at runtime** except for `idb` (bundled in). No React, no Vue, no framework. Pure TypeScript compiled to vanilla JS.

2. **Never activate in production.** The Vite plugin uses `apply: 'serve'`. The overlay script must also check `import.meta.env.DEV` before mounting.

3. **Shadow DOM is non-negotiable.** All overlay UI lives inside a shadow root. No styles leak out, no host app styles leak in.

4. **Screen Capture API permission is requested lazily.** Only ask when the user actually clicks a component (not on plugin load). If denied, fall back to html2canvas silently.

5. **The Vite middleware POST endpoint must be protected.** Reject requests not originating from `localhost`. Check `req.socket.remoteAddress` is loopback.

6. **File paths in the output markdown must be relative to the project root**, not absolute system paths. Strip `process.cwd()` prefix before serializing.

7. **CSS delta should only include changed properties.** Do not include properties that are identical before and after. An unchanged state produces an empty delta section — in that case, omit the delta section from the markdown entirely.

8. **The panel must not prevent interaction with the app.** Use `pointer-events: none` on the host container; only the panel itself and the trigger button have `pointer-events: auto`. The developer should be able to navigate the app, trigger states, and then open the panel — the panel is additive, not modal.
