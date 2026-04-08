// @ts-check
// ─── Fullscreen API ──────────────────────────────────────────────────────────
// Fullscreen API wrapper for entering and exiting fullscreen mode.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Fullscreen API is supported.
 */
export function isFullscreenSupported(): boolean {
  return 'fullscreenEnabled' in document && document.fullscreenEnabled;
}

/**
 * Whether the document is currently in fullscreen mode.
 */
export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

/**
 * Request fullscreen for an element (defaults to documentElement).
 * Returns true on success, false on failure.
 */
export async function requestFullscreen(element?: Element): Promise<boolean> {
  const target = element ?? document.documentElement;
  try {
    await target.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

/**
 * Exit fullscreen. Returns true on success, false on failure.
 */
export async function exitFullscreen(): Promise<boolean> {
  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle fullscreen for an element.
 * Returns true if now in fullscreen, false otherwise.
 */
export async function toggleFullscreen(element?: Element): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
  } else {
    await requestFullscreen(element);
  }
  return isFullscreen();
}

/**
 * Register a callback for fullscreen changes.
 * Returns an unsubscribe function.
 */
export function onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void {
  const handler = () => callback(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  return () => document.removeEventListener('fullscreenchange', handler);
}
