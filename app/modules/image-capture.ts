// @ts-check
// ─── ImageCapture API ─────────────────────────────────────────────────────────
// ImageCapture API wrapper for capturing photos and frames from video tracks.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the ImageCapture API is supported.
 */
export function isImageCaptureSupported(): boolean {
  return typeof (globalThis as any).ImageCapture !== 'undefined';
}

/**
 * Create an ImageCapture instance from a video track.
 * Returns null if unsupported.
 */
export function createImageCapture(track: MediaStreamTrack): ImageCapture | null {
  if (!isImageCaptureSupported()) return null;
  try {
    return new (globalThis as any).ImageCapture(track) as ImageCapture;
  } catch {
    return null;
  }
}

/**
 * Take a photo from a video track. Returns a Blob or null.
 */
export async function takePhoto(track: MediaStreamTrack, options?: any): Promise<Blob | null> {
  const capture = createImageCapture(track);
  if (!capture) return null;
  try {
    return await (capture as any).takePhoto(options ?? {});
  } catch {
    return null;
  }
}

/**
 * Grab a frame from a video track. Returns an ImageBitmap or null.
 */
export async function grabFrame(track: MediaStreamTrack): Promise<ImageBitmap | null> {
  const capture = createImageCapture(track);
  if (!capture) return null;
  try {
    return await (capture as any).grabFrame();
  } catch {
    return null;
  }
}

/**
 * Get photo capabilities for a track. Returns null if unsupported.
 */
export async function getPhotoCapabilities(track: MediaStreamTrack): Promise<any | null> {
  const capture = createImageCapture(track);
  if (!capture) return null;
  try {
    return await (capture as any).getPhotoCapabilities();
  } catch {
    return null;
  }
}
