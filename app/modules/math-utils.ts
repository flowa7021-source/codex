// ─── Math Utilities ──────────────────────────────────────────────────────────
// @ts-check
// Common math helper functions for NovaReader.

// ─── Range & Interpolation ───────────────────────────────────────────────────

/**
 * Clamp a value between min and max (inclusive).
 *
 * @param value - The value to clamp
 * @param min   - Lower bound (inclusive)
 * @param max   - Upper bound (inclusive)
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between a and b by t (0–1).
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor in [0, 1]
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse lerp: given a value in [a, b], return t in [0, 1].
 * Returns 0 when a === b to avoid division by zero.
 *
 * @param a     - Range start
 * @param b     - Range end
 * @param value - Value within [a, b]
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Map a value from one range to another.
 *
 * @param value  - Input value
 * @param inMin  - Input range minimum
 * @param inMax  - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

// ─── Rounding ────────────────────────────────────────────────────────────────

/**
 * Round to N decimal places.
 *
 * @param value    - The number to round
 * @param decimals - Number of decimal places (non-negative integer)
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/**
 * Check if two numbers are approximately equal (within epsilon).
 *
 * @param a       - First number
 * @param b       - Second number
 * @param epsilon - Tolerance (default: 1e-9)
 */
export function approxEqual(a: number, b: number, epsilon = 1e-9): boolean {
  return Math.abs(a - b) <= epsilon;
}

// ─── Number Theory ───────────────────────────────────────────────────────────

/**
 * Greatest common divisor (always non-negative).
 *
 * @param a - First integer
 * @param b - Second integer
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Least common multiple (always non-negative).
 * Returns 0 if either argument is 0.
 *
 * @param a - First integer
 * @param b - Second integer
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Check if a number is a power of 2.
 * Returns false for 0 and negative numbers.
 *
 * @param n - Integer to test
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Round a number up to the nearest power of 2.
 * Returns 1 for values ≤ 1.
 *
 * @param n - Positive integer
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ─── Angle Conversion ────────────────────────────────────────────────────────

/**
 * Convert degrees to radians.
 *
 * @param degrees - Angle in degrees
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 *
 * @param radians - Angle in radians
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

// ─── Modulo ──────────────────────────────────────────────────────────────────

/**
 * Modulo that always returns a positive result (unlike the % operator for
 * negative numbers in JavaScript).
 *
 * @param n - Dividend
 * @param m - Divisor
 */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

/**
 * Calculate average (arithmetic mean) of an array of numbers.
 * Returns NaN for an empty array.
 *
 * @param numbers - Array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return NaN;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate median of an array of numbers.
 * Returns NaN for an empty array.
 * Does not mutate the input array.
 *
 * @param numbers - Array of numbers
 */
export function median(numbers: number[]): number {
  if (numbers.length === 0) return NaN;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate population standard deviation of an array of numbers.
 * Returns NaN for an empty array; returns 0 for a single-element array.
 *
 * @param numbers - Array of numbers
 */
export function stdDev(numbers: number[]): number {
  if (numbers.length === 0) return NaN;
  const mean = average(numbers);
  const squaredDiffs = numbers.map(n => (n - mean) ** 2);
  return Math.sqrt(average(squaredDiffs));
}
