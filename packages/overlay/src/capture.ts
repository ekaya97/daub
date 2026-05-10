// ---------------------------------------------------------------------------
// Element capture via html2canvas — zero permissions, no browser dialogs.
// ---------------------------------------------------------------------------

export async function captureElement(
  element: HTMLElement,
): Promise<{ full: string; cropped: string }> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: window.devicePixelRatio,
    logging: false,
  });
  const dataUrl = canvas.toDataURL('image/png');
  return { full: dataUrl, cropped: dataUrl };
}
