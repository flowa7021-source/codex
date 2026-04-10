// @ts-check
/**
 * @module fraction
 * @description Exact rational number arithmetic using reduced fractions.
 *
 * Features:
 *   • Auto-reduction via GCD on construction
 *   • Sign always carried by numerator
 *   • Arithmetic: add, sub, mul, div
 *   • Utilities: negate, reciprocal, abs, toNumber, toString, equals, compareTo
 *   • Static helpers: fromNumber, ZERO, ONE
 *   • Named factory: createFraction
 *
 * Usage:
 *   import { Fraction, gcd, createFraction } from './fraction.js';
 *
 *   const half  = new Fraction(1, 2);
 *   const third = new Fraction(1, 3);
 *   console.log(half.add(third).toString()); // "5/6"
 */

// ---------------------------------------------------------------------------
// GCD
// ---------------------------------------------------------------------------

/**
 * Greatest common divisor of two integers (always non-negative).
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function gcd(a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Fraction class
// ---------------------------------------------------------------------------

export class Fraction {
  /** @type {number} */
  #numerator;

  /** @type {number} */
  #denominator;

  /**
   * @param {number} numerator
   * @param {number} denominator
   */
  constructor(numerator, denominator) {
    if (denominator === 0) {
      throw new RangeError('Fraction: denominator must not be zero');
    }

    // Normalise sign — denominator is always positive.
    if (denominator < 0) {
      numerator   = -numerator;
      denominator = -denominator;
    }

    // Reduce.
    const g = gcd(Math.abs(numerator), denominator);
    this.#numerator   = numerator   / g;
    this.#denominator = denominator / g;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** @returns {number} */
  get numerator() {
    return this.#numerator;
  }

  /** @returns {number} */
  get denominator() {
    return this.#denominator;
  }

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  /**
   * @param {Fraction} other
   * @returns {Fraction}
   */
  add(other) {
    return new Fraction(
      this.#numerator * other.#denominator + other.#numerator * this.#denominator,
      this.#denominator * other.#denominator,
    );
  }

  /**
   * @param {Fraction} other
   * @returns {Fraction}
   */
  sub(other) {
    return new Fraction(
      this.#numerator * other.#denominator - other.#numerator * this.#denominator,
      this.#denominator * other.#denominator,
    );
  }

  /**
   * @param {Fraction} other
   * @returns {Fraction}
   */
  mul(other) {
    return new Fraction(
      this.#numerator   * other.#numerator,
      this.#denominator * other.#denominator,
    );
  }

  /**
   * @param {Fraction} other
   * @returns {Fraction}
   */
  div(other) {
    if (other.#numerator === 0) {
      throw new RangeError('Fraction.div: divisor must not be zero');
    }
    return new Fraction(
      this.#numerator   * other.#denominator,
      this.#denominator * other.#numerator,
    );
  }

  // ── Unary ──────────────────────────────────────────────────────────────────

  /** @returns {Fraction} */
  negate() {
    return new Fraction(-this.#numerator, this.#denominator);
  }

  /** @returns {Fraction} */
  reciprocal() {
    if (this.#numerator === 0) {
      throw new RangeError('Fraction.reciprocal: cannot take reciprocal of zero');
    }
    return new Fraction(this.#denominator, this.#numerator);
  }

  /** @returns {Fraction} */
  abs() {
    return new Fraction(Math.abs(this.#numerator), this.#denominator);
  }

  // ── Conversion ─────────────────────────────────────────────────────────────

  /** @returns {number} */
  toNumber() {
    return this.#numerator / this.#denominator;
  }

  /**
   * Returns "n/d" or just "n" when denominator is 1.
   * @returns {string}
   */
  toString() {
    if (this.#denominator === 1) {
      return String(this.#numerator);
    }
    return `${this.#numerator}/${this.#denominator}`;
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  /**
   * @param {Fraction} other
   * @returns {boolean}
   */
  equals(other) {
    return this.#numerator === other.#numerator &&
           this.#denominator === other.#denominator;
  }

  /**
   * Returns a negative number, zero, or a positive number.
   * @param {Fraction} other
   * @returns {number}
   */
  compareTo(other) {
    return this.#numerator * other.#denominator -
           other.#numerator * this.#denominator;
  }

  // ── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Convert a JS number to a Fraction.
   * Integers are converted exactly; decimals are approximated by scaling.
   *
   * @param {number} n
   * @returns {Fraction}
   */
  static fromNumber(n) {
    if (Number.isInteger(n)) {
      return new Fraction(n, 1);
    }
    // Find decimal precision and scale to integer numerator/denominator.
    const str       = String(n);
    const dotIndex  = str.indexOf('.');
    const decimals  = dotIndex === -1 ? 0 : str.length - dotIndex - 1;
    const scale     = Math.pow(10, decimals);
    return new Fraction(Math.round(n * scale), scale);
  }

  /** @type {Fraction} */
  static ZERO = new Fraction(0, 1);

  /** @type {Fraction} */
  static ONE = new Fraction(1, 1);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Factory function — thin wrapper around `new Fraction`.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @returns {Fraction}
 */
export function createFraction(numerator, denominator) {
  return new Fraction(numerator, denominator);
}
