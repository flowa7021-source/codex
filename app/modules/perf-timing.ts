// ─── Performance Timing ──────────────────────────────────────────────────────
// Wraps the User Timing API (performance.mark / performance.measure) to track
// rendering pipeline performance across the application.

// ─── Internal Stats Accumulator ──────────────────────────────────────────────

interface OperationStats {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

const _stats: Record<string, OperationStats> = {};

function _recordDuration(operation: string, durationMs: number): void {
  if (!_stats[operation]) {
    _stats[operation] = { count: 0, totalMs: 0, avgMs: 0, minMs: Infinity, maxMs: -Infinity };
  }
  const s = _stats[operation];
  s.count += 1;
  s.totalMs += durationMs;
  s.avgMs = s.totalMs / s.count;
  if (durationMs < s.minMs) s.minMs = durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a performance mark. No-ops if the API is unavailable.
 */
export function mark(name: string, detail?: unknown): void {
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(name, { detail });
    }
  } catch {
    // silently no-op
  }
}

/**
 * Measure duration between two marks. Returns duration in ms (0 if unavailable
 * or marks are missing).
 */
export function measure(name: string, startMark: string, endMark?: string): number {
  try {
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') {
      return 0;
    }
    const entry = endMark
      ? performance.measure(name, startMark, endMark)
      : performance.measure(name, startMark);
    return entry?.duration ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Create a start mark for an operation. Returns the mark name.
 */
export function markStart(operation: string): string {
  const name = `nr:${operation}:start`;
  mark(name);
  return name;
}

/**
 * Create an end mark for an operation, measure from start, and record stats.
 * Returns duration in ms (0 if start mark is missing or API unavailable).
 */
export function markEnd(operation: string): number {
  const endName = `nr:${operation}:end`;
  const startName = `nr:${operation}:start`;
  const measureName = `nr:${operation}`;

  mark(endName);
  const duration = measure(measureName, startName, endName);
  if (duration > 0) {
    _recordDuration(operation, duration);
  }
  return duration;
}

/**
 * Clear all performance marks, or only those whose name starts with the given prefix.
 */
export function clearMarks(prefix?: string): void {
  try {
    if (typeof performance === 'undefined' || typeof performance.clearMarks !== 'function') {
      return;
    }
    if (prefix === undefined) {
      performance.clearMarks();
    } else {
      performance.getEntriesByType('mark').forEach((entry) => {
        if (entry.name.startsWith(prefix)) {
          performance.clearMarks(entry.name);
        }
      });
    }
  } catch {
    // silently no-op
  }
}

/**
 * Clear all performance measures, or only those whose name starts with the given prefix.
 */
export function clearMeasures(prefix?: string): void {
  try {
    if (typeof performance === 'undefined' || typeof performance.clearMeasures !== 'function') {
      return;
    }
    if (prefix === undefined) {
      performance.clearMeasures();
    } else {
      performance.getEntriesByType('measure').forEach((entry) => {
        if (entry.name.startsWith(prefix)) {
          performance.clearMeasures(entry.name);
        }
      });
    }
  } catch {
    // silently no-op
  }
}

/**
 * Returns performance entries of a specific type, or all entries if no type is given.
 */
export function getEntries(type?: 'mark' | 'measure'): PerformanceEntry[] {
  try {
    if (typeof performance === 'undefined') return [];
    if (type) {
      return typeof performance.getEntriesByType === 'function'
        ? performance.getEntriesByType(type)
        : [];
    }
    return typeof performance.getEntries === 'function'
      ? performance.getEntries()
      : [];
  } catch {
    return [];
  }
}

/**
 * Wraps an async function with start/end marks and returns its result.
 */
export async function withTiming<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  markStart(operation);
  try {
    return await fn();
  } finally {
    markEnd(operation);
  }
}

/**
 * Returns aggregate stats for all tracked operations.
 */
export function getStats(): Record<string, OperationStats> {
  const result: Record<string, OperationStats> = {};
  for (const [op, s] of Object.entries(_stats)) {
    result[op] = { ...s };
  }
  return result;
}

/**
 * Clears the internal stats accumulator.
 */
export function resetStats(): void {
  for (const key of Object.keys(_stats)) {
    delete _stats[key];
  }
}
