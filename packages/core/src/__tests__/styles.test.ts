import { describe, it, expect } from 'vitest';
import { diffStyles, extractTailwindClasses } from '../styles.js';
import type { CapturedStyles } from '../types.js';

// ---------------------------------------------------------------------------
// Helper: create a CapturedStyles with all empty strings, then override
// ---------------------------------------------------------------------------

function makeStyles(overrides: Partial<CapturedStyles> = {}): CapturedStyles {
  return {
    display: '', position: '', width: '', height: '', minWidth: '', maxWidth: '', minHeight: '', maxHeight: '',
    padding: '', paddingTop: '', paddingRight: '', paddingBottom: '', paddingLeft: '',
    margin: '', marginTop: '', marginRight: '', marginBottom: '', marginLeft: '',
    flexDirection: '', flexWrap: '', justifyContent: '', alignItems: '', alignSelf: '',
    gap: '', rowGap: '', columnGap: '', flexGrow: '', flexShrink: '', flexBasis: '',
    gridTemplateColumns: '', gridTemplateRows: '',
    backgroundColor: '', color: '', borderColor: '', borderWidth: '', borderStyle: '', borderRadius: '',
    opacity: '', overflow: '', overflowX: '', overflowY: '',
    fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', textAlign: '', textOverflow: '', whiteSpace: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// diffStyles
// ---------------------------------------------------------------------------

describe('diffStyles', () => {
  it('returns empty array for identical styles', () => {
    const styles = makeStyles({ display: 'flex', gap: '8px' });
    expect(diffStyles(styles, styles)).toEqual([]);
  });

  it('detects a single changed property', () => {
    const before = makeStyles({ gap: '8px' });
    const after = makeStyles({ gap: '16px' });
    const deltas = diffStyles(before, after);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toEqual({ property: 'gap', before: '8px', after: '16px' });
  });

  it('detects multiple changed properties', () => {
    const before = makeStyles({ gap: '8px', color: 'red' });
    const after = makeStyles({ gap: '16px', color: 'blue' });
    const deltas = diffStyles(before, after);
    expect(deltas).toHaveLength(2);
    expect(deltas.find(d => d.property === 'gap')).toBeTruthy();
    expect(deltas.find(d => d.property === 'color')).toBeTruthy();
  });

  it('normalizes whitespace — collapses multiple spaces', () => {
    const before = makeStyles({ backgroundColor: 'rgb(0,  0,  0)' });
    const after = makeStyles({ backgroundColor: 'rgb(0, 0, 0)' });
    expect(diffStyles(before, after)).toEqual([]);
  });

  it('normalizes case — treats as identical', () => {
    const before = makeStyles({ display: 'Block' });
    const after = makeStyles({ display: 'block' });
    expect(diffStyles(before, after)).toEqual([]);
  });

  it('detects empty string vs value', () => {
    const before = makeStyles({ gap: '' });
    const after = makeStyles({ gap: '16px' });
    const deltas = diffStyles(before, after);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].before).toBe('');
    expect(deltas[0].after).toBe('16px');
  });

  it('converts camelCase to kebab-case in property name', () => {
    const before = makeStyles({ backgroundColor: 'white' });
    const after = makeStyles({ backgroundColor: 'red' });
    const deltas = diffStyles(before, after);
    expect(deltas[0].property).toBe('background-color');
  });

  it('converts multi-word camelCase properties', () => {
    const before = makeStyles({ gridTemplateColumns: 'none' });
    const after = makeStyles({ gridTemplateColumns: '1fr 1fr' });
    const deltas = diffStyles(before, after);
    expect(deltas[0].property).toBe('grid-template-columns');
  });
});

// ---------------------------------------------------------------------------
// extractTailwindClasses
// ---------------------------------------------------------------------------

describe('extractTailwindClasses', () => {
  // Mock element with classList
  function mockElement(classes: string[]): HTMLElement {
    return { classList: classes } as any;
  }

  it('returns Tailwind classes from a mixed list', () => {
    // Note: 'my-custom' starts with 'm-' prefix so it's matched as Tailwind (heuristic)
    // Use a class that doesn't start with any Tailwind prefix
    const el = mockElement(['p-4', 'app-header', 'bg-white', 'rounded-lg']);
    const result = extractTailwindClasses(el);
    expect(result).toContain('p-4');
    expect(result).toContain('bg-white');
    expect(result).toContain('rounded-lg');
    expect(result).not.toContain('app-header');
  });

  it('returns empty array for no Tailwind classes', () => {
    const el = mockElement(['custom-class', 'another-one']);
    expect(extractTailwindClasses(el)).toEqual([]);
  });

  it('returns empty array for empty classList', () => {
    const el = mockElement([]);
    expect(extractTailwindClasses(el)).toEqual([]);
  });

  it('recognizes exact prefix matches (no dash)', () => {
    const el = mockElement(['flex', 'grid', 'block', 'hidden', 'absolute', 'relative', 'fixed', 'sticky']);
    const result = extractTailwindClasses(el);
    expect(result).toContain('flex');
    expect(result).toContain('grid');
    expect(result).toContain('block');
    expect(result).toContain('hidden');
    expect(result).toContain('absolute');
  });

  it('recognizes dash-prefixed Tailwind utilities', () => {
    const el = mockElement(['bg-red-500', 'text-lg', 'font-bold', 'border-2', 'rounded-md']);
    const result = extractTailwindClasses(el);
    expect(result.length).toBe(5);
  });

  it('recognizes spacing utilities', () => {
    const el = mockElement(['p-4', 'px-2', 'py-3', 'pt-1', 'm-4', 'mx-auto', 'mt-8', 'gap-4']);
    const result = extractTailwindClasses(el);
    expect(result.length).toBe(8);
  });
});
