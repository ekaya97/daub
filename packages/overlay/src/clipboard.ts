import type { ElementContext, DaubConfig } from '@daub/core';

// -- Image preparation --

async function prepareImage(dataUrl: string, keepPng = false): Promise<string> {
  const blob = await fetch(dataUrl).then(r => r.blob());
  const img = await createImageBitmap(blob);
  const MAX = 2048;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', 0.88);
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

// -- Disk write --

export async function writeToDisk(
  ctx: ElementContext,
  markdown: string,
  sessionId: string,
  config: DaubConfig,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const files: Record<string, string> = {};

    // Prepare images (resize + JPEG for before/after, PNG for annotations)
    files['before.jpg'] = stripDataUrlPrefix(await prepareImage(ctx.screenshotBefore));

    if (ctx.screenshotAfter) {
      files['after.jpg'] = stripDataUrlPrefix(await prepareImage(ctx.screenshotAfter));
    }
    if (ctx.screenshotAnnotated) {
      files['annotated.png'] = stripDataUrlPrefix(await prepareImage(ctx.screenshotAnnotated, true));
    }

    files['context.md'] = markdown;

    const res = await fetch(config.writeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Daub-Token': config.token,
      },
      body: JSON.stringify({ sessionId, files }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${body}` };
    }

    const data = await res.json();
    return { success: true, path: data.path };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// -- Clipboard --

export async function copyToClipboard(
  ctx: ElementContext,
  markdown: string,
  sessionId: string,
  config: DaubConfig,
): Promise<{ success: boolean; error?: string }> {
  // Start disk write (non-blocking — don't block clipboard on it)
  const writePromise = writeToDisk(ctx, markdown, sessionId, config).catch((e) => {
    console.warn('[Daub] Disk write failed:', e);
    return { success: false, error: String(e) };
  });

  // Clipboard write — use ClipboardItem with Promise values to preserve gesture (v2 B4)
  const primaryDataUrl = ctx.screenshotAnnotated ?? ctx.screenshotAfter ?? ctx.screenshotBefore;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': Promise.resolve(new Blob([markdown], { type: 'text/plain' })),
        'image/png': fetch(primaryDataUrl).then(r => r.blob()),
      }),
    ]);
  } catch {
    // Fallback: text only
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      await writePromise;
      return { success: false, error: 'Clipboard write failed. Use the markdown preview to copy manually.' };
    }
  }

  // Wait for disk write to finish
  const writeResult = await writePromise;
  if (!writeResult.success) {
    console.warn('[Daub] Files not saved to disk:', writeResult.error);
  }

  return { success: true };
}
