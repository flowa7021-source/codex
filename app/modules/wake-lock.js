// @ts-check
// ─── Screen Wake Lock ───────────────────────────────────────────────────────
// Prevents screen from sleeping during long-running operations (OCR, conversion).
// Uses the Screen Wake Lock API with automatic re-acquisition on visibility change.

/** @type {WakeLockSentinel | null} */
let _sentinel = null;

/** @type {(() => void) | null} */
let _visibilityHandler = null;

/**
 * Whether the Screen Wake Lock API is available.
 * @returns {boolean}
 */
export function isWakeLockSupported() {
  return 'wakeLock' in navigator;
}

/**
 * Acquire a screen wake lock. If the lock is already held, this is a no-op
 * that returns true. Adds a visibilitychange listener to re-acquire the lock
 * when the page becomes visible again (browsers release wake locks on tab switch).
 * @returns {Promise<boolean>} true if a lock is now held
 */
export async function requestWakeLock() {
  if (_sentinel && !_sentinel.released) {
    return true;
  }
  try {
    _sentinel = await navigator.wakeLock.request('screen');

    // Install visibilitychange handler to re-acquire on tab focus
    if (!_visibilityHandler) {
      _visibilityHandler = () => {
        if (
          document.visibilityState === 'visible' &&
          _sentinel &&
          _sentinel.released
        ) {
          navigator.wakeLock.request('screen').then((s) => {
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
 * @returns {Promise<void>}
 */
export async function releaseWakeLock() {
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
 * @returns {boolean}
 */
export function isWakeLockActive() {
  return _sentinel !== null && !_sentinel.released;
}

/**
 * Acquire a wake lock, run an async function, then release the lock.
 * The lock is released even if the function throws. This is the recommended
 * API for wrapping long-running operations (OCR, batch conversion).
 *
 * @template T
 * @param {() => Promise<T>} asyncFn
 * @returns {Promise<T>}
 */
export async function withWakeLock(asyncFn) {
  await requestWakeLock();
  try {
    return await asyncFn();
  } finally {
    await releaseWakeLock();
  }
}
