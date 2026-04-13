// @ts-check
// ─── Fast Fourier Transform ───────────────────────────────────────────────────
// Cooley-Tukey radix-2 DIT FFT and related utilities for complex arithmetic.

// ─── Complex Type ─────────────────────────────────────────────────────────────

/** A complex number with real and imaginary components. */
export interface Complex {
  re: number;
  im: number;
}

// ─── Complex Arithmetic ───────────────────────────────────────────────────────

/**
 * Add two complex numbers: (a.re + b.re) + i(a.im + b.im).
 */
export function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

/**
 * Multiply two complex numbers: (a.re*b.re − a.im*b.im) + i(a.re*b.im + a.im*b.re).
 */
export function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * Magnitude (absolute value) of a complex number: √(re² + im²).
 */
export function complexMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Returns true iff n is a positive power of 2. */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Returns the smallest power of 2 that is >= n. */
function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place Cooley-Tukey radix-2 DIT FFT kernel.
 * Mutates the provided array.
 * @param x - Array of complex numbers; length must be a power of 2.
 * @param invert - When true, applies conjugate twiddle factors (for IFFT).
 */
function fftKernel(x: Complex[], invert: boolean): void {
  const n = x.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tmp = x[i];
      x[i] = x[j];
      x[j] = tmp;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len * (invert ? 1 : -1);
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const u = x[i + j];
        const v = x[i + j + len / 2];
        const tRe = curRe * v.re - curIm * v.im;
        const tIm = curRe * v.im + curIm * v.re;
        x[i + j] = { re: u.re + tRe, im: u.im + tIm };
        x[i + j + len / 2] = { re: u.re - tRe, im: u.im - tIm };
        // Advance twiddle factor
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

// ─── FFT / IFFT ───────────────────────────────────────────────────────────────

/**
 * Discrete Fourier Transform via Cooley-Tukey radix-2 DIT FFT.
 * Returns a new array; the input is not mutated.
 *
 * @param input - Array of complex numbers whose length must be a power of 2.
 * @throws {RangeError} If the input length is 0 or not a power of 2.
 */
export function fft(input: Complex[]): Complex[] {
  if (input.length === 0 || !isPowerOfTwo(input.length)) {
    throw new RangeError(
      `fft: input length must be a positive power of 2, got ${input.length}`,
    );
  }
  const x: Complex[] = input.map((c) => ({ re: c.re, im: c.im }));
  fftKernel(x, false);
  return x;
}

/**
 * Inverse Discrete Fourier Transform.
 * Output is normalized by 1/N so that ifft(fft(x)) ≈ x.
 * Returns a new array; the input is not mutated.
 *
 * @param input - Array of complex numbers whose length must be a power of 2.
 * @throws {RangeError} If the input length is 0 or not a power of 2.
 */
export function ifft(input: Complex[]): Complex[] {
  if (input.length === 0 || !isPowerOfTwo(input.length)) {
    throw new RangeError(
      `ifft: input length must be a positive power of 2, got ${input.length}`,
    );
  }
  const x: Complex[] = input.map((c) => ({ re: c.re, im: c.im }));
  fftKernel(x, true);
  const n = x.length;
  for (let i = 0; i < n; i++) {
    x[i] = { re: x[i].re / n, im: x[i].im / n };
  }
  return x;
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

/**
 * Convert a real-valued signal to complex form and compute its FFT.
 * If the input length is not a power of 2, it is zero-padded to the next
 * power of 2 before the transform.
 *
 * @param signal - Array of real numbers.
 * @returns Complex frequency spectrum of length nextPowerOfTwo(signal.length).
 */
export function realFft(signal: number[]): Complex[] {
  const n = nextPowerOfTwo(signal.length);
  const x: Complex[] = Array.from({ length: n }, (_, i) => ({
    re: i < signal.length ? signal[i] : 0,
    im: 0,
  }));
  fftKernel(x, false);
  return x;
}

/**
 * Compute the magnitude spectrum of a real-valued signal.
 * Returns the first N/2 + 1 magnitudes (the non-redundant half of the
 * symmetric spectrum), where N is the FFT length (next power of 2).
 *
 * @param signal - Array of real numbers.
 * @returns Magnitude array of length nextPowerOfTwo(signal.length) / 2 + 1.
 */
export function fftMagnitudes(signal: number[]): number[] {
  const spectrum = realFft(signal);
  const half = spectrum.length / 2 + 1;
  const mags: number[] = new Array(half);
  for (let i = 0; i < half; i++) {
    mags[i] = complexMag(spectrum[i]);
  }
  return mags;
}
