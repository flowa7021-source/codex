// ─── Screen Orientation API ───────────────────────────────────────────────────
// Wraps the Screen Orientation API to track device orientation changes and
// adapt NovaReader's layout (single-page vs spread view) accordingly.

export type OrientationType =
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary'
  | 'unknown';

export interface OrientationStatus {
  type: OrientationType;
  angle: number;       // 0, 90, 180, 270
  isPortrait: boolean;
  isLandscape: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Access screen.orientation through a type-safe cast. */
function _screenOrientation(): ScreenOrientation | null {
  if (!('screen' in globalThis)) return null;
  const so = (screen as any).orientation;
  return so != null ? (so as ScreenOrientation) : null;
}

/** Derive an OrientationType from a raw string, with an 'unknown' fallback. */
function _toOrientationType(raw: string): OrientationType {
  switch (raw) {
    case 'portrait-primary':
    case 'portrait-secondary':
    case 'landscape-primary':
    case 'landscape-secondary':
      return raw as OrientationType;
    default:
      return 'unknown';
  }
}

/** Build an OrientationStatus by reading from screen.orientation. */
function _statusFromScreenOrientation(so: ScreenOrientation): OrientationStatus {
  const type = _toOrientationType(so.type);
  const angle = so.angle ?? 0;
  const isLandscape =
    type === 'landscape-primary' || type === 'landscape-secondary'
      ? true
      : type === 'portrait-primary' || type === 'portrait-secondary'
        ? false
        : angle === 90 || angle === 270;
  return { type, angle, isPortrait: !isLandscape, isLandscape };
}

/** Build an OrientationStatus by comparing window dimensions (fallback). */
function _statusFromDimensions(): OrientationStatus {
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  const isLandscape = w > h;
  return {
    type: 'unknown',
    angle: 0,
    isPortrait: !isLandscape,
    isLandscape,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Whether the Screen Orientation API is available in this environment.
 */
export function isScreenOrientationSupported(): boolean {
  return 'screen' in globalThis && 'orientation' in screen;
}

/**
 * Read the current orientation.
 * Falls back to comparing window.innerWidth/innerHeight when the API is absent.
 * Always returns a valid OrientationStatus — never throws.
 */
export function getOrientationStatus(): OrientationStatus {
  const so = _screenOrientation();
  if (so) {
    return _statusFromScreenOrientation(so);
  }
  return _statusFromDimensions();
}

/**
 * Subscribe to orientation changes.
 * Uses screen.orientation.addEventListener('change', …) when available,
 * otherwise falls back to window.addEventListener('orientationchange', …).
 * @returns Unsubscribe function — call it to remove the listener.
 */
export function onOrientationChange(
  handler: (status: OrientationStatus) => void,
): () => void {
  const so = _screenOrientation();

  if (so) {
    const listener = () => handler(getOrientationStatus());
    so.addEventListener('change', listener);
    return () => so.removeEventListener('change', listener);
  }

  if (typeof window !== 'undefined') {
    const listener = () => handler(getOrientationStatus());
    window.addEventListener('orientationchange', listener);
    return () => window.removeEventListener('orientationchange', listener);
  }

  // No API available — return a no-op unsubscribe.
  return () => {};
}

/**
 * Request that the device lock to the given orientation.
 * Resolves immediately (no-op) when the API is not available.
 */
export function lockOrientation(type: OrientationType): Promise<void> {
  const so = _screenOrientation();
  if (so && typeof (so as any).lock === 'function') {
    return (so as any).lock(type) as Promise<void>;
  }
  return Promise.resolve();
}

/**
 * Unlock a previously locked orientation.
 * No-op when the API is not available.
 */
export function unlockOrientation(): void {
  const so = _screenOrientation();
  if (so && typeof (so as any).unlock === 'function') {
    (so as any).unlock();
  }
}

/**
 * Suggest a view mode based on the current (or provided) orientation.
 * Returns 'spread' for landscape orientations and 'single' for portrait.
 */
export function getSuggestedViewMode(
  status?: OrientationStatus,
): 'single' | 'spread' {
  const s = status ?? getOrientationStatus();
  return s.isLandscape ? 'spread' : 'single';
}
