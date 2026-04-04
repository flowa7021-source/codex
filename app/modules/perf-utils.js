// @ts-check
// ─── Performance Utilities ────────────────────────────────────────────────────
// BatchedProgress, SystemTier, CancellationManager, DegradationDetector.
// JS adaptation of the C# performance spec patterns.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

// ─── SystemTier ──────────────────────────────────────────────────────────────

/**
 * @typedef {'low'|'medium'|'high'} TierLevel
 */

/**
 * @typedef {object} SystemProfile
 * @property {TierLevel} tier
 * @property {number} cores        - logical CPU count
 * @property {number} memoryGb     - approximate RAM (0 if unknown)
 * @property {number} djvuCacheMb  - recommended DjVu page cache size
 * @property {number} ocrConcurrency - recommended max parallel OCR workers
 * @property {number} renderCachePx  - recommended max cached pixels (~canvas px)
 */

/** @type {SystemProfile|null} */
let _systemProfile = null;

/**
 * Detect system capabilities once and cache the result.
 * Uses navigator.hardwareConcurrency and navigator.deviceMemory (where available).
 * @returns {SystemProfile}
 */
export function getSystemProfile() {
  if (_systemProfile) return _systemProfile;

  const cores = navigator.hardwareConcurrency || 2;
  // deviceMemory is in GB (spec returns 0.25/0.5/1/2/4/8); undefined in Firefox/Safari
  const memoryGb = /** @type {any} */ (navigator).deviceMemory || 0;

  /** @type {TierLevel} */
  let tier;
  if (cores >= 12 && (memoryGb === 0 || memoryGb >= 16)) {
    tier = 'high';
  } else if (cores >= 6 && (memoryGb === 0 || memoryGb >= 8)) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  // If deviceMemory is unavailable (0) we fall back to core count alone.
  // Adjust tier downward when we know memory is constrained.
  if (memoryGb > 0 && memoryGb <= 4) tier = 'low';

  const djvuCacheMb      = tier === 'high' ? 400 : tier === 'medium' ? 200 : 80;
  const ocrConcurrency   = tier === 'high' ? 4   : tier === 'medium' ? 2   : 1;
  const renderCachePx    = tier === 'high' ? 256_000_000 : tier === 'medium' ? 128_000_000 : 48_000_000;

  _systemProfile = { tier, cores, memoryGb, djvuCacheMb, ocrConcurrency, renderCachePx };
  return _systemProfile;
}

/**
 * Recommended DjVu LRU cache size in megabytes.
 * @returns {number}
 */
export function getAdaptiveDjvuCacheMb() {
  return getSystemProfile().djvuCacheMb;
}

// ─── BatchedProgress ─────────────────────────────────────────────────────────

const BATCH_INTERVAL_MS = 250;

/**
 * Throttles a progress callback to at most one call per BATCH_INTERVAL_MS.
 * Ensures the final update (100%) is always delivered.
 *
 * Usage:
 *   const bp = new BatchedProgress((cur, tot, label) => updateUI(cur, tot, label));
 *   bp.report(1, 10, 'page 1');
 *   bp.report(2, 10, 'page 2');   // may be skipped if called within 250ms
 *   bp.done();                    // flush final state
 *
 * @template {any[]} TArgs
 */
export class BatchedProgress {
  /**
   * @param {(...args: TArgs) => void} callback
   * @param {number} [intervalMs]
   */
  constructor(callback, intervalMs = BATCH_INTERVAL_MS) {
    this._cb = callback;
    this._interval = intervalMs;
    this._lastEmit = 0;
    this._timer = null;
    /** @type {TArgs|null} */
    this._pending = null;
    this._flushed = false;
  }

  /**
   * Queue a progress update. Emits immediately if interval has elapsed;
   * otherwise schedules a deferred emit.
   * @param {...TArgs} args
   */
  report(...args) {
    const now = performance.now();
    this._pending = /** @type {TArgs} */ (args);
    this._flushed = false;

    if (now - this._lastEmit >= this._interval) {
      this._flush();
    } else if (!this._timer) {
      this._timer = safeTimeout(() => {
        this._timer = null;
        if (!this._flushed) this._flush();
      }, this._interval - (now - this._lastEmit));
    }
  }

  /** Force-emit the last pending update immediately. Call when operation completes. */
  done() {
    if (this._timer !== null) {
      clearSafeTimeout(this._timer);
      this._timer = null;
    }
    if (this._pending && !this._flushed) this._flush();
  }

  /** Cancel any pending deferred emit without delivering it. */
  cancel() {
    if (this._timer !== null) {
      clearSafeTimeout(this._timer);
      this._timer = null;
    }
    this._pending = null;
    this._flushed = false;
  }

  _flush() {
    if (!this._pending) return;
    this._lastEmit = performance.now();
    this._flushed = true;
    try { this._cb(...this._pending); } catch (_) { /* caller errors must not crash pipeline */ }
  }
}

// ─── CancellationManager ─────────────────────────────────────────────────────

/**
 * AbortController wrapper that supports cancel-and-restart.
 * Replaces the C# CancellationTokenSource pattern.
 *
 * Usage:
 *   const cm = new CancellationManager();
 *   async function run() {
 *     const signal = cm.begin();
 *     for (const item of items) {
 *       if (signal.aborted) break;
 *       await processItem(item);
 *     }
 *   }
 *   cm.cancel();   // aborts current operation
 */
export class CancellationManager {
  constructor() {
    /** @type {AbortController|null} */
    this._ctrl = null;
  }

  /**
   * Start a new operation. Any existing operation is cancelled first.
   * @returns {AbortSignal}
   */
  begin() {
    if (this._ctrl) {
      this._ctrl.abort();
    }
    this._ctrl = new AbortController();
    return this._ctrl.signal;
  }

  /**
   * Cancel the current operation.
   */
  cancel() {
    if (this._ctrl) {
      this._ctrl.abort();
      this._ctrl = null;
    }
  }

  /**
   * Whether an operation is currently running (not yet cancelled).
   * @returns {boolean}
   */
  get isActive() {
    return this._ctrl !== null && !this._ctrl.signal.aborted;
  }

  /**
   * Current signal, or a pre-aborted signal if no operation is active.
   * @returns {AbortSignal}
   */
  get signal() {
    if (this._ctrl) return this._ctrl.signal;
    // Return a signal that is already aborted so guards work correctly
    const ctrl = new AbortController();
    ctrl.abort();
    return ctrl.signal;
  }
}

// ─── DegradationDetector ─────────────────────────────────────────────────────

const DEGRADATION_WINDOW    = 20;   // samples in rolling window
const DEGRADATION_THRESHOLD = 1.5;  // ratio: recent avg / baseline avg triggers warning

/**
 * Detects performance degradation by comparing a rolling window of recent
 * measurements against a baseline established from the first N samples.
 *
 * Adapted from C# DegradationDetector: sliding window comparison.
 */
export class DegradationDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.window]    - rolling window size (default 20)
   * @param {number} [options.threshold] - ratio to trigger warning (default 1.5)
   * @param {(ratio: number) => void} [options.onDegrade] - fired when degradation detected
   */
  constructor({ window: win = DEGRADATION_WINDOW, threshold = DEGRADATION_THRESHOLD, onDegrade } = {}) {
    this._window    = win;
    this._threshold = threshold;
    this._onDegrade = onDegrade ?? null;
    /** @type {number[]} */
    this._samples   = [];
    this._baseline  = 0;
    this._warned    = false;
  }

  /**
   * Record a new measurement in ms.
   * @param {number} ms
   */
  record(ms) {
    this._samples.push(ms);

    // Establish baseline from first window's worth of samples
    if (this._samples.length === this._window) {
      this._baseline = this._avg(this._samples);
    }

    // Once we have 2× the window, keep only the most recent
    if (this._samples.length > this._window * 2) {
      this._samples.splice(0, this._samples.length - this._window);
    }

    // Check for degradation once baseline is set
    if (this._baseline > 0 && this._samples.length >= this._window) {
      const recent = this._samples.slice(-this._window);
      const recentAvg = this._avg(recent);
      const ratio = recentAvg / this._baseline;

      if (ratio >= this._threshold && !this._warned) {
        this._warned = true;
        this._onDegrade?.(ratio);
      } else if (ratio < this._threshold * 0.8) {
        // Recovery: allow re-warning if degradation recurs
        this._warned = false;
      }
    }
  }

  /** Reset all samples and baseline. */
  reset() {
    this._samples = [];
    this._baseline = 0;
    this._warned = false;
  }

  /** Current rolling average (0 if no samples). */
  get recentAvgMs() {
    if (!this._samples.length) return 0;
    const recent = this._samples.slice(-this._window);
    return this._avg(recent);
  }

  /** @param {number[]} arr */
  _avg(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
}
