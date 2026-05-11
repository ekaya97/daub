# @daub/vite-plugin

Vite plugin that injects the Daub visual context widget into your dev app. Select a component, annotate it, tweak styles, and hand off rich context to Claude Code.

## Install

```bash
npm install -D @daub/vite-plugin
```

## Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import daub from '@daub/vite-plugin';

export default defineConfig({
  plugins: [daub()],
});
```

## Options

```ts
daub({
  enabled: true,            // default: true (only runs in dev)
  position: 'bottom-right', // trigger button position
  shortcut: 'Alt+Shift+D',  // keyboard shortcut to activate
  triggerStyle: 'pill',      // 'pill' or 'compact'
  outputDir: '.daub-output', // where screenshots are saved
})
```

## How it works

The plugin serves the Daub overlay as a virtual module (`/@daub/overlay`) and injects it into your app's HTML during development. The overlay lives in a Shadow DOM so it never interferes with your app's styles. Only active in `serve` mode -- no impact on production builds.

## License

MIT
