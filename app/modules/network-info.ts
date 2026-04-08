// ─── Network Information API ──────────────────────────────────────────────────
// Wraps navigator.connection (Network Information API) to expose the user's
// current connection type and speed, and derives quality hints for rendering,
// thumbnail resolution, and page prefetching.

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | '4g'
  | '3g'
  | '2g'
  | 'slow-2g'
  | 'ethernet'
  | 'none'
  | 'unknown';

export type EffectiveType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

export interface NetworkStatus {
  isOnline: boolean;
  type: ConnectionType;
  effectiveType: EffectiveType;
  downlink: number | null;  // Mbps, null if unknown
  rtt: number | null;       // ms, null if unknown
  saveData: boolean;        // navigator.connection.saveData
}

export interface QualityHints {
  renderDpi: number;                        // suggested DPI (72-300)
  thumbnailSize: 'small' | 'medium' | 'large';
  prefetchPages: number;                    // how many pages ahead to prefetch
  enableAnimations: boolean;
}

// ─── Local interface (avoids global augmentation) ────────────────────────────

interface NetworkInformation extends EventTarget {
  type?: ConnectionType;
  effectiveType?: EffectiveType;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// ─── Module-level state ──────────────────────────────────────────────────────

let _currentStatus: NetworkStatus = _readStatus();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Network Information API is available in this environment.
 */
export function isNetworkInfoSupported(): boolean {
  return 'connection' in navigator;
}

/**
 * Returns the current network status, reading from `navigator.connection`
 * when available and falling back to `navigator.onLine` otherwise.
 */
export function getNetworkStatus(): NetworkStatus {
  _currentStatus = _readStatus();
  return _currentStatus;
}

/**
 * Derives rendering quality hints from the given (or current) network status.
 *
 * Tiers:
 * - offline            → dpi=72,  thumbnailSize='small',  prefetch=0, animations=false
 * - slow-2g / 2g / saveData → dpi=72,  thumbnailSize='small',  prefetch=1, animations=false
 * - 3g / cellular      → dpi=96,  thumbnailSize='medium', prefetch=2, animations=true
 * - 4g / wifi / ethernet / default → dpi=150, thumbnailSize='large',  prefetch=5, animations=true
 */
export function getQualityHints(status?: NetworkStatus): QualityHints {
  const s = status ?? getNetworkStatus();

  if (!s.isOnline) {
    return { renderDpi: 72, thumbnailSize: 'small', prefetchPages: 0, enableAnimations: false };
  }

  if (s.saveData || s.effectiveType === 'slow-2g' || s.effectiveType === '2g') {
    return { renderDpi: 72, thumbnailSize: 'small', prefetchPages: 1, enableAnimations: false };
  }

  if (s.effectiveType === '3g' || s.type === 'cellular') {
    return { renderDpi: 96, thumbnailSize: 'medium', prefetchPages: 2, enableAnimations: true };
  }

  // 4g / wifi / ethernet / unknown — use best quality
  return { renderDpi: 150, thumbnailSize: 'large', prefetchPages: 5, enableAnimations: true };
}

/**
 * Subscribe to network changes.
 * Uses `navigator.connection` change events when available, plus
 * `window` online/offline events as a universal fallback.
 *
 * @returns Unsubscribe function — call it to remove all registered listeners.
 */
export function onNetworkChange(handler: (status: NetworkStatus) => void): () => void {
  const _notify = (): void => {
    _currentStatus = _readStatus();
    handler(_currentStatus);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn: NetworkInformation | undefined = (navigator as any).connection;

  if (conn) {
    conn.addEventListener('change', _notify);
  }

  window.addEventListener('online', _notify);
  window.addEventListener('offline', _notify);

  return (): void => {
    if (conn) {
      conn.removeEventListener('change', _notify);
    }
    window.removeEventListener('online', _notify);
    window.removeEventListener('offline', _notify);
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function _readStatus(): NetworkStatus {
  const isOnline: boolean =
    typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn: NetworkInformation | undefined = (navigator as any).connection;

  if (!conn) {
    return {
      isOnline,
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: null,
      rtt: null,
      saveData: false,
    };
  }

  return {
    isOnline,
    type: conn.type ?? 'unknown',
    effectiveType: conn.effectiveType ?? 'unknown',
    downlink: conn.downlink ?? null,
    rtt: conn.rtt ?? null,
    saveData: conn.saveData ?? false,
  };
}
