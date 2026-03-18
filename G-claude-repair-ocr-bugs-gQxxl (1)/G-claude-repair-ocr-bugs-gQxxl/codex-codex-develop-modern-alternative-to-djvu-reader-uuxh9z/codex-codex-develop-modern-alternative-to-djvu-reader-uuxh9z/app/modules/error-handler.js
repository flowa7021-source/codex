// ─── Unified Error Handler ──────────────────────────────────────────────────
// Centralized error handling with recovery strategies and state preservation.

/**
 * @typedef {object} AppError
 * @property {string} code - Error classification code
 * @property {string} message - Human-readable message
 * @property {string} context - Where the error occurred
 * @property {string} severity - 'fatal' | 'error' | 'warning' | 'info'
 * @property {boolean} recoverable - Whether auto-recovery is possible
 * @property {Error} [original] - Original error object
 * @property {number} timestamp
 */

const ERROR_CODES = {
  FILE_LOAD: 'FILE_LOAD',
  FILE_PARSE: 'FILE_PARSE',
  RENDER: 'RENDER',
  OCR: 'OCR',
  EXPORT: 'EXPORT',
  MEMORY: 'MEMORY',
  NETWORK: 'NETWORK',
  STORAGE: 'STORAGE',
  PERMISSION: 'PERMISSION',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
};

const MAX_ERROR_LOG = 200;
const RETRY_DELAYS = [1000, 2000, 4000];

/** @type {AppError[]} */
const errorLog = [];
/** @type {Set<Function>} */
const listeners = new Set();
/** @type {Map<string, Function>} */
const recoveryStrategies = new Map();
/** @type {Map<string, object>} */
const stateSnapshots = new Map();

/**
 * Register a global error handler.
 */
export function initErrorHandler() {
  window.addEventListener('error', (event) => {
    reportError(classifyError(event.error || event.message), {
      source: event.filename,
      line: event.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    reportError(classifyError(error), { unhandledRejection: true });
  });
}

/**
 * Report an error to the centralized handler.
 * @param {Partial<AppError>} error
 * @param {object} [extra]
 */
export function reportError(error, extra = {}) {
  const appError = {
    code: error.code || ERROR_CODES.UNKNOWN,
    message: error.message || 'Unknown error',
    context: error.context || 'unknown',
    severity: error.severity || 'error',
    recoverable: error.recoverable ?? false,
    original: error.original || null,
    timestamp: Date.now(),
    ...extra,
  };

  errorLog.push(appError);
  if (errorLog.length > MAX_ERROR_LOG) {
    errorLog.splice(0, errorLog.length - MAX_ERROR_LOG);
  }

  // Notify listeners
  for (const fn of listeners) {
    try { fn(appError); } catch { /* ignore listener errors */ }
  }

  // Attempt recovery if available
  if (appError.recoverable) {
    const strategy = recoveryStrategies.get(appError.code);
    if (strategy) {
      try { strategy(appError); } catch { /* recovery failed */ }
    }
  }

  return appError;
}

/**
 * Classify a raw error into an AppError.
 * @param {Error|string} error
 * @returns {Partial<AppError>}
 */
export function classifyError(error) {
  const msg = (typeof error === 'string' ? error : error?.message || '').toLowerCase();

  if (msg.includes('out of memory') || msg.includes('allocation')) {
    return { code: ERROR_CODES.MEMORY, message: msg, severity: 'fatal', recoverable: true };
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('load')) {
    return { code: ERROR_CODES.NETWORK, message: msg, severity: 'error', recoverable: true };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { code: ERROR_CODES.TIMEOUT, message: msg, severity: 'error', recoverable: true };
  }
  if (msg.includes('storage') || msg.includes('quota')) {
    return { code: ERROR_CODES.STORAGE, message: msg, severity: 'warning', recoverable: true };
  }
  if (msg.includes('permission') || msg.includes('security') || msg.includes('cors')) {
    return { code: ERROR_CODES.PERMISSION, message: msg, severity: 'error', recoverable: false };
  }
  if (msg.includes('parse') || msg.includes('invalid pdf') || msg.includes('syntax')) {
    return { code: ERROR_CODES.FILE_PARSE, message: msg, severity: 'error', recoverable: false };
  }
  if (msg.includes('render') || msg.includes('canvas') || msg.includes('draw')) {
    return { code: ERROR_CODES.RENDER, message: msg, severity: 'error', recoverable: true };
  }
  if (msg.includes('ocr') || msg.includes('tesseract')) {
    return { code: ERROR_CODES.OCR, message: msg, severity: 'error', recoverable: true };
  }

  return {
    code: ERROR_CODES.UNKNOWN,
    message: typeof error === 'string' ? error : error?.message || 'Unknown error',
    severity: 'error',
    recoverable: false,
    original: error instanceof Error ? error : undefined,
  };
}

/**
 * Register a recovery strategy for a specific error code.
 * @param {string} code
 * @param {Function} strategy - (appError) => void
 */
export function registerRecovery(code, strategy) {
  recoveryStrategies.set(code, strategy);
}

/**
 * Subscribe to error events.
 * @param {Function} listener - (appError) => void
 * @returns {Function} unsubscribe
 */
export function onError(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Save a state snapshot for recovery.
 * @param {string} key
 * @param {object} state
 */
export function saveStateSnapshot(key, state) {
  stateSnapshots.set(key, { ...state, snapshotAt: Date.now() });
  // Keep only recent snapshots
  if (stateSnapshots.size > 20) {
    const oldest = [...stateSnapshots.entries()]
      .sort((a, b) => a[1].snapshotAt - b[1].snapshotAt)[0];
    if (oldest) stateSnapshots.delete(oldest[0]);
  }
}

/**
 * Restore a state snapshot.
 * @param {string} key
 * @returns {object|null}
 */
export function restoreStateSnapshot(key) {
  return stateSnapshots.get(key) || null;
}

/**
 * Retry an async operation with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {number[]} [options.delays] - Delay between retries in ms
 * @param {Function} [options.onRetry] - Called before each retry
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const { maxRetries = 3, delays = RETRY_DELAYS, onRetry } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = delays[Math.min(attempt, delays.length - 1)];
        if (onRetry) onRetry(attempt + 1, err);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Get error log.
 * @param {object} [filter]
 * @param {string} [filter.code]
 * @param {string} [filter.severity]
 * @param {number} [filter.limit=50]
 * @returns {AppError[]}
 */
export function getErrorLog(filter = {}) {
  let result = [...errorLog];
  if (filter.code) result = result.filter(e => e.code === filter.code);
  if (filter.severity) result = result.filter(e => e.severity === filter.severity);
  result.reverse(); // newest first
  if (filter.limit) result = result.slice(0, filter.limit);
  return result;
}

/**
 * Export error log as JSON string.
 */
export function exportErrorLog() {
  return JSON.stringify(errorLog, null, 2);
}

export { ERROR_CODES };
