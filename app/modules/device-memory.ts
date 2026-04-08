// ─── Device Memory API ────────────────────────────────────────────────────────
// Device Memory API wrapper and related device capability hints.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Device Memory API is supported.
 */
export function isDeviceMemorySupported(): boolean {
  return 'deviceMemory' in navigator;
}

/**
 * Get device memory in GiB (rounded to 0.25, 0.5, 1, 2, 4, 8).
 * Returns null if not supported.
 */
export function getDeviceMemory(): number | null {
  return (navigator as any).deviceMemory ?? null;
}

/**
 * Get memory tier based on available RAM:
 * 'low' (<= 1 GiB), 'medium' (2-4 GiB), 'high' (> 4 GiB), 'unknown'
 */
export function getMemoryTier(): 'low' | 'medium' | 'high' | 'unknown' {
  const mem = getDeviceMemory();
  if (mem === null) return 'unknown';
  if (mem <= 1) return 'low';
  if (mem <= 4) return 'medium';
  return 'high';
}

/**
 * Whether the device is considered low-memory (<= 1 GiB).
 */
export function isLowMemoryDevice(): boolean {
  return getMemoryTier() === 'low';
}

/**
 * Get recommended settings based on device memory.
 * Returns object with maxCachePages, enableAnimations, prefetchAhead.
 */
export function getMemoryAdaptiveSettings(): {
  maxCachePages: number;
  enableAnimations: boolean;
  prefetchAhead: number;
} {
  const tier = getMemoryTier();
  if (tier === 'low') {
    return { maxCachePages: 3, enableAnimations: false, prefetchAhead: 1 };
  }
  if (tier === 'medium') {
    return { maxCachePages: 10, enableAnimations: true, prefetchAhead: 3 };
  }
  // high or unknown
  return { maxCachePages: 25, enableAnimations: true, prefetchAhead: 5 };
}
