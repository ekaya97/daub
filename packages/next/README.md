# @daub/next

Next.js adapter for Daub. Wraps your Next.js config to inject the Daub visual context widget during development.

## Install

```bash
npm install -D @daub/next
```

## Setup

```ts
// next.config.ts
import { withDaub } from '@daub/next';

export default withDaub({
  // your next config
});
```

## Options

```ts
withDaub(nextConfig, {
  enabled: true,            // default: true
  position: 'bottom-right', // trigger button position
  shortcut: 'Alt+Shift+D',  // keyboard shortcut
  triggerStyle: 'pill',      // 'pill' or 'compact'
  outputDir: '.daub-output', // screenshot output directory
})
```

## Requirements

- Next.js 13+ with webpack (run with `--no-turbo` if using Turbopack)

## License

MIT
