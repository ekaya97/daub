# Contributing to Daub

## Setup

```bash
git clone <repo-url>
cd daub
pnpm install
pnpm build
```

## Build order

Packages have build dependencies: `core -> overlay -> plugin -> next`. The root `pnpm build` runs them sequentially. For iterating on the overlay UI, use `pnpm dev` which watches core + overlay.

## Testing

```bash
pnpm test            # run all tests
pnpm --filter @daub/core test  # run core tests only
```

## Manual test checklist

Use `examples/react-vite/` as the test app:

```bash
cd examples/react-vite
pnpm dev
```

Then verify:

- [ ] Trigger button appears in bottom-right corner
- [ ] Click trigger -> select mode with dim overlay + cursor tooltip
- [ ] Click a component -> panel opens with correct component name + source file
- [ ] **Annotate tab**: pen, arrow, rect, text tools work; undo/redo; zoom; grab to pan; colors; strokes persist across tab switches
- [ ] **Edit tab**: breadcrumb shows component path; children chips are clickable; drill into child updates highlight + sections; before/after toggle works; spacing/size/layout/typography/color sections apply changes to live element
- [ ] **Output tab**: structured summary shows correct data; toggling chips updates preview; copy button copies to clipboard; screenshots display inline
- [ ] **History tab**: previous sessions appear; search filters; click restores session
- [ ] Panel: drag by grip bar; resize from top/left/corner; minimize collapses to header; close removes panel
- [ ] Keyboard: shortcut activates picker; Escape closes picker/panel; tool shortcuts (P/A/R/T/E/G) in annotate; Cmd+Z undo
- [ ] Reselect target (crosshair button) saves current session to history

## Architecture

```
packages/core/       # types, serializer, style differ, DOM serializer
packages/overlay/    # browser UI (shadow DOM, vanilla TS)
packages/plugin/     # Vite plugin, virtual module, middleware
packages/next/       # Next.js adapter
packages/extension/  # browser extension (stub)
examples/react-vite/ # test app
```

The overlay is built as ESM by tsup, then copied into `plugin/dist/` at build time. The plugin serves it as a virtual module (`/@daub/overlay`). All UI lives inside a Shadow DOM with adopted stylesheets.

## Conventions

- TypeScript strict mode
- All imports use `.js` extension (ESM)
- tsup for all package builds
- No framework dependencies in the overlay (vanilla TS + DOM APIs)
- Ticket tracking via `.track/` -- see `.track/CONVENTIONS.md`

## Releasing

This project uses [changesets](https://github.com/changesets/changesets) for versioning:

```bash
pnpm changeset          # create a changeset
pnpm changeset version  # bump versions
pnpm build
pnpm changeset publish  # publish to npm
```
