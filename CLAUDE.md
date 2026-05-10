# Daub

Visual component context tool for AI-assisted UI development. Vite plugin that injects a floating widget into dev apps — click a component, annotate/edit, copy rich context to clipboard for Claude Code.

## Project structure

pnpm monorepo. Packages must build in order: `core -> overlay -> plugin -> next`.

```
packages/core/       # @daub/core — shared types, serializer, style differ, DOM serializer
packages/overlay/    # @daub/overlay — browser UI (shadow DOM, vanilla TS, zero framework deps)
packages/plugin/     # vite-plugin-daub — Vite plugin, virtual module, middleware
packages/next/       # @daub/next — Next.js adapter (stub, Phase 7)
packages/extension/  # @daub/extension — browser extension stub (private, not published)
examples/react-vite/ # Primary test app — React 19 + Tailwind + dashboard components
docs/                # Specs and implementation plans
```

## Build commands

```bash
pnpm build          # Sequential: core -> overlay -> plugin -> next
pnpm dev            # Watch mode for core + overlay
pnpm test           # Run all tests (vitest)
```

Per-package: `pnpm --filter @daub/core build` etc.

## Architecture decisions (from spec v2)

- **Overlay format is ESM** (not IIFE). Served as virtual module `/@daub/overlay` (resolved ID: `\0/@daub/overlay`).
- **Overlay bundle is copied into plugin/dist/** at build time via tsup `onSuccess` hook. This is how the plugin finds it — no cross-package path resolution needed after npm install.
- **`__dirname` replacement**: use `fileURLToPath(import.meta.url)` + `dirname()` since the plugin is ESM.
- **Shadow DOM**: all overlay UI lives inside a shadow root with `adoptedStyleSheets`. CSS classes for layout, inline styles only for dynamic values.
- **Screen Capture API**: stream kept alive per session (one permission dialog). Video element frame grab (no ImageCapture API). Falls back to html2canvas (bundled, lazy import).
- **Source resolver lives in overlay** (not core) — it uses DOM APIs. Multi-framework: `resolveReact ?? resolveVue ?? resolveSvelte ?? null`.
- **`window.__DAUB_CONFIG__`**: injected by plugin via `transformIndexHtml`. Contains `projectRoot`, CSRF `token`, `writeEndpoint`, `shortcut`, `position`.
- **Security**: middleware validates loopback address + CSRF token (`X-Daub-Token` header) + session ID regex + filename allow-list + path traversal check. 50MB size limit.
- **Session IDs**: `crypto.randomUUID()` (not timestamp-based).
- **Images**: resized to max 2048px, JPEG at 0.88 quality before POST (PNG for annotation layer).

## Specs

- `docs/daub-spec.md` — v1 full spec (types, architecture, all components)
- `docs/daub-spec-v2.md` — v2 amendments (overrides v1 where they conflict, resolves all 45 open questions)
- `docs/plan-phase-*.md` — implementation plans per phase
- `docs/questions.md` — resolved questions reference

## Implementation phases

1. Core + Plugin skeleton (done — scaffolded)
2. Picker + Screenshot
3. Panel + Annotate tab
4. Edit tab
5. Output + Clipboard
6. History + Error handling + Polish
7. Next.js adapter + Docs
8. Testing + Release

## Key types

- `DaubOptions` — user-facing plugin config (in `vite.config.ts`)
- `DaubConfig` — runtime config injected into browser via `window.__DAUB_CONFIG__`
- `ElementContext` — full capture payload (source, styles, screenshots, delta, notes)
- `CapturedStyles` — 40+ CSS properties extracted from `getComputedStyle`
- `DaubSession` — persisted to IndexedDB (id + context + markdown)

## Testing

- Vitest for unit tests. Run with `pnpm test`.
- No canvas tests for v1 (complex mocking, low ROI).
- No Playwright e2e for v1.
- Manual test checklist in example app per phase.

## Ticket tracking

This project uses `.track/` for lightweight ticketing. See `.track/CONVENTIONS.md` for full details.

```bash
track list                                # See available tickets
track board --last 10                     # Check what's happening
track create --title "Fix auth bug"       # Create + auto-claim
track update T-NNNN --status review       # Move to review
```

- Reference ticket IDs in commits: `T-0001: fix token refresh`
- One ticket at a time — finish or release before claiming another
- Check the board before starting work on related code
- Never modify `.track/` files directly — use the `track` CLI
- Lifecycle: `backlog → claimed → in-progress → review → done`

## Conventions

- TypeScript strict mode throughout
- All imports use `.js` extension (ESM)
- Package exports: `types` condition first, then `import`, then `require`
- tsup for all package builds
- Dark theme UI: `#18181b` bg, `#6366f1` accent (indigo), `#e4e4e7` text
