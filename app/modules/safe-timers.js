// ─── Safe Timers ────────────────────────────────────────────────────────────
// Timer registry that tracks all setTimeout/setInterval calls and provides
// bulk cleanup to prevent timer leaks on document close or page navigation.

/** @type {Set<number>} Active timeout IDs */
const _timeouts = new Set();
/** @type {Set<number>} Active interval IDs */
const _intervals = new Set();

/**
 * Create a tracked setTimeout. Automatically unregistered when it fires.
 * @param {Function} fn
 * @param {number} ms
 * @returns {number} timer ID
 */
export function safeTimeout(fn, ms) {
  const id = setTimeout(() => {
    _timeouts.delete(id);
    fn();
  }, ms);
  _timeouts.add(id);
  return id;
}

/**
 * Create a tracked setInterval.
 * @param {Function} fn
 * @param {number} ms
 * @returns {number} timer ID
 */
export function safeInterval(fn, ms) {
  const id = setInterval(fn, ms);
  _intervals.add(id);
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
 * Clear ALL tracked timers. Call on document close / file open / cleanup.
 */
export function clearAllTimers() {
  for (const id of _timeouts) clearTimeout(id);
  _timeouts.clear();
  for (const id of _intervals) clearInterval(id);
  _intervals.clear();
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
