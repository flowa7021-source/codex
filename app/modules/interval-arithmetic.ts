// @ts-check

/**
 * Interval Arithmetic — closed interval [lo, hi] for tracking value ranges
 * and propagating uncertainty through arithmetic operations.
 *
 * @module interval-arithmetic
 */

/**
 * A closed interval [lo, hi] supporting interval arithmetic operations.
 */
export class Interval {
  /** Lower bound of the interval. */
  readonly lo: number;

  /** Upper bound of the interval. */
  readonly hi: number;

  /**
   * @param lo - Lower bound.
   * @param hi - Upper bound.
   * @throws {RangeError} if lo > hi.
   */
  constructor(lo: number, hi: number) {
    if (lo > hi) {
      throw new RangeError(
        `Interval: lo must be <= hi, got [${lo}, ${hi}]`
      );
    }
    this.lo = lo;
    this.hi = hi;
  }

  /**
   * Addition: [a,b] + [c,d] = [a+c, b+d]
   * @param other
   */
  add(other: Interval): Interval {
    return new Interval(this.lo + other.lo, this.hi + other.hi);
  }

  /**
   * Subtraction: [a,b] - [c,d] = [a-d, b-c]
   * @param other
   */
  sub(other: Interval): Interval {
    return new Interval(this.lo - other.hi, this.hi - other.lo);
  }

  /**
   * Multiplication: take min/max of all four endpoint products.
   * @param other
   */
  mul(other: Interval): Interval {
    const products = [
      this.lo * other.lo,
      this.lo * other.hi,
      this.hi * other.lo,
      this.hi * other.hi,
    ];
    return new Interval(Math.min(...products), Math.max(...products));
  }

  /**
   * Division: [a,b] / [c,d].
   * @param other
   * @throws {RangeError} if the divisor interval contains 0.
   */
  div(other: Interval): Interval {
    if (other.lo <= 0 && other.hi >= 0) {
      throw new RangeError(
        `Interval.div: divisor interval [${other.lo}, ${other.hi}] contains 0`
      );
    }
    return this.mul(new Interval(1 / other.hi, 1 / other.lo));
  }

  /**
   * Negation: -[a,b] = [-b, -a]
   */
  neg(): Interval {
    return new Interval(-this.hi, -this.lo);
  }

  /**
   * Absolute value of an interval.
   * - If the interval is entirely non-negative, return it unchanged.
   * - If entirely non-positive, negate it.
   * - Otherwise 0 is inside, so the result is [0, max(|a|, |b|)].
   */
  abs(): Interval {
    if (this.lo >= 0) {
      return new Interval(this.lo, this.hi);
    }
    if (this.hi <= 0) {
      return new Interval(-this.hi, -this.lo);
    }
    return new Interval(0, Math.max(-this.lo, this.hi));
  }

  /**
   * Width (diameter) of the interval: hi - lo.
   */
  width(): number {
    return this.hi - this.lo;
  }

  /**
   * Midpoint of the interval: (lo + hi) / 2.
   */
  midpoint(): number {
    return (this.lo + this.hi) / 2;
  }

  /**
   * Returns true if x is contained in [lo, hi].
   * @param x
   */
  contains(x: number): boolean {
    return x >= this.lo && x <= this.hi;
  }

  /**
   * Returns true if this interval overlaps (shares at least one point with) other.
   * @param other
   */
  overlaps(other: Interval): boolean {
    return this.lo <= other.hi && other.lo <= this.hi;
  }

  /**
   * Returns the intersection of this interval with other, or null if they are disjoint.
   * @param other
   */
  intersect(other: Interval): Interval | null {
    const lo = Math.max(this.lo, other.lo);
    const hi = Math.min(this.hi, other.hi);
    if (lo > hi) return null;
    return new Interval(lo, hi);
  }

  /**
   * Returns the smallest interval (hull) that contains both this and other.
   * @param other
   */
  hull(other: Interval): Interval {
    return new Interval(
      Math.min(this.lo, other.lo),
      Math.max(this.hi, other.hi)
    );
  }

  /**
   * String representation: '[lo, hi]'
   */
  toString(): string {
    return `[${this.lo}, ${this.hi}]`;
  }

  /**
   * Creates a degenerate (point) interval [x, x].
   * @param x
   */
  static point(x: number): Interval {
    return new Interval(x, x);
  }

  /**
   * Creates an interval centered at `center` with the given `radius`:
   * [center - radius, center + radius].
   * @param center
   * @param radius - Must be >= 0.
   * @throws {RangeError} if radius < 0.
   */
  static fromRadius(center: number, radius: number): Interval {
    if (radius < 0) {
      throw new RangeError(
        `Interval.fromRadius: radius must be >= 0, got ${radius}`
      );
    }
    return new Interval(center - radius, center + radius);
  }
}

/**
 * Factory function for creating a closed interval [lo, hi].
 * @param lo - Lower bound.
 * @param hi - Upper bound.
 * @throws {RangeError} if lo > hi.
 */
export function createInterval(lo: number, hi: number): Interval {
  return new Interval(lo, hi);
}
