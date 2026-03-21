// ─── Safe Timers ────────────────────────────────────────────────────────────
// Timer registry that tracks all setTimeout/setInterval calls and provides
// bulk cleanup to prevent timer leaks on document close or page navigation.
//
// Scopes:
//   'document' (default) — cleared on file open / document close
//   'app'                — persists for the app lifetime, cleared only on full shutdown

/** @type {Map<number, string>} timer ID → scope */
const _timeouts = new Map();
/** @type {Map<number, string>} timer ID → scope */
const _intervals = new Map();

/**
 * Create a tracked setTimeout. Automatically unregistered when it fires.
 * @param {Function} fn
 * @param {number} ms
 * @param {{ scope?: 'document'|'app' }} [opts]
 * @returns {number} timer ID
 */
export function safeTimeout(fn, ms, opts) {
  const scope = opts?.scope || 'document';
  const id = setTimeout(() => {
    _timeouts.delete(id);
    fn();
  }, ms);
  _timeouts.set(id, scope);
  return id;
}

/**
 * Create a tracked setInterval.
 * @param {Function} fn
 * @param {number} ms
 * @param {{ scope?: 'document'|'app' }} [opts]
 * @returns {number} timer ID
 */
export function safeInterval(fn, ms, opts) {
  const scope = opts?.scope || 'document';
  const id = setInterval(fn, ms);
  _intervals.set(id, scope);
  return id;
}

/**
 * Clear a tracked timeout.
 * @param {number} id
 */
export function clearSafeTimeout(id) {
  clearTimeout(id);
  _timeouts.delete(id);
}

/**
 * Clear a tracked interval.
 * @param {number} id
 */
export function clearSafeInterval(id) {
  clearInterval(id);
  _intervals.delete(id);
}

/**
 * Clear tracked timers by scope.
 * Default (no arg): clears 'document'-scoped timers (backward-compatible).
 * Pass 'all' to clear everything including app-scoped timers.
 * @param {'document'|'all'} [scope='document']
 */
export function clearAllTimers(scope = 'document') {
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
 * @returns {{ timeouts: number, intervals: number }}
 */
export function getTimerStats() {
  return {
    timeouts: _timeouts.size,
    intervals: _intervals.size,
  };
}
