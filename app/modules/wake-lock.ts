// ─── Screen Wake Lock ───────────────────────────────────────────────────────
// Prevents screen from sleeping during long-running operations (OCR, conversion).
// Uses the Screen Wake Lock API with automatic re-acquisition on visibility change.

let _sentinel: any = null;

let _visibilityHandler: (() => void) | null = null;

/**
 * Whether the Screen Wake Lock API is available.
 */
export function isWakeLockSupported(): boolean {
  return 'wakeLock' in navigator;
}

/**
 * Acquire a screen wake lock. If the lock is already held, this is a no-op
 * that returns true. Adds a visibilitychange listener to re-acquire the lock
 * when the page becomes visible again (browsers release wake locks on tab switch).
 */
export async function requestWakeLock(): Promise<boolean> {
  if (_sentinel && !_sentinel.released) {
    return true;
  }
  try {
    _sentinel = await (navigator as any).wakeLock.request('screen');

    // Install visibilitychange handler to re-acquire on tab focus
    if (!_visibilityHandler) {
      _visibilityHandler = () => {
        if (
          document.visibilityState === 'visible' &&
          _sentinel &&
          _sentinel.released
        ) {
          (navigator as any).wakeLock.request('screen').then((s: any) => {
            _sentinel = s;
          }).catch(() => {
            // non-critical — ignore re-acquisition failure
          });
        }
      };
      document.addEventListener('visibilitychange', _visibilityHandler);
    }

    return true;
  } catch (err) {
    console.warn('[wake-lock] Failed to acquire wake lock:', err);
    return false;
  }
}

/**
 * Release the current wake lock and remove the visibilitychange listener.
 * Safe to call when no lock is held (no-op).
 */
export async function releaseWakeLock(): Promise<void> {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
  if (_sentinel) {
    try {
      await _sentinel.release();
    } catch (err) {
      console.warn('[wake-lock] Failed to release wake lock:', err);
    }
    _sentinel = null;
  }
}

/**
 * Whether a wake lock is currently held (not released).
 */
export function isWakeLockActive(): boolean {
  return _sentinel !== null && !_sentinel.released;
}

/**
 * Acquire a wake lock, run an async function, then release the lock.
 * The lock is released even if the function throws. This is the recommended
 * API for wrapping long-running operations (OCR, batch conversion).
 */
export async function withWakeLock<T>(asyncFn: () => Promise<T>): Promise<T> {
  await requestWakeLock();
  try {
    return await asyncFn();
  } finally {
    await releaseWakeLock();
  }
}
