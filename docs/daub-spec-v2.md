# Daub — Spec v2: Resolved Amendments
> Companion to daub-spec.md (v1). Read both together.  
> This document overrides v1 wherever they conflict.  
> All 45 open questions from the spec review are resolved here.

---

## How to use this document

Every section below references the original question number(s) from the review. Where code in v1 was wrong, corrected code is provided here and replaces v1. Where v1 had a gap, this document fills it.

At the end of this document: an updated tech stack table and a corrected implementation order.

---

## Part A — Architecture & Build (Questions 1–6, 17–20)

### A1. Overlay build format: ESM, not IIFE (resolves #1, #17)

**Decision:** Change overlay build to ESM format. The IIFE approach in v1 is incompatible with the `import { mountDaub } from '/@daub/overlay'` bootstrap. ESM works correctly with Vite's virtual module system.

**Overlay `tsup.config.ts` (replaces v1):**
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  clean: true,
  minify: true,
  bundle: true,
  noExternal: [/.*/],   // bundle all deps including idb and html2canvas
  splitting: false,
  treeshake: true,
});
```

**Overlay distribution strategy:** At plugin build time, copy `packages/overlay/dist/overlay.js` into `packages/plugin/dist/overlay.js` using a tsup `onSuccess` hook. The plugin then loads it from its own dist — no cross-package path resolution needed at runtime, works identically in monorepo and after npm install.

**Plugin `tsup.config.ts` (replaces v1):**
```ts
import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['vite'],
  onSuccess: async () => {
    // Copy overlay bundle into plugin dist so it's self-contained after npm install
    mkdirSync('dist', { recursive: true });
    copyFileSync(
      resolve(__dirname, '../overlay/dist/overlay.js'),
      resolve(__dirname, 'dist/overlay.js')
    );
    console.log('[daub] overlay.js copied into plugin dist');
  },
});
```

### A2. Virtual module: correct implementation (resolves #2, #3, #4)

**`__dirname` is unavailable in ESM.** Use `fileURLToPath`. Virtual module IDs must be `\0`-prefixed.

**Corrected plugin virtual module hooks (replaces v1):**
```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VIRTUAL_ID = '/@daub/overlay';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// In the plugin object:
resolveId(id: string) {
  if (id === VIRTUAL_ID) return RESOLVED_ID;
},
load(id: string) {
  if (id === RESOLVED_ID) {
    // overlay.js is copied into plugin/dist at build time (see tsup onSuccess above)
    return readFileSync(resolve(__dirname, 'overlay.js'), 'utf-8');
  }
},
```

### A3. html2canvas: bundled, lazy (resolves #5, #37)

**Decision:** Bundle `html2canvas` inside the overlay bundle (already covered by `noExternal: [/.*/]`). Drop the "zero external dependencies" claim from v1 — replace with "self-contained: all dependencies are bundled, no external CDN calls required." The bundle size increase (~50KB gzipped) is acceptable for a dev-only tool. Import lazily inside the fallback path so it does not inflate the baseline:

```ts
// capture.ts — fallback path only
async function html2canvasFallback(element: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: window.devicePixelRatio,
  });
  return canvas.toDataURL('image/png');
}
```

Add to `packages/overlay/package.json`:
```json
"dependencies": {
  "html2canvas": "^1.4.1",
  "idb": "^8.0.0"
}
```

### A4. Core package build config (resolves #6, #19)

`source.ts` uses DOM APIs so it must live in `packages/overlay`, not `packages/core`. Core contains only: types, serializer, style differ, Tailwind class extractor, DOM serializer — all of which are either framework-agnostic or callable in both Node and browser.

**`packages/core/tsup.config.ts` (new):**
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [],  // no deps
});
```

### A5. Overlay `package.json` (resolves #20)

```json
{
  "name": "@daub/overlay",
  "version": "0.1.0",
  "private": false,
  "description": "Browser overlay for vite-plugin-daub",
  "type": "module",
  "main": "dist/overlay.js",
  "exports": {
    ".": "./dist/overlay.js"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "tsup": "^8.x",
    "typescript": "^5.x"
  },
  "license": "MIT"
}
```

### A6. Build order (resolves #18)

Root `package.json` build script — explicit ordering, not parallel:

```json
"scripts": {
  "build": "pnpm --filter @daub/core build && pnpm --filter @daub/overlay build && pnpm --filter vite-plugin-daub build && pnpm --filter @daub/next build",
  "dev": "pnpm --filter @daub/core dev & pnpm --filter @daub/overlay dev",
  "test": "pnpm -r test",
  "lint": "eslint packages/*/src --ext .ts"
}
```

---

## Part B — Browser APIs (Questions 7–11, 34, 40)

### B1. Screen Capture API: request once per session, not per click (resolves #7, #8, #9)

**Problem:** `getDisplayMedia()` triggers a browser permission dialog. Stopping the stream after each grab means a new dialog on every component selection.

**Decision:** Request the stream once when the user activates picker mode (clicks the Daub trigger button). Keep the stream alive across the entire session. Stop tracks only when the panel is fully closed or the user explicitly cancels. This means one permission prompt per Daub session.

**Browser support:**
- Chrome 107+: full support with `preferCurrentTab`
- Firefox: `getDisplayMedia` works but no `preferCurrentTab` — user must select the tab manually from the browser picker (one time)
- Safari: `getDisplayMedia` unavailable — automatic fallback to `html2canvas`

**Cross-browser frame grab — replace `ImageCapture` with video element (resolves #9):**
```ts
// capture.ts
let activeStream: MediaStream | null = null;

export async function initScreenCapture(): Promise<boolean> {
  try {
    activeStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        frameRate: 1,  // low framerate, we only grab frames on demand
      } as any,
      audio: false,
      // Chrome 107+
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as any);
    
    // If user selects wrong tab/window, check
    const settings = activeStream.getVideoTracks()[0].getSettings();
    if ((settings as any).displaySurface !== 'browser') {
      // User selected a window, not a tab — warn but continue
      console.warn('[Daub] Selected a window rather than a browser tab. Cropping may be inaccurate.');
    }
    
    return true;
  } catch (e) {
    // Permission denied or API unavailable
    console.info('[Daub] Screen Capture unavailable, using html2canvas fallback.');
    return false;
  }
}

export async function grabFrame(): Promise<string | null> {
  if (!activeStream) return null;
  
  const track = activeStream.getVideoTracks()[0];
  if (!track || track.readyState === 'ended') return null;

  // Cross-browser: video element approach (works everywhere)
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = activeStream;
    video.onloadedmetadata = async () => {
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      video.pause();
      video.srcObject = null;
      resolve(canvas.toDataURL('image/png'));
    };
    video.onerror = reject;
  });
}

export function releaseStream() {
  activeStream?.getVideoTracks().forEach(t => t.stop());
  activeStream = null;
}
```

**Capture flow revision (replaces v1 `captureScreenshot()`):**

```ts
// When user clicks trigger button:
const hasScreenCapture = await initScreenCapture();

// When user selects a component (on click):
let fullScreenshot: string | null = null;
if (hasScreenCapture) {
  fullScreenshot = await grabFrame();
}
if (!fullScreenshot) {
  // Fallback
  fullScreenshot = await html2canvasFallback(selectedElement);
}
const cropped = await cropToElement(fullScreenshot, selectedElement.getBoundingClientRect(), hasScreenCapture);

// When panel closes:
releaseStream();
```

### B2. cropToElement: use innerWidth, not screen.width (resolves #11, #40)

DevTools docked changes `window.innerWidth/innerHeight`. Use inner dimensions, not screen.

```ts
export function cropToElement(
  fullScreenshot: string,
  rect: DOMRect,
  isScreenCapture: boolean
): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // For screen capture: captured frame covers the viewport
      // Use innerWidth/innerHeight as reference (accounts for docked DevTools)
      const viewW = isScreenCapture ? window.innerWidth : window.innerWidth;
      const viewH = isScreenCapture ? window.innerHeight : window.innerHeight;

      const scaleX = img.width / viewW;
      const scaleY = img.height / viewH;
      const padding = 32 * window.devicePixelRatio;

      const srcX = Math.max(0, (rect.left * scaleX) - padding);
      const srcY = Math.max(0, (rect.top * scaleY) - padding);
      const srcW = Math.min(img.width - srcX, (rect.width * scaleX) + padding * 2);
      const srcH = Math.min(img.height - srcY, (rect.height * scaleY) + padding * 2);

      const canvas = document.createElement('canvas');
      canvas.width = srcW;
      canvas.height = srcH;
      canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = fullScreenshot;
  });
}
```

### B3. Image resizing before POST (resolves #34)

Before writing to disk, resize screenshots to max 2048px on longest axis and convert to JPEG (except annotated layer — keep PNG). Reduces 2–10MB payloads to ~300–800KB.

```ts
// In clipboard.ts, before POST:
async function prepareImage(dataUrl: string, keepPng = false): Promise<string> {
  const img = await createImageBitmap(await fetch(dataUrl).then(r => r.blob()));
  const MAX = 2048;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', 0.88);
}

// Usage:
const beforeResized = await prepareImage(ctx.screenshotBefore);
const afterResized = ctx.screenshotAfter ? await prepareImage(ctx.screenshotAfter) : null;
const annotatedResized = ctx.screenshotAnnotated ? await prepareImage(ctx.screenshotAnnotated, true) : null;
```

Middleware body limit: set to `50mb` explicitly:
```ts
import { json } from 'node:stream/consumers';
// In handleDaubWrite, before parsing: check Content-Length header < 50MB
if (parseInt(req.headers['content-length'] ?? '0') > 50 * 1024 * 1024) {
  res.writeHead(413);
  res.end('Payload too large');
  return;
}
```

### B4. Clipboard: pre-compute blob to preserve user gesture (resolves #10)

```ts
// In clipboard.ts — replace dataUrlToBlob usage:
export async function copyToClipboard(ctx: ElementContext, markdown: string): Promise<void> {
  // Pre-compute blob synchronously before any async gap
  const primaryDataUrl = ctx.screenshotAnnotated ?? ctx.screenshotAfter ?? ctx.screenshotBefore;
  
  // POST files to disk (non-blocking, don't await before clipboard)
  const writePromise = writeFilesToDisk(ctx, markdown);

  // Clipboard write — use ClipboardItem with Promise so browser keeps gesture valid
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': Promise.resolve(new Blob([markdown], { type: 'text/plain' })),
        'image/png': fetch(primaryDataUrl).then(r => r.blob()),
      })
    ]);
  } catch {
    // Safari / fallback: text only
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      showToast('Clipboard write failed. Use the markdown preview to copy manually.', 'error');
      return;
    }
  }

  await writePromise; // Now wait for disk write to complete
  showToast('Copied! Paste into Claude Code.', 'success');
}
```

---

## Part C — Framework Source Resolution (Questions 12–16)

### C1. React version support + `_debugSource` (resolves #12)

**Supported:** React 17, 18, 19. `_debugSource` is populated when Vite's React plugin runs in dev mode with SWC or Babel. Both `@vitejs/plugin-react` and `@vitejs/plugin-react-swc` inject source info in development.

React 19 changes: `_debugSource` shape is the same. The fiber key format (`__reactFiber$`) may vary — the resolver already handles this via `Object.keys(element).find(k => k.startsWith(...))`.

**Test matrix required:** Add `examples/react-17/`, `examples/react-18/`, `examples/react-vite/` (19). CI must run smoke tests against all three.

### C2. Source path normalization: plugin injects project root (resolves #13)

Plugin injects `window.__DAUB_PROJECT_ROOT__` via `transformIndexHtml`. Overlay strips this prefix when building source paths.

**In plugin `transformIndexHtml` hook:**
```ts
transformIndexHtml() {
  const projectRoot = process.cwd().replace(/\\/g, '/'); // normalize Windows paths
  const token = crypto.randomUUID();  // CSRF token (see security section)
  
  // Store token for middleware verification
  this._token = token;
  
  return [
    {
      tag: 'script',
      injectTo: 'head',
      children: `
        window.__DAUB_CONFIG__ = ${JSON.stringify({
          position: opts.position,
          outputDir: opts.outputDir,
          projectRoot,
          writeEndpoint: '/daub-write',
          token,
          shortcut: opts.shortcut ?? 'Alt+Shift+D',
          modifyGitignore: opts.modifyGitignore ?? true,
        })};
      `,
    },
    {
      tag: 'script',
      attrs: { type: 'module' },
      children: `import { mountDaub } from '/@daub/overlay'; mountDaub(window.__DAUB_CONFIG__);`,
      injectTo: 'body',
    }
  ];
}
```

**In overlay source resolver:**
```ts
function normalizePath(absolutePath: string): string {
  const root = (window as any).__DAUB_CONFIG__?.projectRoot ?? '';
  const normalized = absolutePath.replace(/\\/g, '/');
  return root ? normalized.replace(root + '/', '') : normalized;
}
```

### C3. Vue: line 0 is acceptable for v1 (resolves #14)

Document in output as: `**File:** src/components/Card.vue:0 (line info unavailable for Vue)`. No action needed.

### C4. Svelte: mark as experimental (resolves #15)

For v1: Svelte 4 support via `__svelte_component__`, returns file name only. Svelte 5 (runes): returns `(svelte — source unavailable)`. Both degrade gracefully — null source still allows annotation and CSS editing.

Add to docs: "Svelte support is experimental. Source file attribution may be limited."

### C5. Multi-framework detection (resolves #16)

Try all three, return the one with actual source info:

```ts
export function resolveSource(element: HTMLElement): SourceLocation | null {
  return resolveReact(element) 
      ?? resolveVue(element) 
      ?? resolveSvelte(element) 
      ?? null;
}
```

---

## Part D — Type System (Questions 42)

### D1. DaubOptions vs DaubConfig — canonical definitions (resolves #42)

Add to `packages/core/src/types.ts`:

```ts
// What the developer puts in vite.config.ts
export interface DaubOptions {
  enabled?: boolean;
  outputDir?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  shortcut?: string;          // default: 'Alt+Shift+D'
  modifyGitignore?: boolean;  // default: true
}

// What the plugin serializes and passes to the overlay at runtime
export interface DaubConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  outputDir: string;
  projectRoot: string;
  writeEndpoint: string;
  token: string;
  shortcut: string;
  modifyGitignore: boolean;
}
```

---

## Part E — Security (Questions 28–30)

### E1. Localhost verification: explicit allow-list (resolves #28)

```ts
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:127.0.0.1']);

function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  return LOOPBACK.has(addr) || addr === 'localhost';
}
```

**CSRF token verification:** Plugin generates a `crypto.randomUUID()` token on startup, injects it into `window.__DAUB_CONFIG__`, and verifies it on every middleware request via `X-Daub-Token` header:

```ts
// In overlay, every fetch to /daub-write:
headers: {
  'Content-Type': 'application/json',
  'X-Daub-Token': (window as any).__DAUB_CONFIG__.token,
}

// In middleware:
const token = req.headers['x-daub-token'];
if (!isLoopback(req.socket.remoteAddress) || token !== this._token) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

### E2. Path traversal prevention (resolves #29)

```ts
const SESSION_ID_RE = /^[a-z0-9_-]{1,64}$/i;
const ALLOWED_FILES = new Set(['before.png', 'after.png', 'annotated.png', 'context.md']);

// In handleDaubWrite, before any fs operations:
if (!SESSION_ID_RE.test(body.sessionId)) {
  res.writeHead(400); res.end('Invalid session ID'); return;
}

const sessionDir = path.resolve(process.cwd(), outputDir, body.sessionId);
const outputBase = path.resolve(process.cwd(), outputDir);
if (!sessionDir.startsWith(outputBase + path.sep)) {
  res.writeHead(400); res.end('Invalid path'); return;
}

for (const filename of Object.keys(body.files)) {
  if (!ALLOWED_FILES.has(filename)) {
    res.writeHead(400); res.end(`Unexpected file: ${filename}`); return;
  }
}
```

### E3. `.gitignore` modification: logged, opt-outable (resolves #30)

```ts
// In ensureGitignore:
if (!content.includes(outputDir)) {
  if (opts.modifyGitignore) {
    await fs.appendFile(gitignorePath, `\n# Daub output\n${outputDir}/\n`);
    console.log(`[Daub] Added ${outputDir}/ to .gitignore`);
  } else {
    console.warn(`[Daub] Remember to add ${outputDir}/ to your .gitignore`);
  }
}
```

### E4. Session ID: use crypto.randomUUID() (resolves #35)

Replace `capturedAt.toString(36)` with:
```ts
const sessionId = crypto.randomUUID().replace(/-/g, '');
```

Available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) and Node.js 14.17+.

---

## Part F — UX & Interaction (Questions 21–27, 36, 41, 43–45)

### F1. Panel auto-positions to avoid obscuring element (resolves #21)

On element selection, determine panel side based on element position:
```ts
function determinePanelSide(rect: DOMRect): 'left' | 'right' {
  const elementCenter = rect.left + rect.width / 2;
  return elementCenter > window.innerWidth * 0.5 ? 'left' : 'right';
}
```

Panel opens on the side with more space. Add a ⇆ button in panel header to swap sides manually.

### F2. Stale element detection (resolves #22)

In Edit tab, on every control interaction:
```ts
if (!selectedElement.isConnected) {
  showWarningBanner('Component was unmounted during hot reload. Edits paused. Click Re-select to pick again.');
  disableAllControls();
  return;
}
```

No MutationObserver — `isConnected` check on each interaction is sufficient for v1.

Listen for Vite HMR events to warn proactively:
```ts
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => {
    if (currentState === 'PANEL_OPEN' && !selectedElement?.isConnected) {
      showWarningBanner('App updated — selected component may have changed.');
    }
  });
}
```

### F3. Shadow DOM elements (resolves #23)

In picker's click handler, use `composedPath()` to pierce shadow roots:
```ts
private onClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  // composedPath()[0] is the innermost element, even inside shadow roots
  const target = e.composedPath()[0] as HTMLElement;
  if (!target || target === document.body) return;
  this.onSelect(target);
  this.unmount();
}
```

`mousemove` highlight still uses the `elementFromPoint` approach (hide overlay, sample, restore) since `composedPath` on mousemove only gives the overlay element itself. Document: highlighting doesn't pierce shadow roots, but selection (on click) does.

### F4. iframes and cross-origin elements (resolves #24)

Document as known limitation in v1. Same-origin iframes: note in docs that the Daub picker cannot cross frame boundaries; user should install Daub in the iframed app separately if needed.

### F5. Picker blocking interaction (resolves #25)

v1 behavior (full-screen overlay) is correct and intentional. The workflow is: navigate to desired app state → then activate Daub. Document this clearly in the UI via a help tooltip on the trigger button: "Navigate to the state you want to capture, then click to pick a component."

Add a `[?]` icon on the trigger button that shows this tooltip on hover. No Alt+click mode for v1.

### F6. Tooltip viewport clamping (resolves #26)

```ts
// In picker's onMouseMove:
const tooltipHeight = 24;
const showAbove = rect.top > tooltipHeight + 8;
this.tooltip.style.top = showAbove
  ? `${rect.top - tooltipHeight - 4}px`
  : `${rect.bottom + 4}px`;

// Also clamp horizontal position:
const tooltipWidth = this.tooltip.offsetWidth;
const left = Math.min(rect.left, window.innerWidth - tooltipWidth - 8);
this.tooltip.style.left = `${Math.max(8, left)}px`;
```

### F7. Keyboard shortcut: Alt+Shift+D, configurable (resolves #27)

Default: `Alt+Shift+D`. Not a Chrome reserved shortcut. Configurable via `shortcut` option:

```ts
// In DaubOptions:
shortcut?: string; // default: 'Alt+Shift+D'
// Format: modifier keys + key, e.g. 'Ctrl+Shift+D', 'Meta+Shift+D'
```

Shortcut parser:
```ts
function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const needsAlt = parts.includes('Alt');
  const needsShift = parts.includes('Shift');
  const needsCtrl = parts.includes('Ctrl');
  const needsMeta = parts.includes('Meta');
  return e.key === key
    && e.altKey === needsAlt
    && e.shiftKey === needsShift
    && e.ctrlKey === needsCtrl
    && e.metaKey === needsMeta;
}
```

### F8. Event listener cleanup: store bound handlers (resolves #36)

In `Picker` class:
```ts
class Picker {
  // Store bound references so removeEventListener works
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundClick = this.onClick.bind(this);
  private boundKeyDown = this.onKeyDown.bind(this);

  mount(...) {
    this.overlay.addEventListener('mousemove', this.boundMouseMove);
    this.overlay.addEventListener('click', this.boundClick);
    document.addEventListener('keydown', this.boundKeyDown);
  }

  unmount() {
    this.overlay.removeEventListener('mousemove', this.boundMouseMove);
    this.overlay.removeEventListener('click', this.boundClick);
    document.removeEventListener('keydown', this.boundKeyDown);
    this.overlay.remove();
    this.highlight.remove();
    this.tooltip.remove();
  }
}
```

Apply the same pattern to any other class that registers document-level listeners.

### F9. Shadow DOM styles: adoptedStyleSheets (resolves #41)

Do not use inline `Object.assign(el.style, {...})` for component layout. Instead, inject a stylesheet into the shadow root:

```ts
// In DaubApp.mount():
const sheet = new CSSStyleSheet();
sheet.replaceSync(DAUB_STYLES); // DAUB_STYLES is a template literal with all CSS
shadow.adoptedStyleSheets = [sheet];
```

All Daub UI elements use CSS classes (e.g., `class="daub-panel"`, `class="daub-trigger"`). Inline styles only for dynamic values (position coordinates, pixel values computed at runtime). This makes the UI maintainable and reduces JS size.

`DAUB_STYLES` is a single `const` string in a dedicated `styles.ts` file.

### F10. Accessibility basics (resolves #43)

Required for v1:

```ts
// Panel container:
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'Daub component inspector');
panel.setAttribute('aria-modal', 'false'); // not modal — app is still interactive

// Close button:
closeBtn.setAttribute('aria-label', 'Close Daub panel');

// Tab buttons:
tabBtn.setAttribute('role', 'tab');
tabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
tabBtn.setAttribute('aria-controls', `daub-tab-${name}`);

// Tab panels:
tabPanel.setAttribute('role', 'tabpanel');
tabPanel.setAttribute('id', `daub-tab-${name}`);

// Tab keyboard nav: arrow keys switch tabs
tabBar.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') focusNextTab();
  if (e.key === 'ArrowLeft') focusPrevTab();
});

// Focus management: on panel open, focus first interactive element
// On panel close, return focus to trigger button
```

No full focus trap (panel is non-modal, dev should be able to tab into the app). Screen reader support: all buttons have `aria-label`.

### F11. Depth-limited DOM serializer (resolves #44)

Replace `element.outerHTML` with:

```ts
// In packages/core/src/dom-serializer.ts
export function serializeDOM(el: Element, maxDepth = 3, currentDepth = 0): string {
  const tag = el.tagName.toLowerCase();
  
  // Collect only meaningful attributes
  const ALLOWED_ATTRS = ['id', 'class', 'type', 'href', 'src', 'alt', 'role', 'aria-label', 'data-testid'];
  const attrs = ALLOWED_ATTRS
    .filter(a => el.hasAttribute(a))
    .map(a => `${a}="${el.getAttribute(a)}"`)
    .join(' ');

  const attrStr = attrs ? ` ${attrs}` : '';

  if (currentDepth >= maxDepth) {
    const childCount = el.childElementCount;
    return childCount > 0
      ? `<${tag}${attrStr}><!-- ${childCount} child${childCount > 1 ? 'ren' : ''} omitted --></${tag}>`
      : `<${tag}${attrStr}>${el.textContent?.trim().slice(0, 50) ?? ''}</${tag}>`;
  }

  if (el.childElementCount === 0) {
    const text = el.textContent?.trim().slice(0, 100) ?? '';
    return `<${tag}${attrStr}>${text}</${tag}>`;
  }

  const children = Array.from(el.children)
    .map(child => '  '.repeat(currentDepth + 1) + serializeDOM(child, maxDepth, currentDepth + 1))
    .join('\n');
  
  return `<${tag}${attrStr}>\n${children}\n${'  '.repeat(currentDepth)}</${tag}>`;
}
```

### F12. Throttle picker mousemove source resolution (resolves #45)

```ts
// In Picker class:
private sourceCache = new WeakMap<HTMLElement, SourceLocation | null>();
private lastResolveTime = 0;
private readonly RESOLVE_INTERVAL = 50; // ms

private getSource(el: HTMLElement): SourceLocation | null {
  if (this.sourceCache.has(el)) return this.sourceCache.get(el)!;
  
  const now = Date.now();
  if (now - this.lastResolveTime < this.RESOLVE_INTERVAL) return null;
  
  this.lastResolveTime = now;
  const source = resolveSource(el);
  this.sourceCache.set(el, source);
  return source;
}
```

---

## Part G — Next.js Adapter (Questions 38–39)

### G1. Next.js disk write endpoint (resolves #38) — significant gap, now addressed

The Vite middleware does not exist in Next.js. The adapter must provide an endpoint via Next.js API routes. Two sub-cases:

**Pages Router — export from `packages/next/api.ts`:**
```ts
// User adds to pages/api/daub-write.ts:
// export { daubWriteHandler as default } from '@daub/next/api';

import type { NextApiRequest, NextApiResponse } from 'next';
import { handleDaubWriteNode } from '@daub/core/middleware';

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } };

export function daubWriteHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  return handleDaubWriteNode(req, res);
}
```

**App Router — export from `packages/next/app-route.ts`:**
```ts
// User adds to app/api/daub-write/route.ts:
// export { POST } from '@daub/next/app-route';

import { NextRequest, NextResponse } from 'next/server';
import { handleDaubWriteEdge } from '@daub/core/middleware';

export async function POST(req: NextRequest) {
  return handleDaubWriteEdge(req);
}
```

**Overlay config for Next.js:** `writeEndpoint` is `/api/daub-write` instead of `/daub-write`. The `withDaub` wrapper injects this via `window.__DAUB_CONFIG__`:

```ts
// In withDaub:
const daubConfig: DaubConfig = {
  ...defaultConfig,
  writeEndpoint: '/api/daub-write',
};
```

**Setup docs:** Next.js users must add one file (the API route). Document this as a required step with a one-liner. This is a conscious trade-off vs the Vite experience — acceptable for v1.

### G2. Turbopack compatibility (resolves #39)

**Decision:** Turbopack support is out of scope for v1. The webpack entry manipulation (`config.entry`) doesn't work with Turbopack.

Detect and warn:
```ts
// In withDaub webpack function:
if (context.nextRuntime === undefined && !context.webpack) {
  // Turbopack — skip
  console.warn('[Daub] Turbopack detected. Run with --no-turbo for Daub support in v1.');
  return config;
}
```

Document: "Use `next dev --no-turbo` to enable Daub with Next.js App Router in v1."

---

## Part H — Error Handling (Questions 31–33)

### H1. Error handling strategy (resolves #31)

All Daub code is wrapped in try/catch. Daub must **never** throw an uncaught exception into the host app. Errors are handled as follows:

| Error | User-facing behavior | Console |
|---|---|---|
| Screenshot fail | Toast: "Screenshot failed, using fallback" | `[Daub] Screen capture error: {e.message}` |
| html2canvas fail | Toast: "Screenshot unavailable. Context will be text-only." | `[Daub] html2canvas error: {e.message}` |
| Source resolve null | Silent — show "(source unknown)" in output | None |
| Middleware POST fail | Toast: "Files not saved to disk. Copy still works." | `[Daub] Write failed: {status}` |
| IndexedDB unavailable | Silent — history tab hidden | `[Daub] History unavailable (private browsing?)` |
| Clipboard denied | Toast: "Clipboard blocked. Use the markdown preview." | None |
| Element disconnected | Warning banner in Edit tab | None |

All toasts use the same `showToast(message, 'error' | 'success' | 'warning')` API from v1.

Console prefix: all Daub logs use `[Daub]` prefix. No debug logging in production (guard with `import.meta.env.DEV`).

### H2. Testing strategy (resolves #32)

**v1 test scope:**

Unit tests (Vitest):
- `packages/core`: serializer, style differ, Tailwind extractor, DOM serializer
- `packages/core`: `diffStyles` with various before/after inputs
- `packages/plugin`: middleware path traversal validation, session ID validation, gitignore logic

No canvas tests (canvas mocking is complex, not worth it for v1). No Playwright e2e for v1.

**Manual test checklist** (in `CONTRIBUTING.md`):
- [ ] `examples/react-vite`: picker highlights, click selects, screenshot shows element
- [ ] Annotate tab: all tools draw correctly, undo works, canvas exports correctly
- [ ] Edit tab: padding drag updates live, color picker reflects change, CSS delta correct
- [ ] Output tab: thumbnails show, notes text included in markdown, markdown preview matches clipboard
- [ ] Copy: files appear in `.daub-output/`, clipboard contains image + text
- [ ] History: session appears after copy, reloads correctly
- [ ] Escape key cancels picker
- [ ] Keyboard shortcut opens picker

### H3. HMR behavior (resolves #33)

The shadow host (`#__daub_host__`) is appended to `document.body`. Vite HMR replaces component subtrees but does not replace `document.body`. The overlay survives HMR.

Double-mount guard (`if (document.getElementById('__daub_host__')) return`) prevents re-injection on hot reload.

Selected element reference goes stale after HMR — handled by `isConnected` check in Edit tab (see F2 above).

No additional work needed.

---

## Part I — Updated Tech Stack Table

Replaces the table in v1 Section 3:

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | — |
| Build | tsup | ESM+CJS for core/plugin; ESM IIFE-style bundle for overlay |
| Overlay format | ESM (not IIFE) | Served as virtual module by Vite |
| Overlay distribution | Copied into plugin/dist at build time | Works post-npm-install without path resolution |
| Overlay UI | Vanilla TS + Shadow DOM + adoptedStyleSheets | Zero CSS leak |
| Canvas (annotation) | Native HTML5 Canvas API | No deps |
| Screenshot | Screen Capture API, stream kept alive per session | One permission prompt per session |
| Screen Capture fallback | html2canvas (lazy dynamic import, bundled) | Firefox/Safari |
| Frame grab | Video element approach | Cross-browser; no ImageCapture API |
| Source mapping (React) | Fiber traversal via `__reactFiber$` | Works in dev mode, React 17–19 |
| Source mapping (Vue) | `__vueParentComponent` | File only, no line number |
| Source mapping (Svelte) | `__svelte_component__` (v4 only) | Experimental, Svelte 5 not supported |
| Project root injection | `window.__DAUB_CONFIG__.projectRoot` via plugin | Normalizes source paths in browser |
| Session storage | IndexedDB via `idb` (bundled) | Last 20 sessions |
| Disk writes (Vite) | Vite middleware POST at `/daub-write` | localhost + CSRF token protected |
| Disk writes (Next.js) | Next.js API route at `/api/daub-write` | User adds one file |
| Clipboard | `ClipboardItem` with Promise values + text fallback | Preserves user gesture for Safari |
| Image format | JPEG at 0.88 quality, max 2048px | Except annotation layer (PNG) |
| Security | Loopback check + CSRF token (randomUUID per session) + path traversal validation | — |
| Session ID | `crypto.randomUUID()` | Collision-safe |
| Keyboard shortcut | `Alt+Shift+D` (configurable) | — |
| Browser support | Chrome primary; Firefox/Safari via html2canvas | Turbopack: out of scope v1 |
| Accessibility | ARIA roles, keyboard tab nav, focus return on close | Non-modal, no focus trap |
| Package name | `vite-plugin-daub` | Available on npm |

---

## Part J — Updated Implementation Order

Replaces Section 11 in v1. Additions/changes in **bold**.

### Phase 1 — Monorepo + core types (Day 1)
- [ ] pnpm workspace setup
- [ ] `packages/core`: types.ts (DaubOptions, DaubConfig, ElementContext, etc.)
- [ ] `packages/core`: tsup.config.ts
- [ ] **`packages/overlay`: package.json with idb + html2canvas deps**
- [ ] `packages/overlay`: tsup.config.ts (ESM, not IIFE)
- [ ] **Root build script with explicit ordering**
- [ ] `packages/plugin`: plugin skeleton — inject `console.log('[Daub] loaded')`, verify in examples/react-vite

### Phase 2 — Picker + screenshot (Day 1–2)
- [ ] Shadow DOM mount with adoptedStyleSheets
- [ ] Floating trigger button (CSS classes, positioned via config)
- [ ] Picker: overlay, highlight, tooltip with viewport clamping
- [ ] **Screen Capture API: `initScreenCapture()`, `grabFrame()` via video element approach**
- [ ] **`html2canvas` lazy fallback**
- [ ] `cropToElement()` using `innerWidth/innerHeight`
- [ ] Source resolver: React fiber traversal + path normalization
- [ ] **Event listener cleanup with bound instance properties**
- [ ] **`resolveSource` throttle + WeakMap cache**
- [ ] **Virtual module: `\0`-prefixed ID, `__dirname` via `fileURLToPath`**
- [ ] **Plugin injects `window.__DAUB_CONFIG__` with projectRoot + CSRF token**

### Phase 3 — Panel + Annotate tab (Day 2–3)
- [ ] Panel layout (adoptedStyleSheets, slide-in, auto-side detection)
- [ ] **Swap sides button in panel header**
- [ ] Tabs: Annotate, Edit, Output, History (ARIA roles + keyboard nav)
- [ ] Annotate tab: canvas overlay on frozen screenshot
- [ ] All 7 annotation tools (pen, arrow, rect, text, eraser, color, undo)
- [ ] **Tooltip viewport boundary detection**

### Phase 4 — Edit tab (Day 3–4)
- [ ] CSS capture using style props from types.ts
- [ ] Box model section (visual SVG + editable fields, arrow-key increment)
- [ ] Flexbox section (conditional — only when flex detected)
- [ ] Colors, typography, overflow sections
- [ ] Live `element.style.setProperty()` updates
- [ ] **`isConnected` check + warning banner for detached elements**
- [ ] **Vite HMR listener for `vite:afterUpdate`**
- [ ] CSS delta computation on tab leave / copy
- [ ] "After" screenshot on tab leave

### Phase 5 — Output + clipboard (Day 4)
- [ ] `packages/core`: serializer (full markdown template, relative paths)
- [ ] `packages/core`: `serializeDOM()` depth-limited serializer
- [ ] Output tab: thumbnails, delta display, notes textarea, collapsible markdown preview
- [ ] **Image resize + JPEG conversion before POST**
- [ ] **`copyToClipboard()`: ClipboardItem with Promise values + text fallback**
- [ ] **Middleware: localhost check, CSRF token check, path traversal validation, 50MB limit**
- [ ] File writes, gitignore management with logging
- [ ] **`crypto.randomUUID()` for session IDs**

### Phase 6 — History + error handling + polish (Day 5)
- [ ] IndexedDB session store (idb)
- [ ] History tab (thumbnail grid, reopen session)
- [ ] Toast system (success/warning/error)
- [ ] **Full error handling per the strategy table in H1**
- [ ] Vue source resolution
- [ ] Svelte 4 source resolution (marked experimental)
- [ ] Panel resize handle
- [ ] Keyboard shortcut (configurable, default Alt+Shift+D)
- [ ] Help tooltip on trigger button

### Phase 7 — Next.js adapter + docs (Day 5–6)
- [ ] `packages/next`: webpack plugin entry injection
- [ ] **`packages/next/api.ts`: Pages Router handler**
- [ ] **`packages/next/app-route.ts`: App Router handler**
- [ ] **Turbopack detection + warning**
- [ ] `examples/nextjs` working end-to-end
- [ ] Docs (Astro): all pages from v1 spec + Next.js setup docs noting API route requirement
- [ ] GitHub Actions for docs deploy

### Phase 8 — Testing + release
- [ ] Vitest: core serializer, style differ, DOM serializer, middleware validation
- [ ] Manual test checklist passes on `examples/react-vite`
- [ ] Changesets + CI workflow
- [ ] `vite-plugin-daub` and `@daub/next` published to npm
- [ ] GitHub repo public + docs live

---

## Known Limitations (v1 — document in README)

1. **Turbopack**: Not supported. Use `next dev --no-turbo`.
2. **Safari screenshot**: Falls back to html2canvas (may not capture all CSS).
3. **Firefox screenshot**: `getDisplayMedia` works but requires manual tab selection (no `preferCurrentTab`).
4. **Shadow DOM highlighting**: Hover highlight doesn't pierce shadow roots. Click selection does.
5. **iframes**: Cannot select elements inside iframes.
6. **Angular**: Not supported. Browser extension (v1.1) will cover this.
7. **Svelte 5 (runes)**: Source attribution not available.
8. **Vue**: File path only, no line number in source attribution.
9. **webpack (non-Next.js)**: Use the HTTP proxy approach (documented, not packaged for v1).
10. **Next.js write endpoint**: Requires adding one API route file. Not zero-config.
