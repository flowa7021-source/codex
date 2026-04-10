// @ts-check
// ─── Wavelet Transform ───────────────────────────────────────────────────────
// Haar wavelet transform: forward, inverse, denoising, and helper utilities.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if n is a positive power of 2.
 *
 * @param n - Integer to test
 */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Returns the smallest power of 2 that is >= n.
 * Returns 1 for n <= 1.
 *
 * @param n - Positive integer
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Zero-pad `signal` to the next power of 2 length.
 * If `signal.length` is already a power of 2, it is returned as-is (new copy).
 *
 * @param signal - Input signal array
 */
export function padToPowerOfTwo(signal: number[]): number[] {
  const target = nextPowerOfTwo(signal.length);
  const padded = new Array<number>(target).fill(0);
  for (let i = 0; i < signal.length; i++) {
    padded[i] = signal[i];
  }
  return padded;
}

// ─── Forward Haar Transform ──────────────────────────────────────────────────

/**
 * Forward Haar wavelet transform (in-place lifting, standard normalisation).
 *
 * The transform is applied hierarchically: the first pass covers the full
 * length, the next pass covers the first half, and so on until length 2.
 * Each level computes:
 *   average   = (a + b) / sqrt(2)
 *   difference = (a - b) / sqrt(2)
 *
 * @param signal - Input signal whose length must be a power of 2.
 * @throws {RangeError} If `signal.length` is not a positive power of 2.
 * @returns New array of wavelet coefficients (same length as input).
 */
export function haarForward(signal: number[]): number[] {
  const n = signal.length;
  if (!isPowerOfTwo(n)) {
    throw new RangeError(
      `haarForward: signal length must be a power of 2, got ${n}`,
    );
  }

  const result = signal.slice();
  const SQRT2 = Math.SQRT2;

  let len = n;
  while (len >= 2) {
    const temp = new Array<number>(len);
    const half = len >> 1;
    for (let i = 0; i < half; i++) {
      temp[i]        = (result[2 * i] + result[2 * i + 1]) / SQRT2;
      temp[half + i] = (result[2 * i] - result[2 * i + 1]) / SQRT2;
    }
    for (let i = 0; i < len; i++) {
      result[i] = temp[i];
    }
    len = half;
  }

  return result;
}

// ─── Inverse Haar Transform ──────────────────────────────────────────────────

/**
 * Inverse Haar wavelet transform — exact reconstruction.
 *
 * Reverses the forward transform: starts from length 2 and doubles the
 * reconstruction length until the full signal is restored.
 * Each level reconstructs:
 *   a = (average + difference) / sqrt(2)
 *   b = (average - difference) / sqrt(2)
 *
 * @param coefficients - Wavelet coefficients (same length as original signal).
 * @throws {RangeError} If `coefficients.length` is not a positive power of 2.
 * @returns Reconstructed signal array.
 */
export function haarInverse(coefficients: number[]): number[] {
  const n = coefficients.length;
  if (!isPowerOfTwo(n)) {
    throw new RangeError(
      `haarInverse: coefficients length must be a power of 2, got ${n}`,
    );
  }

  const result = coefficients.slice();
  const SQRT2 = Math.SQRT2;

  let len = 2;
  while (len <= n) {
    const half = len >> 1;
    const temp = new Array<number>(len);
    for (let i = 0; i < half; i++) {
      temp[2 * i]     = (result[i] + result[half + i]) / SQRT2;
      temp[2 * i + 1] = (result[i] - result[half + i]) / SQRT2;
    }
    for (let i = 0; i < len; i++) {
      result[i] = temp[i];
    }
    len <<= 1;
  }

  return result;
}

// ─── WaveletTransform Class ──────────────────────────────────────────────────

/**
 * Object-oriented wrapper for wavelet transforms.
 *
 * @example
 *   const wt = new WaveletTransform('haar');
 *   const coeffs = wt.forward([1, 2, 3, 4]);
 *   const restored = wt.inverse(coeffs);
 */
export class WaveletTransform {
  /** The wavelet type used by this instance. */
  public waveletType: 'haar';

  /**
   * Create a WaveletTransform instance.
   *
   * @param waveletType - Wavelet type to use. Currently only 'haar' is supported.
   * @throws {Error} If an unsupported wavelet type is provided.
   */
  constructor(waveletType: 'haar') {
    if (waveletType !== 'haar') {
      throw new Error(
        `WaveletTransform: unsupported wavelet type '${waveletType}'. Supported: 'haar'`,
      );
    }
    this.waveletType = waveletType;
  }

  /**
   * Apply the forward wavelet transform to `signal`.
   *
   * @param signal - Input signal (length must be a power of 2).
   * @returns Wavelet coefficient array.
   */
  forward(signal: number[]): number[] {
    return haarForward(signal);
  }

  /**
   * Apply the inverse wavelet transform to reconstruct the original signal.
   *
   * @param coefficients - Coefficient array (length must be a power of 2).
   * @returns Reconstructed signal.
   */
  inverse(coefficients: number[]): number[] {
    return haarInverse(coefficients);
  }

  /**
   * Denoise a signal using wavelet thresholding (hard threshold).
   *
   * Steps:
   *   1. Forward transform.
   *   2. Zero out all coefficients whose absolute value is below `threshold`.
   *   3. Inverse transform.
   *
   * @param signal    - Input signal (length must be a power of 2).
   * @param threshold - Coefficients with |value| < threshold are zeroed.
   * @returns Denoised signal.
   */
  denoise(signal: number[], threshold: number): number[] {
    const coeffs = this.forward(signal);
    const thresholded = coeffs.map((c) => (Math.abs(c) < threshold ? 0 : c));
    return this.inverse(thresholded);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Factory function for creating a {@link WaveletTransform} instance.
 *
 * @param type - Wavelet type ('haar').
 * @returns A new WaveletTransform configured for the given type.
 *
 * @example
 *   const wt = createWaveletTransform('haar');
 */
export function createWaveletTransform(type: 'haar'): WaveletTransform {
  return new WaveletTransform(type);
}
