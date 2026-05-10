import type { CapturedStyles, CssDelta } from './types.js';

const STYLE_KEYS: (keyof CapturedStyles)[] = [
  'display', 'position', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf',
  'gap', 'rowGap', 'columnGap', 'flexGrow', 'flexShrink', 'flexBasis',
  'gridTemplateColumns', 'gridTemplateRows',
  'backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderStyle', 'borderRadius',
  'opacity', 'overflow', 'overflowX', 'overflowY',
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textOverflow', 'whiteSpace',
];

export function captureStyles(element: HTMLElement): CapturedStyles {
  const computed = getComputedStyle(element);
  const result = {} as CapturedStyles;
  for (const key of STYLE_KEYS) {
    result[key] = (computed as any)[key] ?? '';
  }
  return result;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function diffStyles(before: CapturedStyles, after: CapturedStyles): CssDelta[] {
  const deltas: CssDelta[] = [];
  for (const key of STYLE_KEYS) {
    const b = normalize(before[key] ?? '');
    const a = normalize(after[key] ?? '');
    if (b !== a) {
      deltas.push({
        property: key.replace(/([A-Z])/g, '-$1').toLowerCase(),
        before: before[key],
        after: after[key],
      });
    }
  }
  return deltas;
}

const TAILWIND_PREFIXES = [
  'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-',
  'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-',
  'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
  'flex', 'grid', 'gap-', 'space-',
  'bg-', 'text-', 'font-', 'leading-', 'tracking-',
  'border', 'rounded', 'shadow',
  'justify-', 'items-', 'self-', 'content-',
  'overflow-', 'opacity-', 'z-',
  'absolute', 'relative', 'fixed', 'sticky',
  'hidden', 'block', 'inline', 'container',
  'top-', 'right-', 'bottom-', 'left-', 'inset-',
];

export function extractTailwindClasses(element: HTMLElement): string[] {
  return Array.from(element.classList).filter(cls =>
    TAILWIND_PREFIXES.some(prefix => cls.startsWith(prefix) || cls === prefix.replace(/-$/, ''))
  );
}
