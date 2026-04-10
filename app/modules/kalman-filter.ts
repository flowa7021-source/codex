// @ts-check
// ─── Kalman Filter ──────────────────────────────────────────────────────────
// 1D (scalar) Kalman filter for smoothing noisy scalar signals.
//
// Usage:
//   import { KalmanFilter, createKalmanFilter, smoothSignal } from './kalman-filter.js';
//
//   const kf = new KalmanFilter({ processNoise: 1, measurementNoise: 10 });
//   const estimate = kf.update(measurement);
//
//   const smoothed = smoothSignal(noisyArray, 1, 10);

// ---------------------------------------------------------------------------
// Options type
// ---------------------------------------------------------------------------

interface KalmanFilterOptions {
  processNoise?: number;
  measurementNoise?: number;
  estimateError?: number;
  initialValue?: number;
}

// ---------------------------------------------------------------------------
// KalmanFilter class
// ---------------------------------------------------------------------------

/**
 * 1D scalar Kalman filter.
 *
 * State:
 *   x  — state estimate
 *   p  — error covariance
 *
 * Tuning:
 *   processNoise      (Q) — how much the true value is expected to change per
 *                           step.  Higher → trusts new measurements more.
 *   measurementNoise  (R) — how noisy the sensor/input is.
 *                           Higher → trusts the model more, smooths harder.
 */
export class KalmanFilter {
  /** Process noise variance (Q). */
  private readonly _processNoise: number;
  /** Measurement noise variance (R). */
  private readonly _measurementNoise: number;
  /** Initial error covariance. */
  private readonly _initialError: number;
  /** Initial state estimate. */
  private readonly _initialValue: number;

  /** Current state estimate (x). */
  private _estimate: number;
  /** Current error covariance (P). */
  private _error: number;

  constructor(options: KalmanFilterOptions = {}) {
    this._processNoise     = options.processNoise     ?? 1;
    this._measurementNoise = options.measurementNoise ?? 1;
    this._initialError     = options.estimateError    ?? 1;
    this._initialValue     = options.initialValue     ?? 0;

    this._estimate = this._initialValue;
    this._error    = this._initialError;
  }

  // ── Predict step ────────────────────────────────────────────────────────────
  /**
   * Predict step: propagates the state estimate forward in time.
   * In this 1D constant-velocity model the state itself is unchanged,
   * but the error covariance grows by the process noise Q.
   *
   * @returns The current (predicted) state estimate.
   */
  predict(): number {
    // P_k|k-1 = P_k-1 + Q
    this._error += this._processNoise;
    return this._estimate;
  }

  // ── Update step ─────────────────────────────────────────────────────────────
  /**
   * Update step: incorporates a new measurement, then returns the
   * updated state estimate.
   *
   * @param measurement - Observed (noisy) scalar value.
   * @returns Updated state estimate.
   */
  update(measurement: number): number {
    // Kalman gain: K = P / (P + R)
    const k = this._error / (this._error + this._measurementNoise);

    // Update estimate: x = x + K * (z - x)
    this._estimate = this._estimate + k * (measurement - this._estimate);

    // Update error covariance: P = (1 - K) * P
    this._error = (1 - k) * this._error;

    return this._estimate;
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  /** Current state estimate. */
  get estimate(): number {
    return this._estimate;
  }

  /** Current error covariance. */
  get error(): number {
    return this._error;
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  /**
   * Resets the filter to its initial state.
   *
   * @param initialValue - Override the initial state estimate (optional).
   */
  reset(initialValue?: number): void {
    this._estimate = initialValue !== undefined ? initialValue : this._initialValue;
    this._error    = this._initialError;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Convenience factory for creating a {@link KalmanFilter}.
 *
 * @param options - Filter tuning parameters.
 * @returns A new KalmanFilter instance.
 */
export function createKalmanFilter(options?: KalmanFilterOptions): KalmanFilter {
  return new KalmanFilter(options);
}

// ---------------------------------------------------------------------------
// smoothSignal
// ---------------------------------------------------------------------------

/**
 * Applies a Kalman filter to an array of scalar measurements and returns
 * the smoothed values.
 *
 * @param signal           - Array of noisy measurements.
 * @param processNoise     - Process noise variance Q (default 1).
 * @param measurementNoise - Measurement noise variance R (default 1).
 * @returns Smoothed signal array of the same length.
 */
export function smoothSignal(
  signal: number[],
  processNoise: number = 1,
  measurementNoise: number = 1,
): number[] {
  if (signal.length === 0) return [];

  const kf = new KalmanFilter({
    processNoise,
    measurementNoise,
    estimateError:  1,
    initialValue:   signal[0],
  });

  return signal.map((measurement) => kf.update(measurement));
}
