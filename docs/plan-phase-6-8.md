# Phase 6: History + Error Handling + Polish

> Updated for v2: error handling strategy table, configurable shortcut, help tooltip, warning toast type.

## Overview

Session persistence (IndexedDB), framework-agnostic source resolution, UX polish, keyboard shortcuts, comprehensive error handling.

## Files to Create

### 1. `packages/overlay/src/history.ts` -- IndexedDB session store

- `saveSession(session)`, `getSessions()`, `getSession(id)`, `deleteSession(id)`, `clearHistory()`
- Uses `idb` package (bundled). DB: `'daub'`, store: `'sessions'`, key: `'id'`
- `MAX_SESSIONS = 20`, delete oldest on overflow
- **IndexedDB unavailable (v2 H1):** history tab hidden, `[Daub] History unavailable (private browsing?)` logged

### 2. `packages/overlay/src/HistoryTab.ts`

- Thumbnail grid (160x100px, component name, relative timestamp)
- Click card -> restore session in panel
- Delete per card, "Clear all" at bottom
- Empty state: "No captures yet"

### 3. Source resolvers (already in overlay per v2 A4)

**Update `overlay/src/source.ts`:**
- `resolveVue(element)`: `__vueParentComponent.type.__file`, name from `.name`/`.__name`, line 0
- `resolveSvelte(element)`: `__svelte_component__` (Svelte 4 only, experimental). Svelte 5: returns null gracefully
- **Multi-framework chain (v2 C5):** `resolveReact ?? resolveVue ?? resolveSvelte ?? null`

### 4. `packages/overlay/src/keyboard.ts`

**Configurable shortcut (v2 F7):**
- Default: `Alt+Shift+D` (not a Chrome reserved shortcut)
- Read from `config.shortcut`
- Parser: splits on `+`, matches modifiers (Alt, Shift, Ctrl, Meta) + key
- Escape: cancel picker / close panel
- Returns cleanup function for listener removal

### 5. `packages/overlay/src/ResizeHandle.ts`

- 4px drag zone on panel edge, `col-resize` cursor
- Clamp 320px - 80vw, persist to `localStorage('daub-panel-width')`

### 6. Error handling (v2 H1)

Implement across all overlay files:

| Error | User-facing | Console |
|---|---|---|
| Screenshot fail | Toast: "Screenshot failed, using fallback" | `[Daub] Screen capture error: {msg}` |
| html2canvas fail | Toast: "Screenshot unavailable. Context will be text-only." | `[Daub] html2canvas error: {msg}` |
| Source resolve null | Silent -- "(source unknown)" in output | None |
| Middleware POST fail | Toast: "Files not saved to disk. Copy still works." | `[Daub] Write failed: {status}` |
| IndexedDB unavailable | Silent -- history tab hidden | `[Daub] History unavailable` |
| Clipboard denied | Toast: "Clipboard blocked. Use the markdown preview." | None |
| Element disconnected | Warning banner in Edit tab | None |

All Daub code wrapped in try/catch. **Never throw uncaught exceptions into host app.**

Console prefix: `[Daub]`. Debug logging only when `import.meta.env.DEV`.

### 7. CSS polish

- `TriggerButton.ts`: hover scale 1.05, active scale 0.95, **help tooltip [?] (v2 F5)**
- `Picker.ts`: verify 0.08s highlight transition
- All components: CSS classes via `adoptedStyleSheets`, inline only for dynamic values

---

## Dependencies

```
history.ts <-- HistoryTab.ts <-- Panel.ts <-- DaubApp.ts
source.ts (Vue/Svelte additions)
keyboard.ts <-- DaubApp.ts
ResizeHandle.ts <-- Panel.ts
Toast.ts (warning type added) <-- everywhere
```

## Testing

- IndexedDB: `fake-indexeddb` for save/get/delete/cap enforcement
- Vue resolver: mock `__vueParentComponent`
- Svelte resolver: mock `__svelte_component__`, test Svelte 5 returns null
- Keyboard: simulate keydown, verify correct methods called
- Error handling: mock failures, verify toasts + console output

## Verification

1. Capture 3 components -> all in History tab
2. Click history card -> panel reopens with correct data
3. 21 captures -> only 20 retained
4. `Alt+Shift+D` toggles Daub
5. Escape cancels picking / closes panel
6. Resize panel -> width persists across reload
7. Toast on copy, warning on disconnected element
8. **Help tooltip on trigger [?] hover**
9. **IndexedDB disabled (private browsing) -> history tab hidden, no crash**
10. **Force screenshot failure -> fallback toast, app continues**

---

---

# Phase 7: Next.js Adapter + Docs

> Updated for v2: API route approach, Turbopack detection, write endpoint in both Pages/App Router.

## Workstream A: Next.js Adapter

### Files to Create

#### 1-3. Package setup
- `packages/next/package.json`: `@daub/next`, peer dep `next >=13`
- `tsconfig.json`, `tsup.config.ts`: two entries (`src/index.ts`, `src/client.ts`)

#### 4. `packages/next/src/index.ts` -- `withDaub(nextConfig, options?)`

- Wraps Next.js config, modifies webpack entries in dev+client context
- Appends client entry point to main entry
- **Turbopack detection (v2 G2):**
```ts
if (context.nextRuntime === undefined && !context.webpack) {
  console.warn('[Daub] Turbopack detected. Run with --no-turbo for Daub support in v1.');
  return config;
}
```
- Injects `window.__DAUB_CONFIG__` with `writeEndpoint: '/api/daub-write'`

#### 5. `packages/next/src/client.ts`

Side-effect module. Guards: `typeof window !== 'undefined'` + `NODE_ENV === 'development'`.
Calls `mountDaub(window.__DAUB_CONFIG__)`.

#### 6-7. Write endpoint handlers (v2 G1)

**`packages/next/src/api.ts` -- Pages Router:**
```ts
// User adds to pages/api/daub-write.ts:
// export { daubWriteHandler as default } from '@daub/next/api';
```
- Exports `daubWriteHandler(req: NextApiRequest, res: NextApiResponse)`
- Sets `api.bodyParser.sizeLimit: '50mb'`
- Calls shared write logic from `@daub/core`

**`packages/next/src/app-route.ts` -- App Router:**
```ts
// User adds to app/api/daub-write/route.ts:
// export { POST } from '@daub/next/app-route';
```
- Exports `POST(req: NextRequest): Promise<NextResponse>`

**Setup docs:** One file to add. Document as required step. Conscious v1 trade-off vs Vite zero-config.

#### 8. `packages/core/src/write.ts` -- Shared disk-write utility

Extract from `packages/plugin/src/middleware.ts`:
- `writeSessionToDisk(outputDir, sessionId, files): Promise<string>`
- `ensureGitignore(outputDir, modifyGitignore): Promise<void>`
- Path traversal validation, session ID validation

Both Vite middleware and Next.js handlers import from this.

#### 9. `examples/nextjs/`

- Next.js 14+, App Router, Tailwind
- `next.config.js` with `withDaub()`
- `app/api/daub-write/route.ts` -- one-liner re-export
- Components marked `'use client'`

---

## Workstream B: Documentation Site

### Files

1. `docs/package.json` -- Astro + Starlight
2. `docs/astro.config.mjs` -- static, GitHub Pages base
3. Pages:
   - `index.mdx` -- hero, 3-step flow, install, output example
   - `vite.mdx` -- Vite install guide + DaubOptions table
   - `nextjs.mdx` -- Next.js install + **API route setup requirement (v2 G1)** + `--no-turbo` note
   - `output.mdx` -- Markdown format explanation
   - `faq.mdx` -- FAQ including **known limitations (v2)**
4. Static assets: favicon, og-image, demo.gif placeholder
5. `.github/workflows/docs.yml` -- Astro build + deploy-pages
6. `.github/workflows/ci.yml` -- build, lint, test on PRs

### Known Limitations in FAQ (v2)

Must document all 10 limitations from v2 spec.

---

## Testing

- `withDaub()` unit test with webpack config mock
- Next.js middleware tests (temp dir, loopback, CSRF)
- `writeSessionToDisk` unit test
- Manual: Next.js example end-to-end
- Docs: `npm run build` succeeds

## Verification

1. `pnpm build` across all packages
2. Next.js example: `npm run dev` -> Daub visible, capture works
3. **`npm run dev --turbo` -> warning logged, Daub not injected**
4. `.daub-output/` created in Next.js project
5. Docs build + preview, all pages load
6. FAQ page lists all known limitations

---

---

# Phase 8: Testing + Release Prep

> Updated for v2: testing strategy (no canvas tests, manual checklist), known limitations in README.

## Overview

No major features. Testing, changesets, CI, README, demo, npm publish.

## Testing Strategy (v2 H2)

### Vitest unit tests

| Package | What to test |
|---|---|
| `@daub/core` | serializer, style differ, Tailwind extractor, DOM serializer |
| `vite-plugin-daub` | middleware path traversal, session ID validation, CSRF token, gitignore, size limit |
| `@daub/overlay` | source resolver (React mock fibers, multi-framework chain), state machine, crop math |
| `@daub/next` | `withDaub` webpack config modification, Turbopack detection |

**No canvas tests for v1** (complex mocking, low ROI). **No Playwright e2e for v1.**

### Manual test checklist (in CONTRIBUTING.md)

- [ ] `examples/react-vite`: picker highlights, click selects, screenshot shows element
- [ ] Annotate tab: all tools draw correctly, undo works, canvas exports
- [ ] Edit tab: padding updates live, color picker reflects change, CSS delta correct
- [ ] Output tab: thumbnails, notes in markdown, preview matches clipboard
- [ ] Copy: files in `.daub-output/`, clipboard has image + text
- [ ] History: session appears after copy, reopens correctly
- [ ] Escape cancels picker, Alt+Shift+D opens picker
- [ ] Screen Capture denied -> html2canvas fallback
- [ ] Element hot-reloaded -> warning banner
- [ ] Next.js example: full flow works

---

## Files to Create

### 1. `.changeset/config.json`

- `linked: [["vite-plugin-daub", "@daub/core", "@daub/overlay"]]`
- `@daub/next` versioned independently
- `access: "public"`, `baseBranch: "main"`

### 2. `README.md`

- Badges, demo GIF, quick install (Vite + Next.js)
- Example output format
- DaubOptions table (including `shortcut`, `modifyGitignore`)
- **Known Limitations section (v2):** all 10 items
- Contributing link, MIT license

### 3. `CONTRIBUTING.md`

- Prerequisites (Node 20+, pnpm 9+)
- Setup, dev workflow
- **Manual test checklist (v2 H2)**
- Changeset process, PR guidelines

### 4. `LICENSE` -- MIT

### 5. `.github/workflows/release.yml`

- `changesets/action` for version bumps + npm publish
- Requires `NPM_TOKEN` + `GITHUB_TOKEN`

### 6. Package publish configs

- `@daub/core`, `@daub/overlay`, `@daub/next`: `publishConfig.access: "public"`, `files: ["dist"]`
- `vite-plugin-daub`: `files: ["dist"]` (includes overlay.js copy)
- `packages/extension`: `private: true`

### 7. `.github/ISSUE_TEMPLATE/` -- bug report + feature request

### 8. Demo recording

Full flow: trigger -> picker -> annotate -> CSS edit -> Output -> Copy to Claude.
Keep GIF < 5MB.

---

## Verification

1. Fresh clone -> `pnpm install && pnpm build && pnpm test` all succeed
2. `npm pack` in each package -> only dist/, package.json, README, LICENSE
3. Install tarballs in standalone Vite + Next.js projects -> Daub works
4. Changeset workflow functional
5. CI passes, docs deploy
6. Demo GIF present
7. **All 10 known limitations documented in README**

---

---

# Example App Strategy

## Primary: React + Vite + Tailwind (Phases 1-6)

### Scaffold

```bash
pnpm create vite examples/react-vite --template react-ts
cd examples/react-vite
pnpm add -D tailwindcss @tailwindcss/vite
```

### Required Components

Designed to exercise every Daub feature:

1. **`Card.tsx`** -- Tailwind utilities (`p-4`, `rounded-lg`, `shadow-md`, `bg-white`, `border`). Tests Tailwind extraction.
2. **`CardGrid.tsx`** -- Flex container with wrap + gap, 6+ Cards. Tests flex controls.
3. **`Sidebar.tsx`** -- Fixed height, `overflow-y: auto`. Tests overflow dropdown.
4. **`ProfileHeader.tsx`** -- Nested: avatar, heading, subtitle. Tests typography sliders.
5. **`GridLayout.tsx`** -- CSS Grid. Tests grid property capture.
6. **`ColorSection.tsx`** -- Explicit bg/text/border colors. Tests color pickers.
7. **`Dashboard.tsx`** -- Composes all above. Realistic layout for picker, DOM path, nested selection.
8. **`App.tsx`** -- Renders Dashboard.

### Phase-by-Phase Smoke Tests

| Phase | What to verify |
|---|---|
| 1 | `[Daub] loaded` in console, `__DAUB_CONFIG__` has projectRoot + token |
| 2 | Picker highlights, tooltip clamps, one permission dialog per session |
| 3 | Panel auto-positions, annotations work, swap-sides button |
| 4 | Edit tab, live CSS updates, isConnected warning on HMR |
| 5 | Output tab, clipboard copy, disk files, UUID session ID |
| 6 | History, toast, keyboard shortcut, error handling |

## Secondary: Next.js (Phase 7)

```bash
npx create-next-app@latest examples/nextjs --typescript --tailwind --app --src-dir --no-import-alias
```

- Components marked `'use client'`
- `next.config.js` with `withDaub()`
- `app/api/daub-write/route.ts` -- one-liner re-export
- Test with `next dev` (not `--turbo`)

### Next.js-Specific Tests

- Daub loads in App Router with server component parents
- Fiber traversal works with Next.js React version
- `/api/daub-write` endpoint creates files
- Page navigation: Daub survives, no duplicate mount
- `--turbo` flag: warning logged, Daub not injected
