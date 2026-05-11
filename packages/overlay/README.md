# @daub/overlay

Browser UI for Daub -- the floating widget with annotate, edit, output, and history tabs. Built with vanilla TypeScript and Shadow DOM, zero framework dependencies.

You don't need to install this directly -- it's bundled into `@daub/vite-plugin` and served as a virtual module.

## Architecture

- Shadow DOM with adopted stylesheets for full style isolation
- Imperative DOM manipulation (no virtual DOM)
- Canvas-based annotation tools (pen, arrow, rect, text, eraser)
- Component tree navigator for drilling into child elements
- IndexedDB session persistence

## License

MIT
