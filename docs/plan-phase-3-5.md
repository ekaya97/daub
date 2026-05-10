# Phase 3: Panel + Annotate Tab

> Updated for v2: adoptedStyleSheets, auto-side panel positioning, ARIA/keyboard accessibility, tooltip clamping.

## Overview

Side-panel UI + Annotate tab with canvas drawing. After this phase: select component -> frozen screenshot in panel -> draw annotations.

## Prerequisites
- Phase 1-2 complete
- `adoptedStyleSheets` pattern established (v2 F9)
- DaubApp state machine, TriggerButton, Picker, capture all working

---

## Files to Create

### 3.1 `packages/overlay/src/Panel.ts`

Fixed panel that slides in from left or right **based on element position (v2 F1)**.

**Auto-positioning (v2 F1):**
```ts
function determinePanelSide(rect: DOMRect): 'left' | 'right' {
  return (rect.left + rect.width / 2) > window.innerWidth * 0.5 ? 'left' : 'right';
}
```
Panel opens on the side with more space. **Swap-sides button** (⇆) in panel header for manual override.

**Dimensions:** 420px wide, 100vh tall. < 640px viewport: full-width, 60vh, bottom-docked.

**Styling:** All via CSS classes in `DAUB_STYLES` (adoptedStyleSheets). Dark theme tokens:
- `--daub-bg: #18181b`, `--daub-bg-surface: #27272a`, `--daub-border: #3f3f46`
- `--daub-text: #e4e4e7`, `--daub-text-muted: #a1a1aa`
- `--daub-accent: #6366f1`, `--daub-accent-hover: #818cf8`, `--daub-danger: #ef4444`

**Accessibility (v2 F10):**
```ts
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'Daub component inspector');
panel.setAttribute('aria-modal', 'false');  // non-modal, app still interactive
```
- Tab buttons: `role="tab"`, `aria-selected`, `aria-controls`
- Tab panels: `role="tabpanel"`, matching `id`
- Arrow keys switch tabs in tab bar
- On open: focus first interactive element. On close: return focus to trigger button.
- **No focus trap** (non-modal).

**Header:** "daub" brand + component name + file:line + **swap-sides button** + close button
**Tab bar:** Annotate, Edit, Output, History (icon-only) -- 4 tabs
**Footer:** "Copy to Claude" primary + "Clear" text button, sticky bottom
**Resize handle:** 4px drag zone on panel edge, min 320px / max 80vw, persists in localStorage
**Animation:** `translateX(100%)` or `translateX(-100%)` -> `translateX(0)` over 200ms

---

### 3.2 `packages/overlay/src/tabs/AnnotateTab.ts`

Frozen "before" screenshot + canvas overlay for drawing.

**Toolbar:** Pen, Arrow, Rect, Text, Eraser (24x24 icon buttons). Color picker (`<input type="color">`  default `#ef4444`). Undo button.

**Canvas:** `<img>` + `<canvas>` absolutely positioned on top. DPR-aware: `canvas.width = display * devicePixelRatio`, `ctx.scale(dpr, dpr)`.

**Stroke model:**
```
Stroke { tool, color, lineWidth, points: {x,y}[], text?, fontSize? }
```
Strokes array. On mutation: clear + redraw all (correct undo approach).

**Tools:**
1. Pen -- freehand, 2px, lineCap/lineJoin round
2. Arrow -- click-drag, arrowhead at endpoint (+/-30deg, 12px)
3. Rect -- click-drag outline, 2px stroke, no fill
4. Text -- click to place input, Enter/blur adds stroke, 14px monospace
5. Eraser -- `globalCompositeOperation: 'destination-out'`, 20px width
6. Undo -- pop last, redraw

**`getAnnotatedImage()`:** Offscreen canvas at full image resolution. Null if no strokes.

**Events:** PointerEvents (not MouseEvents) for stylus/touch. PreventDefault on all canvas pointers.

**Edge cases:** ResizeObserver for panel resize. Strokes preserved on instance across tab switches.

---

### 3.3-3.4 `EditTabStub.ts`, `OutputTabStub.ts`

Temporary placeholders for Phases 4 and 5.

---

### 3.5 Style updates to `DAUB_STYLES`

Add panel and annotate CSS to the single `DAUB_STYLES` template literal. All layout via CSS classes in `adoptedStyleSheets`. Dynamic values (panel position, highlight coords) as inline styles only.

---

### 3.6 Modifications to existing files

**`DaubApp.ts`:**
- Import Panel, instantiate on CAPTURED -> PANEL_OPEN transition
- Build `ElementContext` from selected element
- Wire Panel.onClose -> transition to IDLE, `releaseStream()`
- **Help tooltip (v2 F5):** `[?]` icon on trigger button: "Navigate to desired state, then click to pick."

---

## Testing

- Stroke undo: push 3, undo, verify length 2
- Panel tab switching: unmount/mount lifecycle
- Arrow geometry: arrowhead angles
- **Panel side auto-detection**: element on right -> panel opens left
- Manual: all annotation tools, resize, Escape, tab switching

## Verification

1. Click trigger -> select component -> panel slides in (correct side)
2. Swap-sides button moves panel
3. Header shows component name + file:line
4. All 6 annotation tools work
5. Undo, color change, canvas resize on panel resize
6. Close via X, Escape, both return focus to trigger
7. Tab bar: arrow keys switch tabs, ARIA attributes present
8. < 640px viewport: bottom-docked

---

---

# Phase 4: Edit Tab

> Updated for v2: isConnected check, HMR listener, adoptedStyleSheets.

## Overview

Replace EditTabStub with full CSS editing interface. Live manipulation via `element.style.setProperty()`.

## Prerequisites
- Phase 1-3 complete
- `captureStyles()` and `diffStyles()` in core fully implemented

---

## Files to Create

### 4.1 `packages/overlay/src/tabs/EditTab.ts`

**Key methods:** `mount()`, `unmount()`, `getCssDelta()`, `captureAfterScreenshot()`, `hasEdits()`, `resetEdits()`

On mount:
- Capture `originalStyles = captureStyles(element)`
- Add dashed indigo highlight overlay on live element (in main document)
- Render subsections in scrollable container
- Track `dirty: boolean` flag

**Stale element detection (v2 F2):**
```ts
// On every control interaction:
if (!this.element.isConnected) {
  showWarningBanner('Component was unmounted. Edits paused. Click Re-select to pick again.');
  disableAllControls();
  return;
}
```

**HMR listener (v2 F2):**
```ts
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => {
    if (!this.element?.isConnected) {
      showWarningBanner('App updated — selected component may have changed.');
    }
  });
}
```

On unmount: remove highlight overlay, stop RAF loop. Do NOT revert CSS changes.

`resetEdits()`: remove all inline overrides, reset dirty, re-render controls.

**Edge cases:** "Scroll to element" link when off-screen (`scrollIntoView`).

---

### 4.2 `BoxModelSection.ts`

SVG box model diagram + editable inputs (40px, monospace, transparent bg).
- Arrow keys: +/-1, Shift +/-10, live updates
- Width/Height: accept `auto`, `100%`, `fit-content`

### 4.3 `FlexboxSection.ts`

Conditional: shown when element or parent has `display: flex`.
- Container: flex-direction, flex-wrap, justify-content, align-items, gap (slider + input)
- Child: align-self, flex-grow, flex-shrink, flex-basis

### 4.4 `ColorsSection.ts`

Background, Text, Border rows. Native `<input type="color">` + hex text input + swatch.
- RGB -> hex conversion, transparent detection (checkerboard swatch)
- Border row includes width + style alongside color

### 4.5 `TypographySection.ts`

- font-size: slider 8-72px
- font-weight: slider 100-900 step 100 + name ("400 (Regular)")
- line-height: slider 0.5-4.0 step 0.1
- letter-spacing: slider -2px to 10px step 0.5
- text-align: button group (left, center, right, justify)

### 4.6 `OverflowSection.ts`

`<select>` with visible, hidden, scroll, auto.

### 4.7 CSS additions to `DAUB_STYLES`

Edit tab sections, box model SVG, inputs, sliders, color swatches. All via `adoptedStyleSheets`.

---

### 4.8 Modifications

- `core/src/styles.ts`: `diffStyles()` normalizes rgb spacing, lowercase hex before comparing
- `Panel.ts`: replace EditTabStub, wire `captureAfterScreenshot()` on tab switch
- `DaubApp.ts`: wire Clear -> `resetEdits()` + stroke clear

---

## Testing

- `diffStyles()` identical -> empty, changed -> correct delta, normalized rgb
- Color conversion: `rgb(255,0,0)` -> `#ff0000`, transparent detection
- `FlexboxSection.shouldShow()` logic
- Arrow key increment/decrement
- **`isConnected` returns false -> controls disabled** (v2 F2)

## Verification

1. Select component -> Edit tab shows correct computed values
2. Edit padding via typing + Enter -> live update
3. Arrow keys work (+1, Shift +10)
4. Flex controls appear for flex containers, change justify-content -> children reposition
5. Color picker changes background
6. Font-size slider resizes text
7. Clear reverts everything
8. Highlight overlay follows element on scroll
9. **Hot reload a component -> warning banner appears** (v2 F2)
10. **Navigate away from element -> "Scroll to element" link works**

---

---

# Phase 5: Output + Clipboard

> Updated for v2: crypto.randomUUID, JPEG resize, ClipboardItem with Promises, CSRF token on fetch, depth-limited DOM serializer.

## Overview

Output tab (review), markdown serializer, clipboard write, file writes via middleware. After this: full core loop complete.

## Prerequisites
- Phase 1-4 complete
- `serializeDOM()` in core (Phase 1)

---

## Files to Create

### 5.1 `packages/core/src/serializer.ts` (Full Implementation)

`serializeToMarkdown(ctx: ElementContext, sessionId: string): string`

Sections (conditional per spec):
1. Header (always): component name, file:line, element.classes, DOM path
2. Before (always): screenshot reference
3. After (only if non-null)
4. Annotations (only if non-null)
5. CSS delta (only if non-empty): markdown table
6. Tailwind classes (only if non-empty)
7. DOM subtree (always): **uses `serializeDOM()` output (v2 F11)** -- depth-limited, attribute-filtered
8. Notes (always)
9. Footer

**Session ID:** `crypto.randomUUID().replace(/-/g, '')` **(v2 E4)** -- not `capturedAt.toString(36)`.

**Paths:** Already relative (overlay normalizes via `projectRoot` from `__DAUB_CONFIG__`).

---

### 5.2 `packages/overlay/src/tabs/OutputTab.ts`

- Before/After thumbnails side-by-side (180px max, clickable lightbox)
- Annotations thumbnail (if present)
- CSS Delta display (red strikethrough before, green after)
- Notes textarea (placeholder "Add context for Claude...")
- Collapsible markdown preview (`<pre>` block)

`updateContext()` re-renders when switching to Output tab.

---

### 5.3 `packages/overlay/src/clipboard.ts`

**Image resize before POST (v2 B3):**
```ts
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
```
- Before/After: JPEG at 0.88 quality, max 2048px
- Annotated: keep PNG (has drawn strokes, needs lossless)

**Clipboard write (v2 B4):**
```ts
// ClipboardItem with Promise values -- preserves user gesture on Safari
await navigator.clipboard.write([
  new ClipboardItem({
    'text/plain': Promise.resolve(new Blob([markdown], { type: 'text/plain' })),
    'image/png': fetch(primaryDataUrl).then(r => r.blob()),
  })
]);
```
Fallback: `navigator.clipboard.writeText(markdown)`. Second fallback: toast "Use markdown preview to copy manually."

**Disk write with CSRF token (v2 E1):**
```ts
await fetch(config.writeEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Daub-Token': config.token,
  },
  body: JSON.stringify({ sessionId, files: { ... } })
});
```
- Non-blocking: clipboard write proceeds even if disk write fails
- Strip `data:image/...;base64,` prefix before sending

---

### 5.4 `packages/overlay/src/Toast.ts`

`showToast(shadow, message, type: 'success' | 'error' | 'warning')`

- Fixed bottom-center in shadow root
- Success: green border. Error: red border. **Warning: yellow border (v2 H1)**
- Slide-up animation, auto-dismiss 2500ms
- Single toast at a time

---

### 5.5 Modifications to existing files

**`Panel.ts`:** Replace OutputTabStub. Wire "Copy to Claude":
1. Get annotated image from AnnotateTab
2. Capture after screenshot from EditTab (async, may show capture dialog)
3. Compute CSS delta
4. Get notes
5. Generate `sessionId = crypto.randomUUID().replace(/-/g, '')`
6. Serialize markdown
7. Call copyToClipboard
8. Toast success/failure

**`packages/plugin/src/middleware.ts`:** Already secured (Phase 1):
- CSRF token check via `X-Daub-Token` header
- Path traversal validation
- 50MB size limit
- Loopback address check

---

## Testing

- **Serializer:** full context -> correct markdown. Null fields -> sections omitted. Depth-limited subtree.
- **Clipboard:** mock clipboard.write + fetch. Rich copy, text fallback, CSRF header present.
- **Image resize:** verify output ≤ 2048px on longest axis.
- **Toast:** DOM creation, single-toast constraint.

## Verification

1. Select -> annotate -> edit -> Output tab
2. Before/After/Annotations thumbnails correct
3. CSS delta with color coding
4. Notes reflected in markdown preview
5. Click "Copy to Claude":
   - Success toast appears, auto-dismisses
   - Clipboard has markdown + image
   - `.daub-output/` has files (JPEG before/after, PNG annotated, context.md)
   - Session ID is a UUID (no dashes)
6. `.gitignore` updated (with console log)
7. Test disk write failure -> clipboard still works, error toast
8. Test without edits -> minimal output, omitted sections
9. **DevTools Network tab:** POST includes `X-Daub-Token` header
10. **Image sizes:** before/after are JPEG < 1MB, annotated is PNG
