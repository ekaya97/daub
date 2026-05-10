const ALLOWED_ATTRS = ['id', 'class', 'type', 'href', 'src', 'alt', 'role', 'aria-label', 'data-testid'];

export function serializeDOM(el: Element, maxDepth = 3, currentDepth = 0): string {
  const tag = el.tagName.toLowerCase();

  const attrs = ALLOWED_ATTRS
    .filter(a => el.hasAttribute(a))
    .map(a => `${a}="${el.getAttribute(a)}"`)
    .join(' ');

  const attrStr = attrs ? ` ${attrs}` : '';
  const indent = '  '.repeat(currentDepth);

  if (currentDepth >= maxDepth) {
    const childCount = el.childElementCount;
    if (childCount > 0) {
      return `${indent}<${tag}${attrStr}><!-- ${childCount} child${childCount > 1 ? 'ren' : ''} omitted --></${tag}>`;
    }
    const text = el.textContent?.trim().slice(0, 50) ?? '';
    return `${indent}<${tag}${attrStr}>${text}</${tag}>`;
  }

  if (el.childElementCount === 0) {
    const text = el.textContent?.trim().slice(0, 100) ?? '';
    return `${indent}<${tag}${attrStr}>${text}</${tag}>`;
  }

  const children = Array.from(el.children)
    .map(child => serializeDOM(child, maxDepth, currentDepth + 1))
    .join('\n');

  return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
}
