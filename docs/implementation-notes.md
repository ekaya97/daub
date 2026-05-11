# Implementation Notes — What We Learned

> Practical lessons from building Daub. Captures divergences from spec, bugs encountered, and decisions made during implementation.

---

## Screenshot capture: the full journey

The spec proposed Screen Capture API with html2canvas as fallback. In practice:

1. **html2canvas** — crashed on Tailwind v4's `oklch()` color functions. The library re-implements CSS parsing in JS and doesn't support modern color spaces. Not viable with Tailwind v4.

2. **dom-to-image-more** — uses SVG `foreignObject` which lets the browser render natively (supports all CSS). However, text rendering broke — fonts showed black boxes and clipping. The SVG serialization loses font metrics.

3. **Screen Capture API** — pixel-perfect (captures actual compositor output). Two UX costs:
   - Permission dialog on every `getDisplayMedia()` call (no "remember" option — browser security)
   - "Sharing this tab" banner while stream is active
   
   **Mitigation**: grab one frame then release stream immediately. Banner disappears in ~1 second.

4. **Keeping the stream alive** (spec v2 approach) — eliminates repeated dialogs but the sharing banner persists for the entire session. Worse UX overall.

**Final decision**: Screen Capture API with immediate release. One dialog per capture, banner is brief. Extension with `tabCapture` API is the v1.1 zero-dialog solution.

**Key insight**: there is no browser API that gives pixel-perfect screenshots without a permission prompt. This is by design (security). Any tool claiming otherwise is either using a less-accurate rendering method or running as an extension.

---

## React 19 source resolution

The spec assumed `_debugSource` on React fibers (the React 17/18 pattern). React 19 removed this entirely.

**What React 19 provides:**
- `_debugOwner` — fiber reference to the parent component (useful for component name)
- `_debugStack` — a formatted Error stack trace string (useful for file/line)
- Component name via `fiber.type.name` (function components) or `fiber.type.displayName`

**Implementation:**
1. Walk fiber `.return` chain looking for `_debugSource` (React 17/18 compat)
2. If not found, look for `_debugStack` on named function component fibers
3. Parse the stack string with regex, **skipping `node_modules` frames** (first frame is often `react_jsx-dev-runtime.js`)
4. Fallback: walk fibers for any `type.name` to get at least the component name

**Limitation**: file paths from `_debugStack` point to the source file but line numbers can be off (they point to where the JSX element is created, not the component definition).

---

## Tailwind v4 compatibility

Tailwind v4 uses `oklch()` for all default colors. This broke html2canvas (CSS parsing crash). This is a hard constraint — any DOM-to-image solution that parses CSS independently will fail.

The `extractTailwindClasses()` heuristic works by matching class prefixes (`p-`, `bg-`, `flex`, etc.) against the element's `classList`. This is framework-agnostic and doesn't require Tailwind to be installed.

---

## Vite virtual module pattern

The correct pattern for Vite virtual modules:

```ts
const VIRTUAL_ID = '/@daub/overlay';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

resolveId(id) {
  if (id === VIRTUAL_ID) return RESOLVED_ID;
}

load(id) {
  if (id === RESOLVED_ID) {
    return readFileSync(resolve(getDirname(), 'overlay.js'), 'utf-8');
  }
}
```

Key details:
- The `\0` prefix tells Vite/Rollup this is virtual (don't try to resolve as filesystem)
- `__dirname` doesn't exist in ESM — use `fileURLToPath(import.meta.url)` + `dirname()`
- The overlay JS file must be in the plugin's own `dist/` (copied at build time via tsup `onSuccess`)
- `import.meta.env.DEV` is not available in inline `<script>` tags — Vite only transforms source files, not injected HTML

---

## Picker element targeting

The spec used `composedPath()[0]` on click to pierce shadow roots. In practice, `composedPath()[0]` returns the **overlay div itself** (it's the click target since it covers the full viewport). 

**Fix**: on click, temporarily hide the overlay, call `document.elementFromPoint(e.clientX, e.clientY)`, restore overlay. Same technique as the mousemove handler.

Shadow DOM piercing on click still works — `elementFromPoint` returns the shadow host, and we can improve this later with `composedPath()` in a different event flow.

---

## `captureStyles` — camelCase vs kebab-case

The initial implementation used `getComputedStyle(el).getPropertyValue('background-color')` with a camelCase-to-kebab conversion. This returned empty strings for all properties.

**Fix**: index `CSSStyleDeclaration` directly with camelCase: `(computed as any)[key]`. This is the standard JS API for accessing computed styles.

---

## Clipboard: text vs image

The spec proposed `ClipboardItem` with both `text/plain` and `image/png`. When pasting into apps, the image takes priority — Claude Code (a terminal) receives the screenshot instead of the markdown.

**Fix**: write text only via `navigator.clipboard.writeText(markdown)`. Screenshots are saved to disk and referenced by file path in the markdown. Claude Code can read the files.

---

## Next.js adapter: what works and what doesn't

### What works
- `DaubProvider` component wrapping the layout — simple, reliable
- Dynamic `import('@daub/overlay')` in `useEffect` — loads overlay client-side only
- `DefinePlugin` to inject config as `globalThis.__DAUB_CONFIG_JSON__`
- API route handlers for Pages Router and App Router disk writes

### What doesn't work
- **Webpack entry injection** (`config.entry` manipulation) — fragile across Next.js versions, entry key names change, client entry may not be an array
- **`require.resolve('@daub/next/client')` in webpack config** — requires CJS export for the `./client` subpath
- **Turbopack** — completely different config model, no webpack entry manipulation possible

### JSX compilation for provider components
Using `React.createElement` (classic JSX transform) causes "React is not defined" in Next.js App Router if React isn't explicitly imported. TanStack Query solved this by using automatic JSX runtime.

**Fix**: set `jsx: 'automatic'` in tsup's `esbuildOptions`. Output becomes `import { jsx } from "react/jsx-runtime"` — no global React needed.

### pnpm strict mode
`@daub/overlay` must be a direct dependency of both `@daub/next` AND the user's app (e.g., `examples/nextjs`). pnpm doesn't hoist transitive deps — even though `@daub/next → vite-plugin-daub → @daub/overlay`, the overlay won't be resolvable from the app's `node_modules`.

---

## Overlay package.json: main vs actual output

The overlay's tsup config outputs `dist/index.js` (entry is `src/index.ts`), but the initial `package.json` pointed `main` and `exports` to `dist/overlay.js`. Webpack in Next.js couldn't resolve it.

**Fix**: ensure `main` and `exports` in `package.json` match the actual output filename.

---

## Error handling philosophy

Daub must **never** throw uncaught exceptions into the host app. Every context-building step is wrapped in `safeCall()` which catches errors and returns a fallback value. The screenshot capture has its own try/catch with a warning toast — the rest of the context (styles, source, DOM) is still captured.

The `showToast()` function handles success/error/warning states. Toasts auto-dismiss after 2.5s.

---

## IndexedDB in private browsing

Some browsers restrict IndexedDB in private/incognito mode. All history operations are wrapped in try/catch — if IndexedDB is unavailable, the history tab is effectively empty and operations silently no-op.

---

## Build order matters

The build must be sequential: `core → overlay → plugin → next`. The plugin's tsup `onSuccess` hook copies `overlay/dist/index.js` into `plugin/dist/overlay.js`. If overlay hasn't been built yet, the copy fails (with a warning, not an error — the plugin still builds, just without the overlay).

The root `package.json` enforces this with `&&` chaining, not `pnpm -r build` (which would run in parallel based on dependency graph, but the overlay→plugin copy isn't a standard dependency).
