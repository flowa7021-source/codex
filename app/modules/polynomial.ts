// @ts-check
// ─── Polynomial Arithmetic Module ────────────────────────────────────────────
// Immutable polynomial over real numbers.
// coefficients[i] is the coefficient of x^i (index 0 = constant term).

/**
 * Trim trailing zeros from a coefficient array and return a readonly copy.
 * Returns an empty array for the zero polynomial.
 */
function trimCoefficients(coeffs: number[]): readonly number[] {
  let last = coeffs.length - 1;
  while (last >= 0 && coeffs[last] === 0) last--;
  return Object.freeze(coeffs.slice(0, last + 1));
}

/** Immutable polynomial over real numbers. */
export class Polynomial {
  /** Trimmed, frozen coefficient array. coefficients[i] is the x^i term. */
  readonly coefficients: readonly number[];

  /**
   * Degree of the polynomial (highest non-zero power), or -1 for the zero
   * polynomial.
   */
  readonly degree: number;

  /**
   * @param coefficients - Raw coefficients; trailing zeros are trimmed.
   *   An empty array or all-zero array produces the zero polynomial (degree -1).
   */
  constructor(coefficients: number[]) {
    this.coefficients = trimCoefficients(coefficients);
    this.degree = this.coefficients.length - 1;
  }

  // ── Evaluation ──────────────────────────────────────────────────────────────

  /**
   * Evaluate the polynomial at `x` using Horner's method.
   * Returns 0 for the zero polynomial.
   */
  evaluate(x: number): number {
    const c = this.coefficients;
    if (c.length === 0) return 0;
    let result = c[c.length - 1];
    for (let i = c.length - 2; i >= 0; i--) {
      result = result * x + c[i];
    }
    return result;
  }

  // ── Arithmetic ──────────────────────────────────────────────────────────────

  /** Return the sum of this polynomial and `other`. */
  add(other: Polynomial): Polynomial {
    const len = Math.max(this.coefficients.length, other.coefficients.length);
    const result: number[] = new Array(len).fill(0);
    for (let i = 0; i < this.coefficients.length; i++) result[i] += this.coefficients[i];
    for (let i = 0; i < other.coefficients.length; i++) result[i] += other.coefficients[i];
    return new Polynomial(result);
  }

  /** Return the difference of this polynomial minus `other`. */
  sub(other: Polynomial): Polynomial {
    const len = Math.max(this.coefficients.length, other.coefficients.length);
    const result: number[] = new Array(len).fill(0);
    for (let i = 0; i < this.coefficients.length; i++) result[i] += this.coefficients[i];
    for (let i = 0; i < other.coefficients.length; i++) result[i] -= other.coefficients[i];
    return new Polynomial(result);
  }

  /** Return the product of this polynomial and `other`. */
  mul(other: Polynomial): Polynomial {
    if (this.degree === -1 || other.degree === -1) return Polynomial.zero();
    const resultLen = this.degree + other.degree + 1;
    const result: number[] = new Array(resultLen).fill(0);
    for (let i = 0; i < this.coefficients.length; i++) {
      for (let j = 0; j < other.coefficients.length; j++) {
        result[i + j] += this.coefficients[i] * other.coefficients[j];
      }
    }
    return new Polynomial(result);
  }

  /** Return this polynomial multiplied by a scalar. */
  scale(scalar: number): Polynomial {
    if (scalar === 0) return Polynomial.zero();
    return new Polynomial(this.coefficients.map((c) => c * scalar));
  }

  // ── Calculus ────────────────────────────────────────────────────────────────

  /** Return the formal derivative of this polynomial. */
  derivative(): Polynomial {
    if (this.degree <= 0) return Polynomial.zero();
    const result: number[] = new Array(this.degree);
    for (let i = 1; i <= this.degree; i++) {
      result[i - 1] = i * this.coefficients[i];
    }
    return new Polynomial(result);
  }

  // ── Representation ──────────────────────────────────────────────────────────

  /**
   * Return a human-readable string such as "3x^2 + 2x + 1".
   * Returns "0" for the zero polynomial.
   */
  toString(): string {
    if (this.degree === -1) return '0';

    const terms: string[] = [];
    for (let i = this.degree; i >= 0; i--) {
      const coeff = this.coefficients[i];
      if (coeff === 0) continue;

      let term: string;
      if (i === 0) {
        term = String(coeff);
      } else if (i === 1) {
        term = coeff === 1 ? 'x' : coeff === -1 ? '-x' : `${coeff}x`;
      } else {
        term = coeff === 1 ? `x^${i}` : coeff === -1 ? `-x^${i}` : `${coeff}x^${i}`;
      }
      terms.push(term);
    }

    if (terms.length === 0) return '0';

    // Join terms with ' + ' / ' - ', handling negative coefficients correctly.
    let out = terms[0];
    for (let i = 1; i < terms.length; i++) {
      if (terms[i].startsWith('-')) {
        out += ` - ${terms[i].slice(1)}`;
      } else {
        out += ` + ${terms[i]}`;
      }
    }
    return out;
  }

  // ── Static factories ────────────────────────────────────────────────────────

  /** The zero polynomial (degree -1). */
  static zero(): Polynomial {
    return new Polynomial([]);
  }

  /** The constant polynomial 1 (degree 0). */
  static one(): Polynomial {
    return new Polynomial([1]);
  }

  /**
   * Build a polynomial whose roots are exactly the given values by computing
   * the product of (x - root) for each root.
   */
  static fromRoots(roots: number[]): Polynomial {
    let p = Polynomial.one();
    for (const root of roots) {
      // (x - root) has coefficients [-root, 1]
      p = p.mul(new Polynomial([-root, 1]));
    }
    return p;
  }
}

/**
 * Factory function — creates a {@link Polynomial} from a coefficient array.
 * Equivalent to `new Polynomial(coefficients)`.
 */
export function createPolynomial(coefficients: number[]): Polynomial {
  return new Polynomial(coefficients);
}
