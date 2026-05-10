// ---------------------------------------------------------------------------
// Element capture via dom-to-image-more — uses SVG foreignObject so the
// browser does the rendering. Supports oklch(), modern CSS, zero permissions.
// ---------------------------------------------------------------------------

export async function captureElement(
  element: HTMLElement,
): Promise<{ full: string; cropped: string }> {
  const domtoimage = await import('dom-to-image-more');
  const dataUrl = await domtoimage.toPng(element, {
    width: element.scrollWidth,
    height: element.scrollHeight,
    style: {},
    cacheBust: true,
  });
  return { full: dataUrl, cropped: dataUrl };
}
