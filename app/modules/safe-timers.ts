// ─── Safe Timers ────────────────────────────────────────────────────────────
// Timer registry that tracks all setTimeout/setInterval calls and provides
// bulk cleanup to prevent timer leaks on document close or page navigation.
//
// Scopes:
//   'document' (default) — cleared on file open / document close
//   'app'                — persists for the app lifetime, cleared only on full shutdown

/** timer ID → scope */
const _timeouts = new Map<number, string>();
/** timer ID → scope */
const _intervals = new Map<number, string>();

/**
 * Create a tracked setTimeout. Automatically unregistered when it fires.
 */
export function safeTimeout(
  fn: () => void,
  ms: number,
  opts?: { scope?: 'document' | 'app' },
): number {
  const scope = opts?.scope ?? 'document';
  const id = setTimeout(() => {
    _timeouts.delete(id);
    fn();
  }, ms) as unknown as number;
  _timeouts.set(id, scope);
  return id;
}

/**
 * Create a tracked setInterval.
 */
export function safeInterval(
  fn: () => void,
  ms: number,
  opts?: { scope?: 'document' | 'app' },
): number {
  const scope = opts?.scope ?? 'document';
  const id = setInterval(fn, ms) as unknown as number;
  _intervals.set(id, scope);
  return id;
}

/**
 * Clear a tracked timeout.
 */
export function clearSafeTimeout(id: number): void {
  clearTimeout(id);
  _timeouts.delete(id);
}

/**
 * Clear a tracked interval.
 */
export function clearSafeInterval(id: number): void {
  clearInterval(id);
  _intervals.delete(id);
}

/**
 * Clear tracked timers by scope.
 * Default (no arg): clears 'document'-scoped timers (backward-compatible).
 * Pass 'all' to clear everything including app-scoped timers.
 */
export function clearAllTimers(scope: 'document' | 'all' = 'document'): void {
  for (const [id, s] of [..._timeouts]) {
    if (scope === 'all' || s === scope) {
      clearTimeout(id);
      _timeouts.delete(id);
    }
  }
  for (const [id, s] of [..._intervals]) {
    if (scope === 'all' || s === scope) {
      clearInterval(id);
      _intervals.delete(id);
    }
  }
}

/**
 * Get count of active tracked timers (for diagnostics).
 */
export function getTimerStats(): { timeouts: number; intervals: number } {
  return {
    timeouts: _timeouts.size,
    intervals: _intervals.size,
  };
}
