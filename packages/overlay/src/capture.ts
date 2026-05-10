// ---------------------------------------------------------------------------
// Screen capture with persistent stream, frame grab, html2canvas fallback,
// and element cropping.
// ---------------------------------------------------------------------------

let activeStream: MediaStream | null = null;

// ---------------------------------------------------------------------------
// initScreenCapture
// ---------------------------------------------------------------------------

export async function initScreenCapture(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', frameRate: 1 } as any,
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as any);

    activeStream = stream;

    const settings = stream.getVideoTracks()[0]?.getSettings() as any;
    if (settings?.displaySurface && settings.displaySurface !== 'browser') {
      console.warn(
        '[Daub] User selected a window/screen instead of a browser tab. ' +
          'Screenshots may not match the current page.',
      );
    }

    return true;
  } catch (err) {
    console.log('[Daub] Screen Capture unavailable, using html2canvas fallback.');
    return false;
  }
}

// ---------------------------------------------------------------------------
// grabFrame
// ---------------------------------------------------------------------------

export async function grabFrame(): Promise<string | null> {
  if (!activeStream) return null;

  const track = activeStream.getVideoTracks()[0];
  if (!track || track.readyState !== 'live') return null;

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = activeStream;

    await new Promise<void>((resolve) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    video.pause();
    video.srcObject = null;

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// releaseStream
// ---------------------------------------------------------------------------

export function releaseStream(): void {
  activeStream?.getVideoTracks().forEach((t) => t.stop());
  activeStream = null;
}

// ---------------------------------------------------------------------------
// html2canvasFallback
// ---------------------------------------------------------------------------

export async function html2canvasFallback(
  element: HTMLElement,
): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: window.devicePixelRatio,
  });
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// cropToElement
// ---------------------------------------------------------------------------

export async function cropToElement(
  fullScreenshot: string,
  rect: DOMRect,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = fullScreenshot;
  });

  const scaleX = img.width / window.innerWidth;
  const scaleY = img.height / window.innerHeight;
  const padding = 32 * window.devicePixelRatio;

  const srcX = Math.max(0, rect.x * scaleX - padding);
  const srcY = Math.max(0, rect.y * scaleY - padding);
  const srcW = Math.min(
    img.width - srcX,
    rect.width * scaleX + padding * 2,
  );
  const srcH = Math.min(
    img.height - srcY,
    rect.height * scaleY + padding * 2,
  );

  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = srcH;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// captureElement
// ---------------------------------------------------------------------------

export async function captureElement(
  element: HTMLElement,
  hasScreenCapture: boolean,
): Promise<{ full: string; cropped: string }> {
  if (hasScreenCapture) {
    const frame = await grabFrame();
    if (frame) {
      const rect = element.getBoundingClientRect();
      const cropped = await cropToElement(frame, rect);
      return { full: frame, cropped };
    }
  }

  // Fallback: html2canvas already scoped to the element
  const result = await html2canvasFallback(element);
  return { full: result, cropped: result };
}
