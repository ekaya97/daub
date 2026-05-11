# @daub/core

Shared types and utilities for the Daub ecosystem. You don't need to install this directly -- it's included as a dependency of `@daub/vite-plugin` and `@daub/next`.

## What's inside

- **Types** -- `DaubOptions`, `DaubConfig`, `ElementContext`, `CapturedStyles`, `CssDelta`, `DaubSession`
- **Style capture** -- `captureStyles()` extracts 40+ CSS properties from computed styles
- **Serializer** -- `serializeToMarkdown()` generates the structured handoff document
- **DOM serializer** -- `serializeDOM()` captures element subtrees
- **Style differ** -- compares original vs edited computed styles

## License

MIT
