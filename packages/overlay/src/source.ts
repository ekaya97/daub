import type { SourceLocation } from '@daub/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ANCESTORS = 50;
const RESOLVE_INTERVAL = 50; // ms

// ---------------------------------------------------------------------------
// Throttle + cache state
// ---------------------------------------------------------------------------

const sourceCache = new WeakMap<HTMLElement, SourceLocation | null>();
let lastResolveTime = 0;

// ---------------------------------------------------------------------------
// Public: detectFramework
// ---------------------------------------------------------------------------

export function detectFramework(
  element: HTMLElement,
): 'react' | 'vue' | 'svelte' | 'unknown' {
  let node: HTMLElement | null = element;
  let depth = 0;

  while (node && depth < MAX_ANCESTORS) {
    const keys = Object.keys(node);

    if (
      keys.some(
        (k) =>
          k.startsWith('__reactFiber$') ||
          k.startsWith('__reactInternalInstance$'),
      )
    ) {
      return 'react';
    }

    if ('__vueParentComponent' in node) {
      return 'vue';
    }

    if ('__svelte_component__' in node) {
      return 'svelte';
    }

    node = node.parentElement;
    depth++;
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public: resolveSource (throttled + cached)
// ---------------------------------------------------------------------------

export function resolveSource(element: HTMLElement): SourceLocation | null {
  // Cache hit — return immediately regardless of throttle
  const cached = sourceCache.get(element);
  if (cached !== undefined) return cached;

  // Throttle — skip if called too soon after last resolve
  const now = Date.now();
  if (now - lastResolveTime < RESOLVE_INTERVAL) return null;

  // Resolve via multi-framework chain
  const result =
    resolveReact(element) ??
    resolveVue(element) ??
    resolveSvelte(element) ??
    null;

  // Update cache and timestamp
  sourceCache.set(element, result);
  lastResolveTime = now;

  return result;
}

// ---------------------------------------------------------------------------
// Private: resolveReact
// ---------------------------------------------------------------------------

function resolveReact(element: HTMLElement): SourceLocation | null {
  const fiberKey = Object.keys(element).find(
    (k) =>
      k.startsWith('__reactFiber$') ||
      k.startsWith('__reactInternalInstance$'),
  );

  if (!fiberKey) return null;

  let fiber = (element as any)[fiberKey];

  // Walk the fiber .return chain
  while (fiber) {
    // React 17/18: _debugSource on fibers
    const debugSource = fiber._debugSource;
    if (debugSource) {
      return {
        file: normalizePath(debugSource.fileName ?? ''),
        line: debugSource.lineNumber ?? 0,
        column: debugSource.columnNumber ?? 0,
        componentName: getComponentName(fiber),
        framework: 'react',
      };
    }

    // React 19+: _debugSource removed. Use _debugStack (formatted stack trace)
    // and _debugOwner (parent component fiber) for component name.
    // Walk up to find the nearest function component with a _debugStack.
    if (fiber._debugStack && typeof fiber.type === 'function' && fiber.type.name) {
      const parsed = parseDebugStack(fiber._debugStack);
      return {
        file: normalizePath(parsed.file),
        line: parsed.line,
        column: parsed.column,
        componentName: fiber.type.name,
        framework: 'react',
      };
    }

    fiber = fiber.return;
  }

  // React 19 fallback: walk fiber tree for any named component
  fiber = (element as any)[fiberKey];
  while (fiber) {
    if (typeof fiber.type === 'function' && fiber.type.name) {
      return {
        file: '',
        line: 0,
        column: 0,
        componentName: fiber.type.name,
        framework: 'react',
      };
    }
    if (typeof fiber.type === 'object' && fiber.type?.displayName) {
      return {
        file: '',
        line: 0,
        column: 0,
        componentName: fiber.type.displayName,
        framework: 'react',
      };
    }
    fiber = fiber.return;
  }

  return null;
}

// Parse React 19's _debugStack which is an Error-like object or string
function parseDebugStack(stack: any): { file: string; line: number; column: number } {
  const empty = { file: '', line: 0, column: 0 };
  const str = typeof stack === 'string' ? stack : stack?.stack ?? String(stack);
  if (!str) return empty;

  // Match stack frame patterns like:
  //   at ComponentName (http://localhost:5173/src/App.tsx?t=123:12:5)
  //   at http://localhost:5173/src/App.tsx:12:5
  // Skip node_modules frames (e.g., react runtime, jsx-dev-runtime)
  const lines = str.split('\n');
  for (const line of lines) {
    if (line.includes('node_modules')) continue;

    const match = line.match(/(?:https?:\/\/[^/]+)?(\/[^?:]+(?:\.[tj]sx?))[^:]*:(\d+):(\d+)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      };
    }
  }

  return empty;
}

// ---------------------------------------------------------------------------
// Private: getComponentName
// ---------------------------------------------------------------------------

function getComponentName(fiber: any): string {
  let current = fiber;

  while (current) {
    const type = current.type;

    if (typeof type === 'function' && type.name) {
      return type.name;
    }

    if (typeof type === 'object' && type !== null && type.displayName) {
      return type.displayName;
    }

    current = current.return;
  }

  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Private: resolveVue
// File path only, no line number (Vue limitation)
// ---------------------------------------------------------------------------

function resolveVue(element: HTMLElement): SourceLocation | null {
  // Check the element itself first
  let component = (element as any).__vueParentComponent;

  // Walk up the DOM tree (max 10 ancestors) looking for a Vue component
  if (!component) {
    let node: HTMLElement | null = element.parentElement;
    let depth = 0;

    while (node && depth < 10) {
      if ((node as any).__vueParentComponent) {
        component = (node as any).__vueParentComponent;
        break;
      }
      node = node.parentElement;
      depth++;
    }
  }

  if (!component) return null;

  const type = component.type;
  if (!type) return null;

  const file = type.__file;
  if (!file) return null;

  const componentName: string = type.name ?? type.__name ?? 'Unknown';

  return {
    file: normalizePath(file),
    line: 0,
    column: 0,
    componentName,
    framework: 'vue',
  };
}

// ---------------------------------------------------------------------------
// Private: resolveSvelte
// Experimental — Svelte 4 only, Svelte 5 not supported
// ---------------------------------------------------------------------------

function resolveSvelte(element: HTMLElement): SourceLocation | null {
  // Check the element itself for Svelte 4 internals
  let comp = (element as any).__svelte_component__;
  let meta = (element as any).__svelte_meta;

  // Walk up the DOM tree (max 10 ancestors) looking for Svelte component data
  if (!comp && !meta) {
    let node: HTMLElement | null = element.parentElement;
    let depth = 0;

    while (node && depth < 10) {
      if ((node as any).__svelte_component__) {
        comp = (node as any).__svelte_component__;
        break;
      }
      if ((node as any).__svelte_meta) {
        meta = (node as any).__svelte_meta;
        break;
      }
      node = node.parentElement;
      depth++;
    }
  }

  if (!comp && !meta) {
    // Svelte 5 runes or no Svelte component found — return null gracefully
    return null;
  }

  const componentName: string = comp?.constructor?.name ?? 'Unknown';

  // Attempt to extract file path from Svelte internals
  let file = '';
  if (meta?.loc?.file) {
    file = meta.loc.file;
  } else if (comp?.$$?.ctx) {
    // ctx is an array; file info is not reliably stored here,
    // fall back to the constructor name as an identifier
    file = componentName;
  } else {
    file = componentName;
  }

  return {
    file: normalizePath(file),
    line: 0,
    column: 0,
    componentName,
    framework: 'svelte',
  };
}

// ---------------------------------------------------------------------------
// Private: normalizePath
// ---------------------------------------------------------------------------

function normalizePath(absolutePath: string): string {
  const projectRoot: string =
    (window as any).__DAUB_CONFIG__?.projectRoot ?? '';

  // Normalize backslashes to forward slashes
  let normalized = absolutePath.replace(/\\/g, '/');

  // Strip projectRoot prefix + any trailing slash
  if (projectRoot) {
    const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized.startsWith(normalizedRoot)) {
      normalized = normalized.slice(normalizedRoot.length);
      // Remove leading slash left after stripping the root
      normalized = normalized.replace(/^\/+/, '');
    }
  }

  return normalized;
}
