// ─── Idle Detection ──────────────────────────────────────────────────────────
// Detects when the user is idle and provides hooks for pausing CPU-intensive
// background tasks (OCR, thumbnail generation) to conserve resources.
// Uses the Idle Detection API (Chrome 94+) with a visibilitychange +
// mousemove/keydown fallback for unsupported environments.

// @ts-check

/** Represents the user activity state. */
export type IdleState = 'active' | 'idle';

/** Represents the screen lock state. */
export type ScreenState = 'locked' | 'unlocked';

/** Combined idle status snapshot. */
export interface IdleStatus {
  /** Whether the user is active or idle. */
  user: IdleState;
  /** Whether the screen is locked or unlocked. */
  screen: ScreenState;
  /** Convenience flag: true when user === 'idle'. */
  isIdle: boolean;
}

// ─── Module-level state ──────────────────────────────────────────────────────

/** Current idle status, updated by whichever monitoring path is active. */
let _status: IdleStatus = {
  user: 'active',
  screen: 'unlocked',
  isIdle: false,
};

/** Set of handlers subscribed via {@link onIdleChange}. */
const _handlers = new Set<(status: IdleStatus) => void>();

/** Timestamp of the last user activity (used by the fallback path). */
let _lastActivityAt: number = Date.now();

/** ID of the fallback setInterval ticker. */
let _fallbackIntervalId: ReturnType<typeof setInterval> | null = null;

/** Bound references for fallback event listeners (so we can remove them). */
let _fallbackActivityHandler: (() => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the native Idle Detection API is available in this environment.
 */
export function isIdleDetectionSupported(): boolean {
  return 'IdleDetector' in globalThis;
}

/**
 * Start monitoring idle state.
 *
 * If the Idle Detection API is available and permission is granted, it is used.
 * Otherwise the module falls back to tracking `mousemove`, `keydown`,
 * `touchstart`, and `scroll` events on `document`, and polling every 5 seconds.
 *
 * @param opts.threshold - Inactivity threshold in milliseconds (default 60 000).
 * @returns A stop function that tears down all listeners and timers.
 */
export async function startIdleDetection(
  opts: { threshold?: number } = {},
): Promise<() => void> {
  const threshold = opts.threshold ?? 60_000;

  if (isIdleDetectionSupported()) {
    // Attempt to use the native API.
    try {
      // IdleDetector is not in the standard lib, so we access it via any.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IdleDetectorClass = (globalThis as any).IdleDetector as any;
      const permission: string = await IdleDetectorClass.requestPermission();
      if (permission === 'granted') {
        return _startNativeIdleDetection(IdleDetectorClass, threshold);
      }
    } catch {
      // Permission denied or API threw — fall through to fallback.
    }
  }

  return _startFallbackIdleDetection(threshold);
}

/**
 * Returns a snapshot of the current idle status.
 */
export function getIdleStatus(): IdleStatus {
  return { ..._status };
}

/**
 * Subscribe to idle state changes.
 * @returns An unsubscribe function.
 */
export function onIdleChange(handler: (status: IdleStatus) => void): () => void {
  _handlers.add(handler);
  return () => {
    _handlers.delete(handler);
  };
}

/**
 * Returns `true` when the user is currently considered idle.
 */
export function isCurrentlyIdle(): boolean {
  return _status.isIdle;
}

/**
 * Manually reset the idle countdown.
 * Useful when user activity is detected through custom mechanisms.
 */
export function resetIdleTimer(): void {
  _lastActivityAt = Date.now();
  if (_status.user !== 'active' || _status.screen !== 'unlocked') {
    _updateStatus('active', 'unlocked');
  }
}

// ─── Internal: native path ───────────────────────────────────────────────────

/**
 * Start monitoring via the native `IdleDetector` API.
 * @returns Stop function.
 */
function _startNativeIdleDetection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IdleDetectorClass: any,
  threshold: number,
): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detector: any = new IdleDetectorClass();

  const changeHandler = () => {
    const userState: IdleState = detector.userState ?? 'active';
    const screenState: ScreenState = detector.screenState ?? 'unlocked';
    _updateStatus(userState, screenState);
  };

  detector.addEventListener('change', changeHandler);

  // Start the detector (returns a Promise in the spec).
  detector.start({ threshold }).catch(() => {
    // If start fails, fall back to event-based detection silently.
  });

  return () => {
    try {
      detector.removeEventListener('change', changeHandler);
      detector.stop?.();
    } catch {
      // Best-effort cleanup.
    }
  };
}

// ─── Internal: fallback path ─────────────────────────────────────────────────

/** Events that indicate user activity (on `document`). */
const _ACTIVITY_EVENTS: ReadonlyArray<string> = [
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
];

/**
 * Start monitoring via document event listeners + polling.
 * @returns Stop function.
 */
function _startFallbackIdleDetection(threshold: number): () => void {
  _lastActivityAt = Date.now();

  const onActivity = (): void => {
    _lastActivityAt = Date.now();
    if (_status.isIdle) {
      _updateStatus('active', 'unlocked');
    }
  };

  _fallbackActivityHandler = onActivity;

  for (const evt of _ACTIVITY_EVENTS) {
    document.addEventListener(evt, onActivity, { passive: true });
  }

  // Poll every 5 seconds to check if the threshold has been exceeded.
  const POLL_INTERVAL = 5_000;

  _fallbackIntervalId = setInterval(() => {
    const elapsed = Date.now() - _lastActivityAt;
    if (elapsed >= threshold && !_status.isIdle) {
      _updateStatus('idle', 'unlocked');
    }
  }, POLL_INTERVAL);

  return () => {
    if (_fallbackActivityHandler) {
      for (const evt of _ACTIVITY_EVENTS) {
        document.removeEventListener(evt, _fallbackActivityHandler);
      }
      _fallbackActivityHandler = null;
    }
    if (_fallbackIntervalId !== null) {
      clearInterval(_fallbackIntervalId);
      _fallbackIntervalId = null;
    }
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Update the internal status and notify all handlers if it changed.
 */
function _updateStatus(user: IdleState, screen: ScreenState): void {
  const isIdle = user === 'idle';
  const changed =
    _status.user !== user ||
    _status.screen !== screen ||
    _status.isIdle !== isIdle;

  if (!changed) return;

  _status = { user, screen, isIdle };

  for (const handler of _handlers) {
    try {
      handler({ ..._status });
    } catch {
      // Don't let a faulty handler break notification loop.
    }
  }
}
