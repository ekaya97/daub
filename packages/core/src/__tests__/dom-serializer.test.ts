/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { serializeDOM } from '../dom-serializer.js';

// Helper to create DOM elements
function el(tag: string, attrs: Record<string, string> = {}, children: (Element | string)[] = []): Element {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

describe('serializeDOM', () => {
  it('serializes a leaf element with text', () => {
    const p = el('p', {}, ['Hello world']);
    const result = serializeDOM(p);
    expect(result).toBe('<p>Hello world</p>');
  });

  it('serializes element with allowed attributes', () => {
    const div = el('div', { id: 'main', class: 'container', role: 'main' }, ['Content']);
    const result = serializeDOM(div);
    expect(result).toContain('id="main"');
    expect(result).toContain('class="container"');
    expect(result).toContain('role="main"');
  });

  it('filters out non-allowed attributes', () => {
    const div = el('div', { onclick: 'alert(1)', style: 'color:red', 'data-testid': 'box' }, ['Hi']);
    const result = serializeDOM(div);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('style');
    expect(result).toContain('data-testid="box"');
  });

  it('truncates at maxDepth with child count', () => {
    const inner = el('span', {}, ['A']);
    const mid = el('div', {}, [inner]);
    const outer = el('section', {}, [mid]);

    const result = serializeDOM(outer, 1);
    // At depth 1, mid's children (inner) should be truncated
    expect(result).toContain('<!-- 1 child omitted -->');
  });

  it('uses singular "child" for 1 child', () => {
    const parent = el('div', {}, [el('p', {}, ['A'])]);
    const result = serializeDOM(parent, 0);
    expect(result).toContain('1 child omitted');
    expect(result).not.toContain('children');
  });

  it('uses plural "children" for multiple', () => {
    const parent = el('div', {}, [el('p'), el('p'), el('p')]);
    const result = serializeDOM(parent, 0);
    expect(result).toContain('3 children omitted');
  });

  it('truncates leaf text at 100 chars', () => {
    const longText = 'A'.repeat(200);
    const p = el('p', {}, [longText]);
    const result = serializeDOM(p, 3);
    expect(result.length).toBeLessThan(200 + 10); // tag overhead
    expect(result).toContain('A'.repeat(100));
    expect(result).not.toContain('A'.repeat(101));
  });

  it('truncates text at maxDepth at 50 chars', () => {
    const longText = 'B'.repeat(100);
    const p = el('p', {}, [longText]);
    const result = serializeDOM(p, 0);
    expect(result).toContain('B'.repeat(50));
    expect(result).not.toContain('B'.repeat(51));
  });

  it('indents nested elements correctly', () => {
    const inner = el('span', {}, ['text']);
    const outer = el('div', {}, [inner]);
    const result = serializeDOM(outer, 3);
    const lines = result.split('\n');
    // Inner element should be indented with 2 spaces
    expect(lines[1]).toMatch(/^\s{2}<span>/);
  });

  it('handles null textContent gracefully', () => {
    const empty = document.createElement('div');
    const result = serializeDOM(empty, 0);
    expect(result).toBe('<div></div>');
  });

  it('maxDepth 0 immediately truncates', () => {
    const nested = el('div', {}, [el('p', {}, [el('span', {}, ['deep'])])]);
    const result = serializeDOM(nested, 0);
    expect(result).toContain('1 child omitted');
    expect(result).not.toContain('<p');
  });
});
