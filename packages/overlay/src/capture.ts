// ---------------------------------------------------------------------------
// Pixel-perfect element capture via Screen Capture API.
// Requests permission, grabs a single frame, releases immediately.
// Dialog shows once per capture; sharing banner disappears in ~1 second.
// ---------------------------------------------------------------------------

export async function captureElement(
  element: HTMLElement,
): Promise<{ full: string; cropped: string }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 1 } as any,
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  } as any);

  try {
    // Grab a single frame via video element (cross-browser, no ImageCapture)
    const full = await grabFrame(stream);

    // Release immediately — banner disappears
    stream.getVideoTracks().forEach(t => t.stop());

    // Crop to element
    const rect = element.getBoundingClientRect();
    const cropped = await cropToRect(full, rect);

    return { full, cropped };
  } catch (e) {
    stream.getVideoTracks().forEach(t => t.stop());
    throw e;
  }
}

async function grabFrame(stream: MediaStream): Promise<string> {
  const video = document.createElement('video');
  video.muted = true;
  video.srcObject = stream;

  await new Promise<void>(resolve => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
  });
  await video.play();

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);

  video.pause();
  video.srcObject = null;

  return canvas.toDataURL('image/png');
}

async function cropToRect(fullScreenshot: string, rect: DOMRect): Promise<string> {
  const img = await loadImage(fullScreenshot);

  const scaleX = img.width / window.innerWidth;
  const scaleY = img.height / window.innerHeight;
  const padding = 32 * window.devicePixelRatio;

  const srcX = Math.max(0, rect.left * scaleX - padding);
  const srcY = Math.max(0, rect.top * scaleY - padding);
  const srcW = Math.min(img.width - srcX, rect.width * scaleX + padding * 2);
  const srcH = Math.min(img.height - srcY, rect.height * scaleY + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = srcH;
  canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
