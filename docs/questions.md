# Daub Spec Review: Resolved Questions

> All 45 questions from the original spec review have been resolved in `daub-spec-v2.md`.
> This document serves as a quick-reference index mapping each question to its resolution.

---

## Architecture & Build (Part A)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 1 | IIFE vs ESM overlay build | **ESM**. IIFE incompatible with virtual module imports. | A1 |
| 2 | Virtual module path after npm publish | Overlay copied into `plugin/dist/` at build time via tsup `onSuccess`. No cross-package path resolution. | A1, A2 |
| 3 | `__dirname` in ESM | Use `fileURLToPath(import.meta.url)` + `path.dirname`. | A2 |
| 4 | `resolveId` must `\0`-prefix | Virtual module ID: `\0/@daub/overlay`. | A2 |
| 5 | html2canvas + zero-dep mandate | Bundled via `noExternal: [/.*/]`. Lazy dynamic import in fallback path. "Self-contained" replaces "zero-dep". | A3 |
| 6 | Core consumed both server/browser | `source.ts` moves to `packages/overlay`. Core has only env-agnostic code. | A4 |
| 17 | Overlay consumption pattern fragile | Copy artifact into plugin/dist at build time. | A1 |
| 18 | Build order dependency | Explicit sequential build: `core -> overlay -> plugin -> next`. | A6 |
| 19 | No build config for core | Added: `format: ['esm', 'cjs']`, `dts: true`. | A4 |
| 20 | No overlay package.json | Added with `idb` + `html2canvas` deps. | A5 |

## Browser APIs (Part B)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 7 | Screen Capture permission dialog every time | Stream kept alive per session. One prompt per Daub activation. | B1 |
| 8 | `preferCurrentTab` Chrome-only | Firefox: manual tab selection. Safari: auto-fallback to html2canvas. | B1 |
| 9 | `ImageCapture` API availability | Replaced with video element approach (cross-browser). | B1 |
| 10 | Clipboard user gesture chain breaks | Use `ClipboardItem` with `Promise` values. Pre-compute before async gap. | B4 |
| 11 | `window.screen.width` vs `innerWidth` | Use `innerWidth`/`innerHeight`. Accounts for docked DevTools. | B2 |
| 34 | Large payload size | Resize to max 2048px, JPEG at 0.88 quality (PNG for annotations). 50MB middleware limit. | B3 |
| 40 | DevTools docked viewport | Covered by using `innerWidth`/`innerHeight`. | B2 |

## Framework Source Resolution (Part C)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 12 | `_debugSource` across React versions | React 17-19 supported. Both Babel and SWC inject source info in dev. | C1 |
| 13 | Source paths relative vs absolute | Plugin injects `projectRoot` via `window.__DAUB_CONFIG__`. Overlay strips prefix. | C2 |
| 14 | Vue no line number | Acceptable for v1. Document in output: "line info unavailable for Vue". | C3 |
| 15 | Svelte underspecified | Svelte 4 via `__svelte_component__`, marked experimental. Svelte 5 not supported. | C4 |
| 16 | Multi-framework detection order | Try all three, return first with actual source: `resolveReact ?? resolveVue ?? resolveSvelte ?? null`. | C5 |

## Types (Part D)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 42 | `DaubConfig` never defined | Both `DaubOptions` (user-facing) and `DaubConfig` (runtime) defined in core types. | D1 |

## Security (Part E)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 28 | Loopback check insufficient | Explicit allow-list + CSRF token (`crypto.randomUUID()`) via `X-Daub-Token` header. | E1 |
| 29 | Path traversal in sessionId | Regex validation `^[a-z0-9_-]{1,64}$`, filename allow-list, `startsWith` path check. | E2 |
| 30 | Automatic .gitignore modification | Opt-outable via `modifyGitignore` option. Always logged to console. | E3 |
| 35 | Session ID collision | `crypto.randomUUID()` replaces `capturedAt.toString(36)`. | E4 |

## UX & Interaction (Part F)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 21 | Panel obscures selected element | Auto-position based on element center. Swap-sides button in header. | F1 |
| 22 | Element removed from DOM | `isConnected` check on each Edit tab interaction. HMR listener for `vite:afterUpdate`. | F2 |
| 23 | Shadow DOM elements | `composedPath()[0]` on click pierces shadow roots. Hover highlight doesn't. | F3 |
| 24 | iframes | Documented as known limitation. | F4 |
| 25 | Picker blocks interaction | Intentional. Help tooltip: "Navigate to state, then click to pick." | F5 |
| 26 | Tooltip clipped at top | Viewport clamping: flip below element when insufficient space above. Horizontal clamp. | F6 |
| 27 | Keyboard shortcut conflict | Changed to `Alt+Shift+D` (not reserved). Configurable via `shortcut` option. | F7 |
| 36 | Event listener cleanup broken | Store bound handlers as instance properties. | F8 |
| 41 | Inline styles hard to maintain | `adoptedStyleSheets` on shadow root. CSS classes for layout, inline only for dynamic values. | F9 |
| 43 | No accessibility | ARIA roles, keyboard tab nav, focus return on close. Non-modal (no focus trap). | F10 |
| 44 | Depth-limited outerHTML | `serializeDOM()` in `packages/core/src/dom-serializer.ts`. Stops at depth 3 with comment placeholders. | F11 |
| 45 | No throttle on picker mousemove | 50ms throttle + `WeakMap` cache keyed by element reference. | F12 |

## Next.js (Part G)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 38 | No write endpoint | Next.js API route: Pages Router (`pages/api/daub-write.ts`) and App Router (`app/api/daub-write/route.ts`). User adds one file. | G1 |
| 39 | Turbopack compatibility | Out of scope v1. Detect + warn. Use `next dev --no-turbo`. | G2 |

## Error Handling & Testing (Part H)

| # | Question | Resolution | v2 Section |
|---|---|---|---|
| 31 | No error handling strategy | Full strategy table: toast for user-facing, `[Daub]` console prefix, never crash host app. | H1 |
| 32 | No testing strategy | Vitest for core + plugin. No canvas tests for v1. Manual test checklist. No Playwright. | H2 |
| 33 | No HMR behavior defined | Shadow host on `body` survives HMR. Double-mount guard prevents re-injection. `isConnected` handles stale refs. | H3 |
| 37 | html2canvas not in deps | Added to overlay `package.json` dependencies. Bundled via `noExternal`. | A3 |

---

## Known Limitations (v1)

Resolved and documented for README:

1. Turbopack not supported — use `next dev --no-turbo`
2. Safari screenshot falls back to html2canvas
3. Firefox requires manual tab selection (no `preferCurrentTab`)
4. Hover highlight doesn't pierce shadow roots (click selection does)
5. Cannot select elements inside iframes
6. Angular not supported (browser extension in v1.1)
7. Svelte 5 (runes) source attribution unavailable
8. Vue: file path only, no line number
9. webpack standalone not packaged (HTTP proxy documented)
10. Next.js write endpoint requires adding one API route file
