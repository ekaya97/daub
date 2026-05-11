# Daub

Visual component context tool for AI-assisted UI development. Vite plugin that injects a floating widget into dev apps — click a component, annotate/edit, copy rich context to clipboard for Claude Code.

## Project structure

pnpm monorepo. Packages must build in order: `core -> overlay -> plugin -> next`.

```
packages/core/       # @daub/core — types, serializer, style differ, DOM serializer, shared write logic
packages/overlay/    # @daub/overlay — browser UI (shadow DOM, vanilla TS, zero framework deps)
packages/plugin/     # vite-plugin-daub — Vite plugin, virtual module, middleware
packages/next/       # @daub/next — Next.js adapter (DaubProvider, API route handlers)
packages/extension/  # @daub/extension — browser extension stub (private, not published)
examples/react-vite/ # Primary test app — React 19 + Tailwind v4 + dashboard components
examples/nextjs/     # Next.js 15 App Router + Tailwind v4 example
docs/                # Specs, implementation plans, static docs site
```

## Build commands

```bash
pnpm build          # Sequential: core -> overlay -> plugin -> next
pnpm dev            # Watch mode for core + overlay
pnpm test           # Run all tests (vitest)
```

Per-package: `pnpm --filter @daub/core build` etc.

After any overlay change, you must rebuild plugin too (it copies overlay.js into its own dist).

## Architecture decisions

### Overlay build + distribution
- **Overlay format is ESM** (not IIFE). The v1 spec said IIFE but that's incompatible with Vite's virtual module `import { mountDaub }` syntax.
- **Overlay bundle is copied into plugin/dist/overlay.js** at build time via tsup `onSuccess` hook. The plugin's `load()` hook reads it from its own dist via `readFileSync(resolve(getDirname(), 'overlay.js'))`. No cross-package path resolution at runtime.
- **`__dirname` unavailable in ESM**: use `fileURLToPath(import.meta.url)` + `dirname()`. The plugin wraps this in a `getDirname()` helper with a CJS fallback.
- **Virtual module**: ID is `/@daub/overlay`, resolved ID is `\0/@daub/overlay` (Vite convention for virtual modules — the `\0` prefix prevents other plugins from trying to resolve it as a filesystem path).
- **Bundle size**: ~65KB (overlay only, no third-party capture libraries).

### Screenshot capture
- **Screen Capture API is the only pixel-perfect option**. We evaluated and rejected:
  - `html2canvas` — re-implements CSS rendering in JS, can't parse `oklch()` colors (Tailwind v4 default)
  - `dom-to-image-more` — uses SVG foreignObject, fonts render incorrectly (black boxes around text)
  - `rrweb-snapshot` — serializes DOM to JSON (data, not pixels), would need another tool to convert to image
- **Current approach**: `getDisplayMedia({ preferCurrentTab: true })` → grab one frame via video element → release stream immediately. Dialog shows once per capture, sharing banner disappears in ~1 second.
- **No way to skip the permission dialog** — it's a browser security requirement. A Chrome extension with `tabCapture` API (packages/extension) is the v1.1 fix for this.
- **ImageCapture API not used** — it's Chrome-only. Video element frame grab is cross-browser.

### Shadow DOM + styling
- All overlay UI lives inside a shadow root attached to `#__daub_host__`.
- Styles applied via `adoptedStyleSheets` (a single `CSSStyleSheet` with all rules). This is cleaner than inline styles and avoids CSS leaking.
- CSS classes for layout, inline styles only for dynamic values (position coordinates, computed pixels).
- Dark theme tokens as CSS custom properties: `--daub-bg: #18181b`, `--daub-accent: #6366f1`, etc.

### React 19 source resolution
- **React 19 removed `_debugSource` from fibers entirely.** The spec assumed `_debugSource` (React 17/18 pattern).
- React 19 uses `_debugOwner` (fiber reference) and `_debugStack` (formatted stack trace string).
- Our resolver: walks fiber `.return` chain looking for `_debugStack` on named function components → parses the stack string for file:line:col → **skips `node_modules` frames** (first frame is often `react_jsx-dev-runtime.js`, not the component source).
- **Fallback**: if no `_debugStack` found, walks fibers for any `type.name` or `type.displayName` to at least get the component name.
- File paths are normalized by stripping `window.__DAUB_CONFIG__.projectRoot` prefix (injected by plugin).

### Config injection
- **Vite**: plugin injects two `<script>` tags via `transformIndexHtml` — one sets `window.__DAUB_CONFIG__` (position, outputDir, projectRoot, CSRF token, shortcut, writeEndpoint), the other does `import { mountDaub } from '/@daub/overlay'`.
- **Next.js**: `DaubProvider` component (React `useEffect`) loads `@daub/overlay` dynamically and calls `mountDaub()`. Config is injected via webpack `DefinePlugin` as `globalThis.__DAUB_CONFIG_JSON__`.
- The `DaubProvider` uses **automatic JSX runtime** (`jsx: 'automatic'` in tsup esbuild options) — this outputs `import { jsx } from "react/jsx-runtime"` instead of `React.createElement`, avoiding "React is not defined" errors in Next.js App Router. This is the same pattern TanStack Query uses.

### Security
- Middleware validates: loopback address + CSRF token (`X-Daub-Token` header) + session ID regex (`^[a-z0-9_-]{1,64}$`) + filename allow-list + path traversal check (`startsWith` on resolved path). 50MB size limit.
- Shared write logic lives in `@daub/core/write.ts` — used by both Vite middleware and Next.js API route handlers.
- `.gitignore` modification is opt-outable via `modifyGitignore: false` option.

### Clipboard
- **Text only** — writes markdown to clipboard via `navigator.clipboard.writeText()`. Earlier we tried `ClipboardItem` with both `text/plain` and `image/png`, but most apps paste the image by default, and Claude Code (a terminal) needs text.
- Screenshots are saved to disk at `.daub-output/{sessionId}/` and referenced by path in the markdown.
- Images are resized to max 2048px and converted to JPEG (0.88 quality) before POST. Annotation layer stays PNG (needs lossless).

## Package-specific notes

### @daub/core
- Types: `DaubOptions` (user-facing), `DaubConfig` (runtime), `ElementContext`, `CapturedStyles`, `CssDelta`, `DaubSession`
- `captureStyles()`: uses camelCase property indexing on `CSSStyleDeclaration` (not `getPropertyValue` with kebab-case — the latter returned empty strings)
- `diffStyles()`: normalizes values (lowercase, collapse whitespace) before comparing
- `serializeDOM()`: depth-limited to 3 levels, filters attributes to allow-list, truncates at 5000 chars
- `writeSessionToDisk()` + `ensureGitignore()`: shared disk write logic

### @daub/overlay
- Entry: `src/index.ts` exports `mountDaub(config)` which creates the shadow host + `DaubApp`
- Dependencies: `@daub/core` + `idb` (for IndexedDB history). Both bundled via `noExternal: [/.*/]`.
- State machine: `IDLE → PICKING → CAPTURED → PANEL_OPEN → IDLE`
- Picker: injects overlay + highlight + tooltip into main document (not shadow DOM — needs `elementFromPoint`). Uses `elementFromPoint` on both mousemove and click (not `composedPath` — that returns the overlay div itself).
- Source resolver: 50ms throttle + WeakMap cache. Multi-framework chain: React → Vue → Svelte.
- Panel: auto-positions left/right based on element center. Resize handle persists width in localStorage.
- Annotate tab: HTML5 Canvas with 6 tools (pen, arrow, rect, text, eraser, undo). DPR-aware. PointerEvents for touch/stylus.
- Edit tab: 5 sections (BoxModel, Flexbox, Colors, Typography, Overflow). Live `element.style.setProperty()`. `isConnected` check for stale elements after HMR.
- History: IndexedDB via `idb`, 20-session cap, thumbnail grid with restore/delete.
- Error handling: `safeCall()` wrapper for each context-building step. Screenshot failure → warning toast + text-only context. Never throws into host app.

### vite-plugin-daub
- `apply: 'serve'` — never runs in production builds
- `enforce: 'post'` — runs after framework plugins
- Virtual module: `\0/@daub/overlay` → reads `overlay.js` from its own dist
- Exports: `.` (plugin default) + `./overlay` (raw overlay bundle for Next.js)

### @daub/next
- `withDaub()`: wraps Next.js config, injects client entry via webpack, DefinePlugin for config
- `DaubProvider`: React component with `useEffect` that dynamically imports `@daub/overlay`
- `api.ts`: Pages Router handler (`export { daubWriteHandler as default }`)
- `app-route.ts`: App Router handler (`export { POST }`)
- Uses automatic JSX runtime — set `jsx: 'automatic'` in tsup esbuildOptions
- Turbopack detection: if `context.webpack` is falsy, logs warning (Turbopack not supported in v1)

## Known limitations (v1)

1. Screen Capture API requires permission dialog on every capture
2. Safari: no Screen Capture API at all
3. Firefox: `getDisplayMedia` works but no `preferCurrentTab` — user selects tab manually
4. Shadow DOM: hover highlight doesn't pierce shadow roots (click selection does via `elementFromPoint`)
5. iframes: cannot select elements inside
6. Angular: not supported (no source resolver)
7. Svelte 5 (runes): source attribution unavailable (internals changed completely)
8. Vue: file path only, no line number in source attribution
9. React 19: file path comes from `_debugStack` parsing — points to source but line numbers may be off
10. Next.js: requires `DaubProvider` wrapper in layout + optional API route for disk writes
11. Turbopack: not supported (webpack entry injection doesn't apply)
12. Tailwind v4 `oklch()` colors: html2canvas can't parse them (reason we use Screen Capture API)

## Specs and plans

- `docs/daub-spec.md` — v1 full spec (types, architecture, all components)
- `docs/daub-spec-v2.md` — v2 amendments (overrides v1 where they conflict)
- `docs/plan-phase-*.md` — implementation plans per phase
- `docs/questions.md` — all 45 spec review questions and their resolutions
- `docs/site/index.html` — static docs site (dark theme, single page, no build step)

## Implementation status

All phases 1-7 complete (T-0001 through T-0024). Remaining: Phase 8 (T-0025 unit tests, T-0026 release prep).

## Ticket tracking

Uses `.track/` for lightweight ticketing. See `.track/CONVENTIONS.md`.

```bash
track list                                # See available tickets
track board --last 10                     # Check what's happening
track create --title "Fix auth bug"       # Create + auto-claim
track update T-NNNN --status done --force # Mark done
```

## Conventions

- TypeScript strict mode throughout
- All imports use `.js` extension (ESM)
- Package exports: `types` condition first, then `import`, then `require`
- tsup for all package builds
- Dark theme UI: `--daub-bg: #18181b`, `--daub-accent: #6366f1`, `--daub-text: #e4e4e7`
- Commit messages reference ticket IDs: `T-0001: description`
- Never throw uncaught exceptions into host app — wrap in try/catch, show toast
