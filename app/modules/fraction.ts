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

/** Greatest common divisor of two integers (always non-negative). */
export function gcd(a: number, b: number): number {
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
  #numerator: number;
  #denominator: number;

  constructor(numerator: number, denominator: number) {
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

  get numerator(): number {
    return this.#numerator;
  }

  get denominator(): number {
    return this.#denominator;
  }

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  add(other: Fraction): Fraction {
    return new Fraction(
      this.#numerator * other.#denominator + other.#numerator * this.#denominator,
      this.#denominator * other.#denominator,
    );
  }

  sub(other: Fraction): Fraction {
    return new Fraction(
      this.#numerator * other.#denominator - other.#numerator * this.#denominator,
      this.#denominator * other.#denominator,
    );
  }

  mul(other: Fraction): Fraction {
    return new Fraction(
      this.#numerator   * other.#numerator,
      this.#denominator * other.#denominator,
    );
  }

  div(other: Fraction): Fraction {
    if (other.#numerator === 0) {
      throw new RangeError('Fraction.div: divisor must not be zero');
    }
    return new Fraction(
      this.#numerator   * other.#denominator,
      this.#denominator * other.#numerator,
    );
  }

  // ── Unary ──────────────────────────────────────────────────────────────────

  negate(): Fraction {
    return new Fraction(-this.#numerator, this.#denominator);
  }

  reciprocal(): Fraction {
    if (this.#numerator === 0) {
      throw new RangeError('Fraction.reciprocal: cannot take reciprocal of zero');
    }
    return new Fraction(this.#denominator, this.#numerator);
  }

  abs(): Fraction {
    return new Fraction(Math.abs(this.#numerator), this.#denominator);
  }

  // ── Conversion ─────────────────────────────────────────────────────────────

  toNumber(): number {
    return this.#numerator / this.#denominator;
  }

  /** Returns "n/d" or just "n" when denominator is 1. */
  toString(): string {
    if (this.#denominator === 1) {
      return String(this.#numerator);
    }
    return `${this.#numerator}/${this.#denominator}`;
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  equals(other: Fraction): boolean {
    return this.#numerator === other.#numerator &&
           this.#denominator === other.#denominator;
  }

  /** Returns a negative number, zero, or a positive number. */
  compareTo(other: Fraction): number {
    return this.#numerator * other.#denominator -
           other.#numerator * this.#denominator;
  }

  // ── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Convert a JS number to a Fraction.
   * Integers are converted exactly; decimals are approximated by scaling.
   */
  static fromNumber(n: number): Fraction {
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

  static ZERO: Fraction = new Fraction(0, 1);
  static ONE: Fraction = new Fraction(1, 1);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Factory function — thin wrapper around `new Fraction`. */
export function createFraction(numerator: number, denominator: number): Fraction {
  return new Fraction(numerator, denominator);
}
