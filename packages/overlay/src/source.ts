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

  // Walk the fiber .return chain looking for _debugSource
  while (fiber) {
    const debugSource = fiber._debugSource;
    if (debugSource) {
      const fileName: string = debugSource.fileName ?? '';
      const lineNumber: number = debugSource.lineNumber ?? 0;
      const columnNumber: number = debugSource.columnNumber ?? 0;
      const componentName = getComponentName(fiber);

      return {
        file: normalizePath(fileName),
        line: lineNumber,
        column: columnNumber,
        componentName,
        framework: 'react',
      };
    }

    fiber = fiber.return;
  }

  return null;
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
// Private: resolveVue (stub)
// ---------------------------------------------------------------------------

function resolveVue(element: HTMLElement): SourceLocation | null {
  const component = (element as any).__vueParentComponent;
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
// Private: resolveSvelte (stub)
// ---------------------------------------------------------------------------

function resolveSvelte(element: HTMLElement): SourceLocation | null {
  const component = (element as any).__svelte_component__;
  if (!component) return null;

  // Basic stub — Svelte does not expose source locations in the same way
  return null;
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
