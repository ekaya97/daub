# Daub — Unit Test Plan

> Covers `@daub/core`, `vite-plugin-daub`, and `@daub/next`. Excludes `@daub/overlay` (being redesigned).

---

## Test tooling

- **Vitest** — already installed at root
- **happy-dom** — for tests needing DOM (Element, classList, getComputedStyle)
- **No React testing library** — provider is a thin wrapper, not worth the dep for v1
- **Temp directories** — for filesystem write tests (use `node:os` tmpdir)
- **No mocking libraries** — use Vitest's built-in `vi.fn()`, `vi.mock()`, `vi.spyOn()`

---

## Package: @daub/core

### `serializer.test.ts` — `serializeToMarkdown()`

Pure function, no mocks needed. Test the markdown template logic.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Full context — all fields populated | Complete `ElementContext` with source, screenshots, delta, tailwind, notes | Markdown contains all sections: Component header, Before, After, Annotations, CSS delta table, Tailwind, DOM subtree, Notes |
| 2 | Null source — fallback to tagName | `source: null, tagName: 'div'` | Header: `## Component: div`, File: `unknown:0` |
| 3 | No after screenshot | `screenshotAfter: null` | "After" section absent from output |
| 4 | No annotations | `screenshotAnnotated: null` | "Annotations" section absent |
| 5 | Empty CSS delta | `cssDelta: []` | "CSS delta" section absent entirely |
| 6 | Non-empty CSS delta | `cssDelta: [{ property: 'gap', before: '8px', after: '16px' }]` | Markdown table with one row |
| 7 | Empty Tailwind classes | `tailwindClasses: []` | "Tailwind classes" section absent |
| 8 | Tailwind classes present | `tailwindClasses: ['p-4', 'bg-white']` | Inline code: `` `p-4 bg-white` `` |
| 9 | Empty classList | `classList: []` | Element line shows tagName only, no dots |
| 10 | Long htmlSubtree (>5000 chars) | 6000-char string | Truncated at 5000 + `<!-- truncated -->` |
| 11 | Empty notes | `notes: ''` | Shows `(none)` |
| 12 | Notes with content | `notes: 'Fix the gap'` | Shows `Fix the gap` |
| 13 | Session ID in file paths | sessionId `'abc123'` | Paths contain `.daub-output/abc123/` |
| 14 | Source with file and line | `source: { file: 'src/App.tsx', line: 42, ... }` | `**File:** src/App.tsx:42` |

### `styles.test.ts` — `diffStyles()`, `extractTailwindClasses()`

#### `diffStyles(before, after)`

Pure comparison logic — no DOM needed. Create `CapturedStyles` objects directly.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Identical styles | Same `CapturedStyles` for before and after | Empty array `[]` |
| 2 | One property changed | `before.gap = '8px'`, `after.gap = '16px'` | `[{ property: 'gap', before: '8px', after: '16px' }]` |
| 3 | Multiple properties changed | padding + color differ | Array with 2 entries |
| 4 | Whitespace normalization | `before: 'rgb(0, 0, 0)'`, `after: 'rgb(0,0,0)'` | Empty (treated as same) |
| 5 | Case normalization | `before: 'Block'`, `after: 'block'` | Empty (treated as same) |
| 6 | All properties changed | Every field differs | Array with all 48 entries |
| 7 | Empty string vs value | `before: ''`, `after: '16px'` | One delta |
| 8 | Property name kebab-case | camelCase key `backgroundColor` | Delta property is `background-color` |

#### `extractTailwindClasses()` (needs DOM mock)

| # | Test case | classList | Expected |
|---|---|---|---|
| 1 | Tailwind classes only | `['p-4', 'bg-white', 'rounded-lg']` | All three returned |
| 2 | Mixed classes | `['p-4', 'my-custom-class', 'flex']` | `['p-4', 'flex']` |
| 3 | No Tailwind classes | `['custom', 'another']` | Empty array |
| 4 | Empty classList | `[]` | Empty array |
| 5 | Exact prefix matches | `['flex', 'grid', 'block', 'hidden', 'absolute']` | All returned |
| 6 | Prefix with dash | `['bg-red-500', 'text-lg', 'font-bold']` | All returned |

**DOM mock strategy**: Create a minimal object `{ classList: { [Symbol.iterator]: ... } }` that implements iterable `classList` via `Array.from()`.

### `dom-serializer.test.ts` — `serializeDOM()`

Needs DOM-like objects. Use happy-dom or mock Elements.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Leaf element with text | `<p>Hello</p>` | `<p>Hello</p>` |
| 2 | Depth 1 with children | `<div><p>A</p><p>B</p></div>`, maxDepth=1 | Children shown at depth 0, truncated comment at depth 1 |
| 3 | Depth 0 — immediate truncate | Any element, maxDepth=0 | `<tag><!-- N children omitted -->` or text content |
| 4 | Attribute filtering | Element with id, class, onclick, style | Only id and class in output (onclick, style filtered out) |
| 5 | Allowed attributes | Element with data-testid, role, aria-label | All three in output |
| 6 | Long text content (leaf) | 200-char text, depth < max | Truncated at 100 chars |
| 7 | Long text content (at max depth) | 200-char text, at max depth | Truncated at 50 chars |
| 8 | Child count singular | 1 child at max depth | `<!-- 1 child omitted -->` |
| 9 | Child count plural | 3 children at max depth | `<!-- 3 children omitted -->` |
| 10 | Indentation | Nested 3 levels | Proper 2-space indent per level |
| 11 | Null text content | `textContent = null` | Empty string (no crash) |

### `write.test.ts` — `writeSessionToDisk()`, `ensureGitignore()`

Uses real filesystem with temp directories.

#### `writeSessionToDisk()`

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Valid write — text file | `{ sessionId: 'abc', files: { 'context.md': '# Hello' } }` | File created with content |
| 2 | Valid write — base64 image | `{ sessionId: 'abc', files: { 'before.png': 'iVBOR...' } }` | Binary PNG file created |
| 3 | Valid write — base64 with data URL prefix | `'data:image/png;base64,iVBOR...'` | Prefix stripped, file written correctly |
| 4 | Invalid session ID — special chars | `sessionId: '../etc'` | Throws "Invalid session ID" |
| 5 | Invalid session ID — too long | 65-char string | Throws "Invalid session ID" |
| 6 | Invalid session ID — empty | `sessionId: ''` | Throws "Invalid session ID" |
| 7 | Valid session ID formats | `'abc-123'`, `'ABC_def'`, `'a1b2'` | All succeed |
| 8 | Unexpected filename | `files: { 'evil.sh': '...' }` | Throws "Unexpected file" |
| 9 | Path traversal — sessionId | `sessionId: 'a/../../../etc'` | Throws (regex blocks this) |
| 10 | Empty file content | `files: { 'context.md': '' }` | File skipped (not written) |
| 11 | Multiple files | before.jpg + context.md | Both created in session dir |
| 12 | Returns session dir path | Valid input | Returns correct absolute path |
| 13 | Creates nested directories | outputDir doesn't exist | Creates recursively |

#### `ensureGitignore()`

| # | Test case | Condition | Expected |
|---|---|---|---|
| 1 | No .gitignore, modify=true | File doesn't exist | Creates .gitignore with entry |
| 2 | No .gitignore, modify=false | File doesn't exist | No file created, console.warn |
| 3 | .gitignore exists, dir not listed, modify=true | Existing file | Appends entry |
| 4 | .gitignore exists, dir already listed | Entry present | No modification |
| 5 | modify=false | Dir not listed | Only warns, no modification |

---

## Package: vite-plugin-daub

### `bootstrap.test.ts` — `generateBootstrapScript()`, `generateMountScript()`

Pure string generation, zero mocks.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Config values in output | `{ position: 'top-left', outputDir: '.out', shortcut: 'Ctrl+D', modifyGitignore: false }` | JSON contains all values |
| 2 | Token included | token `'abc-123'` | Config contains `"token":"abc-123"` |
| 3 | Project root included | projectRoot `'/Users/me/project'` | Config contains the root |
| 4 | Write endpoint hardcoded | Any input | Contains `"writeEndpoint":"/daub-write"` |
| 5 | Sets window global | Any input | Starts with `window.__DAUB_CONFIG__ =` |
| 6 | Mount script format | — | Contains `import { mountDaub } from '/@daub/overlay'` |
| 7 | Mount script calls mountDaub | — | Contains `mountDaub(window.__DAUB_CONFIG__)` |

### `middleware.test.ts` — `handleDaubWrite()`

Needs mock `req`/`res` objects. Key security tests.

**Mock setup:**
```ts
function mockReq(overrides): Connect.IncomingMessage
function mockRes(): { writeHead, end, statusCode, body }
function mockNext(): vi.Mock
```

#### Security checks

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Non-POST passes through | `method: 'GET'` | `next()` called, no response |
| 2 | Non-loopback rejected | `remoteAddress: '192.168.1.1'` | 403 Forbidden |
| 3 | IPv6 loopback accepted | `remoteAddress: '::1'` | Continues (not 403) |
| 4 | IPv4 loopback accepted | `remoteAddress: '127.0.0.1'` | Continues |
| 5 | IPv4-mapped IPv6 accepted | `remoteAddress: '::ffff:127.0.0.1'` | Continues |
| 6 | Undefined remoteAddress | `remoteAddress: undefined` | 403 Forbidden |
| 7 | Wrong CSRF token | `headers: { 'x-daub-token': 'wrong' }` | 403 Invalid token |
| 8 | Correct CSRF token | Matching token | Continues |
| 9 | Missing CSRF token | No `x-daub-token` header | 403 Invalid token |
| 10 | Payload too large | `Content-Length: 60MB` | 413 Payload too large |
| 11 | Payload within limit | `Content-Length: 1MB` | Continues |

#### Happy path

| # | Test case | Input | Expected |
|---|---|---|---|
| 12 | Valid POST creates files | Valid body with sessionId + files | 200, `{ ok: true, path: ... }` |
| 13 | Invalid session ID | `sessionId: '../bad'` | 400 error |
| 14 | Invalid filename | `files: { 'bad.exe': '...' }` | 400 error |
| 15 | Write error propagates | Filesystem permission error | 500 error |

### `plugin.test.ts` — `daub()` (Vite plugin structure)

Tests the plugin object shape and config resolution. No Vite server needed.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Plugin name | `daub()` | `plugin.name === 'vite-plugin-daub'` |
| 2 | Apply serve only | `daub()` | `plugin.apply === 'serve'` |
| 3 | Enforce post | `daub()` | `plugin.enforce === 'post'` |
| 4 | Default options | `daub()` | Verify defaults applied |
| 5 | Custom options | `daub({ position: 'top-left' })` | Options reflected |
| 6 | Disabled — no HTML injection | `daub({ enabled: false })` | `transformIndexHtml()` returns `[]` |
| 7 | Resolves virtual module | `resolveId('/@daub/overlay')` | Returns `'\0/@daub/overlay'` |
| 8 | Ignores other IDs | `resolveId('react')` | Returns undefined |
| 9 | HTML injection — two script tags | `transformIndexHtml()` | Returns array with 2 tag descriptors |
| 10 | First tag is config (head) | Result[0] | `tag: 'script', injectTo: 'head'`, contains `__DAUB_CONFIG__` |
| 11 | Second tag is module (body) | Result[1] | `tag: 'script', attrs: { type: 'module' }, injectTo: 'body'` |

---

## Package: @daub/next

### `next-adapter.test.ts` — `withDaub()`

Tests config wrapping and webpack modification logic.

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Returns config object | `withDaub({})` | Returns object with `webpack` function |
| 2 | Disabled — returns original | `withDaub({}, { enabled: false })` | Same reference as input |
| 3 | Preserves existing config | `withDaub({ reactStrictMode: true })` | `reactStrictMode` still present |
| 4 | Preserves existing webpack | Config with webpack function | Original webpack called |
| 5 | Turbopack detection | `context.webpack` is falsy | Console.warn logged, config returned unmodified |
| 6 | Server-side skipped | `context.isServer: true` | No entry modification |
| 7 | Production skipped | `context.dev: false` | No entry modification |
| 8 | DefinePlugin added | Dev + client context | `config.plugins` includes DefinePlugin with `__DAUB_CONFIG_JSON__` |
| 9 | Config JSON shape | — | Contains position, outputDir, projectRoot, writeEndpoint `/api/daub-write`, token, shortcut |

**Mock webpack context:**
```ts
const context = {
  dev: true,
  isServer: false,
  webpack: { DefinePlugin: vi.fn() },
};
const config = {
  entry: async () => ({ 'main-app': ['existing-entry.js'] }),
  plugins: [],
};
```

### `api-handler.test.ts` — `daubWriteHandler()` and `POST()`

Both handlers delegate to `@daub/core` write functions. Mock the core functions.

#### Pages Router (`daubWriteHandler`)

| # | Test case | Input | Expected |
|---|---|---|---|
| 1 | Non-POST rejected | `method: 'GET'` | 405 |
| 2 | Valid POST | Valid body | 200 `{ ok: true }` |
| 3 | Invalid session ID | Body with bad ID | 400 |
| 4 | Write error | Core throws | 500 |
| 5 | Default outputDir | No outputDir in body | Uses `.daub-output` |

#### App Router (`POST`)

| # | Test case | Input | Expected |
|---|---|---|---|
| 6 | Valid POST | `new Request(url, { method: 'POST', body: JSON.stringify(...) })` | Response with 200 |
| 7 | Invalid JSON | Bad body | 500 |
| 8 | Invalid session ID | Body with bad ID | 400 |
| 9 | Default outputDir | No outputDir | Uses `.daub-output` |

---

## Test file structure

```
packages/core/src/__tests__/
  serializer.test.ts
  styles.test.ts
  dom-serializer.test.ts
  write.test.ts

packages/plugin/src/__tests__/
  bootstrap.test.ts
  middleware.test.ts
  plugin.test.ts

packages/next/src/__tests__/
  next-adapter.test.ts
  api-handler.test.ts
```

---

## Priority order

1. **`write.test.ts`** — security-critical (path traversal, session ID validation)
2. **`middleware.test.ts`** — security-critical (loopback, CSRF, size limit)
3. **`serializer.test.ts`** — core output format, most likely to regress
4. **`styles.test.ts`** — `diffStyles` is pure and easy to test
5. **`bootstrap.test.ts`** — pure string, quick wins
6. **`plugin.test.ts`** — plugin structure verification
7. **`dom-serializer.test.ts`** — needs happy-dom, moderate complexity
8. **`next-adapter.test.ts`** — webpack mock complexity
9. **`api-handler.test.ts`** — delegates to core, lower ROI

Total: **~80 test cases** across **9 test files**.
