// @ts-check
// ─── Screen Capture API ───────────────────────────────────────────────────────
// getDisplayMedia API wrapper for screen capture functionality.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether getDisplayMedia (screen capture) is supported.
 */
export function isScreenCaptureSupported(): boolean {
  return 'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices;
}

/**
 * Request screen capture. Returns a MediaStream or null on failure/deny.
 */
export async function startScreenCapture(options?: {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}): Promise<MediaStream | null> {
  if (!isScreenCaptureSupported()) return null;
  try {
    const opts = options ?? { video: true };
    return await (navigator.mediaDevices as any).getDisplayMedia(opts);
  } catch {
    return null;
  }
}

/**
 * Stop all tracks in a media stream (end capture).
 */
export function stopCapture(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Capture a screenshot from a media stream as a Blob.
 * Creates a video element, draws to canvas, returns blob.
 * Returns null on failure.
 */
export async function captureFrame(stream: MediaStream): Promise<Blob | null> {
  try {
    const video = document.createElement('video') as HTMLVideoElement;
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video error'));
      video.play().catch(reject);
    });

    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvas.width = video.videoWidth || video.width;
    canvas.height = video.videoHeight || video.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video as any, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob));
    });
  } catch {
    return null;
  }
}

/**
 * Whether a media stream is active (has active tracks).
 */
export function isStreamActive(stream: MediaStream): boolean {
  return stream.active || stream.getTracks().some(t => t.readyState === 'live');
}
