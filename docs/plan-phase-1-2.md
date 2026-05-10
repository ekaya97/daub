# Phase 1: Core + Plugin Skeleton

> Updated to incorporate all v2 amendments (ESM overlay, virtual module fix, build config, etc.)

## Goal
Stand up the pnpm monorepo, create `@daub/core` with shared types and utilities, create `vite-plugin-daub` that injects a script into the dev page, wire up the Vite middleware for file writes, and verify in `examples/react-vite`.

Reference: Spec v1 sections 2-5, 10, 13. Spec v2 sections A1-A6, D1, E1-E4.

---

## 1.1 Files to Create

### Monorepo Root

| File | Purpose |
|---|---|
| `package.json` | Workspace root, `"private": true`, **explicit sequential build** (v2 A6) |
| `pnpm-workspace.yaml` | Declares `packages/*`, `examples/*` |
| `tsconfig.base.json` | `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true` |
| `.gitignore` | `node_modules`, `dist`, `.daub-output/` |
| `.npmrc` | `shamefully-hoist=false` |

### `packages/core`

| File | Purpose |
|---|---|
| `package.json` | `@daub/core` |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | **New (v2 A4):** `format: ['esm', 'cjs']`, `dts: true`, no deps |
| `src/index.ts` | Barrel re-exports |
| `src/types.ts` | All interfaces including **both `DaubOptions` and `DaubConfig` (v2 D1)** |
| `src/serializer.ts` | `serializeToMarkdown()` skeleton |
| `src/styles.ts` | `captureStyles()`, `diffStyles()`, `extractTailwindClasses()` |
| `src/dom-serializer.ts` | **New (v2 F11):** `serializeDOM(el, maxDepth)` depth-limited DOM serializer |

**Important (v2 A4):** `source.ts` does NOT go in core -- it uses DOM APIs and lives in `packages/overlay`.

### `packages/plugin`

| File | Purpose |
|---|---|
| `package.json` | `vite-plugin-daub`, peer dep `vite >=4`, workspace deps on `@daub/core` and `@daub/overlay` |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | **Updated (v2 A1):** includes `onSuccess` hook to copy `overlay/dist/overlay.js` into `plugin/dist/overlay.js` |
| `src/index.ts` | Plugin entry with **corrected virtual module hooks (v2 A2)** |
| `src/types.ts` | Re-exports `DaubOptions` from core |
| `src/middleware.ts` | `handleDaubWrite()` with **CSRF token + path traversal validation (v2 E1-E2)** |
| `src/bootstrap.ts` | **Updated (v2 C2):** injects `window.__DAUB_CONFIG__` with `projectRoot`, `token`, `shortcut`, `writeEndpoint` |

### `packages/overlay`

| File | Purpose |
|---|---|
| `package.json` | **New (v2 A5):** `@daub/overlay`, deps: `html2canvas`, `idb` |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | **ESM format (v2 A1):** `format: ['esm']`, `noExternal: [/.*/]`, `bundle: true`, `treeshake: true` |
| `src/index.ts` | `mountDaub(config: DaubConfig)` -- Phase 1: console.log + shadow DOM host |

### `examples/react-vite`

| File | Purpose |
|---|---|
| `package.json` | React 19, `@vitejs/plugin-react`, `vite`, `vite-plugin-daub` (workspace), Tailwind |
| `vite.config.ts` | React + daub plugins |
| `index.html` | Minimal with `<div id="root">` |
| `src/main.tsx` | ReactDOM.createRoot |
| `src/App.tsx` | Dashboard component (see Example App Strategy) |
| `src/components/*.tsx` | Card, CardGrid, Sidebar, ProfileHeader, GridLayout, ColorSection, Dashboard |
| `tailwind.config.ts` | Standard Tailwind config |

---

## 1.2 Key Implementation Details

### `packages/core/src/types.ts` (v2 D1)

Two distinct types:
```
// What the developer puts in vite.config.ts
DaubOptions {
  enabled?: boolean
  outputDir?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  shortcut?: string          // default: 'Alt+Shift+D'
  modifyGitignore?: boolean  // default: true
}

// What the plugin serializes and passes to the overlay at runtime
DaubConfig {
  position: string
  outputDir: string
  projectRoot: string        // injected by plugin, used for path normalization
  writeEndpoint: string      // '/daub-write' for Vite, '/api/daub-write' for Next.js
  token: string              // CSRF token (crypto.randomUUID)
  shortcut: string
  modifyGitignore: boolean
}
```

Plus: `SourceLocation`, `ElementContext`, `CapturedStyles`, `CssDelta`, `DaubSession`.

### `packages/core/src/dom-serializer.ts` (v2 F11)

New file. `serializeDOM(el: Element, maxDepth = 3, currentDepth = 0): string`

- Filters attributes to allow-list: `id`, `class`, `type`, `href`, `src`, `alt`, `role`, `aria-label`, `data-testid`
- At maxDepth: shows `<!-- N children omitted -->` placeholder
- Leaf elements: show truncated text content (max 100 chars)
- Proper indentation with depth

### `packages/plugin/src/index.ts` (v2 A2)

Virtual module hooks -- corrected:
```
const VIRTUAL_ID = '/@daub/overlay';
const RESOLVED_ID = '\0' + VIRTUAL_ID;  // \0 prefix per Vite convention

resolveId(id) {
  if (id === VIRTUAL_ID) return RESOLVED_ID;
}
load(id) {
  if (id === RESOLVED_ID) {
    // overlay.js copied into plugin/dist at build time
    return readFileSync(resolve(__dirname_esm, 'overlay.js'), 'utf-8');
  }
}
```

Where `__dirname_esm = dirname(fileURLToPath(import.meta.url))`.

### `packages/plugin/tsup.config.ts` (v2 A1)

`onSuccess` hook copies overlay bundle:
```
onSuccess: async () => {
  mkdirSync('dist', { recursive: true });
  copyFileSync(
    resolve(__dirname, '../overlay/dist/overlay.js'),
    resolve(__dirname, 'dist/overlay.js')
  );
}
```

### `packages/plugin/src/bootstrap.ts` (v2 C2)

Injects two script tags:
1. `<script>` in `<head>`: sets `window.__DAUB_CONFIG__` with position, outputDir, projectRoot (`process.cwd()`), writeEndpoint, CSRF token (`crypto.randomUUID()`), shortcut, modifyGitignore
2. `<script type="module">` in `<body>`: `import { mountDaub } from '/@daub/overlay'; mountDaub(window.__DAUB_CONFIG__);`

### `packages/plugin/src/middleware.ts` (v2 E1-E3)

Security hardening:
- **Loopback check:** allow-list of `127.0.0.1`, `::1`, `::ffff:127.0.0.1`
- **CSRF token:** verify `X-Daub-Token` header matches plugin-generated token
- **Path traversal:** validate `sessionId` against `^[a-z0-9_-]{1,64}$`, validate filenames against allow-list (`before.png`, `after.png`, `annotated.png`, `context.md`), verify resolved path `startsWith(outputBase + path.sep)`
- **Size limit:** reject `Content-Length > 50MB`
- **`.gitignore`:** respect `modifyGitignore` option, always log action to console

### Root build script (v2 A6)

Explicit sequential ordering:
```json
"build": "pnpm --filter @daub/core build && pnpm --filter @daub/overlay build && pnpm --filter vite-plugin-daub build && pnpm --filter @daub/next build"
```

---

## 1.3 Dependencies Between Files

```
tsconfig.base.json
    +-- packages/core/ (types, serializer, styles, dom-serializer)
    +-- packages/overlay/ (mountDaub stub, imports DaubConfig from @daub/core)
    +-- packages/plugin/ (imports core types, reads overlay dist)
```

Build order: `core -> overlay -> plugin`

At build time: overlay.js is copied into plugin/dist. At runtime: plugin reads overlay.js from its own dist directory. **No cross-package path resolution needed after npm install** (v2 A1).

---

## 1.4 Testing Strategy

| Test file | What it tests |
|---|---|
| `core/__tests__/serializer.test.ts` | Markdown output with full/partial/null fields |
| `core/__tests__/styles.test.ts` | `diffStyles` identical -> empty, changed -> correct delta |
| `core/__tests__/dom-serializer.test.ts` | Depth limiting, attribute filtering, text truncation |
| `plugin/__tests__/middleware.test.ts` | POST creates files, non-POST -> next(), loopback rejection, **CSRF token validation**, **path traversal rejection**, **size limit** |
| `plugin/__tests__/bootstrap.test.ts` | Script contains `__DAUB_CONFIG__` with all required fields |

---

## 1.5 Verification Steps

1. `pnpm install` succeeds
2. `pnpm build` succeeds (core -> overlay -> plugin sequential)
3. `cd examples/react-vite && pnpm dev` -> console shows `[Daub] loaded`
4. DevTools: `#__daub_host__` exists with shadow root
5. Page source: two injected scripts (config + module import)
6. `window.__DAUB_CONFIG__` contains `projectRoot`, `token`, `shortcut`
7. POST to `/daub-write` with valid token -> files created in `.daub-output/`
8. POST without token -> 403 Forbidden
9. POST with `../` in sessionId -> 400 Invalid session ID
10. `pnpm test` passes

---

---

# Phase 2: Picker + Screenshot

> Updated for v2: persistent screen capture stream, video element frame grab, source resolver in overlay, throttle + cache, bound event handlers.

## Goal
Floating trigger button, element picker with hover highlight, React source resolution, screen capture (stream kept alive per session), html2canvas fallback, element cropping. End-to-end: click button -> hover -> click element -> cropped screenshot in memory.

Reference: Spec v1 sections 4.4, 6.1-6.5, 13. Spec v2 sections B1-B4, C1-C5, F6, F8, F12.

---

## 2.1 Files to Create or Modify

### New files in `packages/overlay/src/`

| File | Purpose |
|---|---|
| `state.ts` | State machine + typed event emitter |
| `styles.ts` | **Single `DAUB_STYLES` const (v2 F9)** -- all CSS as template literal, applied via `adoptedStyleSheets` |
| `TriggerButton.ts` | Floating button (CSS classes, not inline styles) |
| `Picker.ts` | Picker overlay with **bound handlers (v2 F8)**, **tooltip clamping (v2 F6)**, **source throttle (v2 F12)** |
| `capture.ts` | **Revised (v2 B1):** `initScreenCapture()`, `grabFrame()`, `releaseStream()`, `cropToElement()` |
| `DaubApp.ts` | Orchestrator |
| `icons.ts` | SVG icon strings |
| `source.ts` | **Lives in overlay (v2 A4):** `resolveSource()`, `detectFramework()`, React fiber traversal |

### Modified files

| File | What changes |
|---|---|
| `overlay/src/index.ts` | Full `mountDaub` with DaubApp + **`adoptedStyleSheets` (v2 F9)** |
| `overlay/package.json` | Already has `html2canvas` + `idb` deps (Phase 1) |

---

## 2.2 Key Implementation Details

### Shadow DOM styling (v2 F9)

```ts
// In DaubApp.mount():
const sheet = new CSSStyleSheet();
sheet.replaceSync(DAUB_STYLES);
shadow.adoptedStyleSheets = [sheet];
```

All UI elements use CSS classes (e.g., `class="daub-trigger"`, `class="daub-panel"`). Inline styles only for dynamic computed values (position coords, pixel values from getComputedStyle).

### Screen Capture: persistent stream (v2 B1)

Replaces v1's capture-per-click approach:

```
initScreenCapture(): Promise<boolean>
  - Called when user clicks trigger button (enters PICKING state)
  - Requests getDisplayMedia once -> stores stream
  - Returns true if successful, false if denied/unavailable

grabFrame(): Promise<string | null>
  - Called on each element selection
  - Uses video element approach (cross-browser, no ImageCapture API)
  - Returns full-page PNG data URL

releaseStream(): void
  - Called when panel closes or user cancels
  - Stops all tracks
```

**Video element frame grab (v2 B1, replaces ImageCapture):**
- Create `<video>`, set `srcObject = stream`, `play()`, draw frame to canvas, pause, release

**html2canvas fallback (v2 A3):**
- Lazy dynamic import: `const { default: html2canvas } = await import('html2canvas')`
- Called when `initScreenCapture()` returns false
- Scoped to selected element, not full page

### cropToElement (v2 B2)

Uses `window.innerWidth`/`innerHeight` (not `screen.width`). Accounts for `devicePixelRatio` in padding. Clamps crop rect to image bounds.

### Source resolver (v2 A4, C1-C5)

Lives in `packages/overlay/src/source.ts` (not core -- uses DOM APIs).

**Multi-framework (v2 C5):**
```ts
resolveSource(element) = resolveReact(element) ?? resolveVue(element) ?? resolveSvelte(element) ?? null
```

**Path normalization (v2 C2):**
```ts
function normalizePath(absolutePath: string): string {
  const root = window.__DAUB_CONFIG__?.projectRoot ?? '';
  return root ? absolutePath.replace(root + '/', '') : absolutePath;
}
```

### Picker (v2 F6, F8, F12)

**Bound event handlers (v2 F8):**
```ts
private boundMouseMove = this.onMouseMove.bind(this);
private boundClick = this.onClick.bind(this);
private boundKeyDown = this.onKeyDown.bind(this);
// Use same references for add and remove
```

**Tooltip viewport clamping (v2 F6):**
- If `rect.top < 28`: show tooltip below element instead of above
- Horizontal clamp: `Math.min(rect.left, innerWidth - tooltipWidth - 8)`

**Source resolution throttle (v2 F12):**
- WeakMap cache keyed by element reference
- 50ms minimum interval between resolveSource calls
- Cache hit returns instantly

### Shadow DOM element selection (v2 F3)

In picker's click handler, use `composedPath()[0]` to pierce shadow roots. Mousemove highlight still uses `elementFromPoint` (doesn't pierce, documented limitation).

---

## 2.3 Dependencies

```
@daub/core (types, styles, dom-serializer)

@daub/overlay
    +-- index.ts -> DaubApp.ts
        +-- state.ts
        +-- TriggerButton.ts
        +-- Picker.ts (+ source.ts for tooltip labels)
        +-- capture.ts (+ html2canvas lazy import)
        +-- styles.ts (DAUB_STYLES const)
        +-- icons.ts
        +-- source.ts (React/Vue/Svelte resolvers)
```

### Build order: `core -> overlay -> plugin`

---

## 2.4 Testing Strategy

| Test file | What it tests |
|---|---|
| `overlay/__tests__/source.test.ts` | React resolver with mock fibers, multi-framework fallback chain, path normalization |
| `overlay/__tests__/state.test.ts` | State transitions, event emitter |
| `overlay/__tests__/capture.test.ts` | `cropToElement` dimensions with innerWidth, DPR scaling |
| `overlay/__tests__/Picker.test.ts` | Bound handler cleanup, tooltip clamping logic, throttle cache |

---

## 2.5 Verification Steps

1. `pnpm build` succeeds (sequential)
2. Start `examples/react-vite`:
   - Dark circular button bottom-right, CSS class-based styling (not inline)
   - Click button -> **one** permission dialog (Screen Capture API)
   - Hover elements -> indigo highlight + tooltip with component name
   - Tooltip clamps to viewport edges (test top-of-page elements)
   - Click element -> cropped screenshot in console (no second permission dialog)
   - Click another element -> instant screenshot (stream still alive)
   - Escape -> picker closes, **stream released**
3. Test with Screen Capture denied -> html2canvas fallback fires, screenshot still works
4. Verify `window.__DAUB_CONFIG__` has `projectRoot`
5. Source paths in console output are **relative** (not absolute)
6. `#__daub_host__` has `pointer-events: none`, app remains interactive
7. `pnpm test` passes
