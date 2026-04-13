// ─── Vibration API ───────────────────────────────────────────────────────────
// Vibration API wrapper for haptic feedback on mobile devices.
// Used for user-facing events such as saving an annotation.

// ─── Pre-defined patterns ────────────────────────────────────────────────────

export const PATTERNS = {
  /** Short double-pulse: confirms a successful action. */
  success: [50, 50, 100] as number[],
  /** Long double-pulse: signals an error condition. */
  error: [200, 100, 200] as number[],
  /** Single short pulse: used for notifications. */
  notification: [50] as number[],
} as const;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Vibration API is available in this environment.
 */
export function isVibrationSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger a vibration with the given pattern.
 * Returns false if unsupported or if an error occurs.
 *
 * @param pattern - Duration in ms, or an array alternating vibrate/pause durations
 */
export function vibrate(pattern: number | number[]): boolean {
  if (!isVibrationSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Vibrate once for the given duration.
 * Defaults to 50 ms if no duration is provided.
 *
 * @param ms - Duration in milliseconds (default: 50)
 */
export function vibrateOnce(ms?: number): boolean {
  return vibrate(ms ?? 50);
}

/**
 * Vibrate with a custom pattern (array of vibrate/pause durations in ms).
 *
 * @param pattern - Array of vibrate/pause durations
 */
export function vibratePattern(pattern: number[]): boolean {
  return vibrate(pattern);
}

/**
 * Cancel any ongoing vibration.
 * Equivalent to calling vibrate(0).
 */
export function cancelVibration(): boolean {
  return vibrate(0);
}
