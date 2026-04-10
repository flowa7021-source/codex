// @ts-check
// ─── Cubic Spline Interpolation ───────────────────────────────────────────────
// Natural cubic spline fitted to a set of control points (xs, ys).
// The tridiagonal system is solved with the Thomas algorithm (O(n) time).
// "Natural" boundary conditions: second derivative = 0 at both endpoints.

// ─── CubicSpline ──────────────────────────────────────────────────────────────

/**
 * Piecewise-cubic interpolant passing through each (xs[i], ys[i]) knot.
 *
 * The spline is parameterised on each sub-interval [xs[i], xs[i+1]] as:
 *   S_i(x) = a_i + b_i·h + c_i·h² + d_i·h³,   h = x − xs[i]
 * where a_i = ys[i] and c_i, d_i are derived from the natural-spline moments.
 */
export class CubicSpline {
  /** Control-point x-coordinates (strictly increasing). */
  readonly xs: readonly number[];
  /** Control-point y-coordinates. */
  readonly ys: readonly number[];

  /** Cubic coefficient (c[i] = M[i]/2, where M[i] is the i-th moment). */
  readonly #c: readonly number[];
  /** Cubic coefficient d[i] = (M[i+1] − M[i]) / (6·h[i]). */
  readonly #d: readonly number[];
  /** Linear coefficient b[i] = (ys[i+1]−ys[i])/h[i] − h[i]·(2M[i]+M[i+1])/6. */
  readonly #b: readonly number[];

  /**
   * Fit a natural cubic spline to the supplied control points.
   *
   * @param xs - Strictly-increasing x-coordinates (length ≥ 2).
   * @param ys - Corresponding y-coordinates (same length as xs).
   * @throws {RangeError} When fewer than 2 points are provided.
   * @throws {RangeError} When xs and ys have different lengths.
   * @throws {RangeError} When xs is not strictly increasing.
   */
  constructor(xs: number[], ys: number[]) {
    if (xs.length < 2) {
      throw new RangeError(
        `CubicSpline requires at least 2 points, got ${xs.length}.`,
      );
    }
    if (xs.length !== ys.length) {
      throw new RangeError(
        `CubicSpline: xs and ys must have the same length (got ${xs.length} and ${ys.length}).`,
      );
    }
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] <= xs[i - 1]) {
        throw new RangeError(
          `CubicSpline: xs must be strictly increasing (xs[${i - 1}]=${xs[i - 1]} >= xs[${i}]=${xs[i]}).`,
        );
      }
    }

    this.xs = Object.freeze(xs.slice());
    this.ys = Object.freeze(ys.slice());

    const n = xs.length;
    // Sub-interval widths.
    const h: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
    }

    // ── Solve for second derivatives M[i] (the "moments") ───────────────────
    // Natural spline: M[0] = M[n-1] = 0.
    // Interior equations (i = 1 … n-2):
    //   h[i-1]·M[i-1] + 2(h[i-1]+h[i])·M[i] + h[i]·M[i+1]
    //     = 6·((ys[i+1]-ys[i])/h[i] − (ys[i]-ys[i-1])/h[i-1])

    // Number of interior nodes to solve for.
    const m = n - 2;
    const M: number[] = new Array(n).fill(0); // boundary values already 0

    if (m > 0) {
      // Build the tridiagonal system for interior moments M[1] … M[n-2].
      // lower[i], diag[i], upper[i], rhs[i] correspond to row i in [0, m).
      const diag: number[] = new Array(m);
      const upper: number[] = new Array(m);
      const lower: number[] = new Array(m);
      const rhs: number[] = new Array(m);

      for (let i = 0; i < m; i++) {
        // Interior node index in xs is i+1.
        const k = i + 1;
        diag[i] = 2 * (h[k - 1] + h[k]);
        lower[i] = h[k - 1]; // coefficient of M[k-1]
        upper[i] = h[k];     // coefficient of M[k+1]
        rhs[i] =
          6 *
          ((ys[k + 1] - ys[k]) / h[k] -
            (ys[k] - ys[k - 1]) / h[k - 1]);
      }

      // Thomas algorithm (forward sweep then back substitution).
      // Forward sweep: eliminate the lower diagonal.
      const c_: number[] = new Array(m); // modified upper diagonal
      const d_: number[] = new Array(m); // modified rhs
      c_[0] = upper[0] / diag[0];
      d_[0] = rhs[0] / diag[0];
      for (let i = 1; i < m; i++) {
        const denom = diag[i] - lower[i] * c_[i - 1];
        c_[i] = upper[i] / denom;
        d_[i] = (rhs[i] - lower[i] * d_[i - 1]) / denom;
      }

      // Back substitution.
      M[m] = d_[m - 1]; // interior node index m → xs index m (= n-2)
      for (let i = m - 2; i >= 0; i--) {
        M[i + 1] = d_[i] - c_[i] * M[i + 2];
      }
    }

    // ── Derive polynomial coefficients on each sub-interval ─────────────────
    const b: number[] = new Array(n - 1);
    const c: number[] = new Array(n - 1);
    const d: number[] = new Array(n - 1);

    for (let i = 0; i < n - 1; i++) {
      c[i] = M[i] / 2;
      d[i] = (M[i + 1] - M[i]) / (6 * h[i]);
      b[i] =
        (ys[i + 1] - ys[i]) / h[i] -
        (h[i] / 6) * (2 * M[i] + M[i + 1]);
    }

    this.#b = Object.freeze(b);
    this.#c = Object.freeze(c);
    this.#d = Object.freeze(d);
  }

  // ── Interval lookup ─────────────────────────────────────────────────────────

  /**
   * Binary search: return the index i such that xs[i] ≤ x < xs[i+1].
   * Clamps to [0, n-2] so boundary evaluations are handled gracefully.
   */
  #findInterval(x: number): number {
    const xs = this.xs;
    const n = xs.length;

    // Clamp to valid range.
    if (x <= xs[0]) return 0;
    if (x >= xs[n - 1]) return n - 2;

    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= x) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Evaluate the spline at a single point x.
   * Clamps gracefully when x is outside [xs[0], xs[n-1]].
   *
   * @param x - The point at which to evaluate.
   * @returns Interpolated value.
   */
  evaluate(x: number): number {
    const i = this.#findInterval(x);
    const h = x - this.xs[i];
    return this.ys[i] + this.#b[i] * h + this.#c[i] * h * h + this.#d[i] * h * h * h;
  }

  /**
   * Evaluate the spline at every x in the supplied array.
   *
   * @param xs - Points at which to evaluate.
   * @returns Array of interpolated values, same length as xs.
   */
  evaluateAll(xs: number[]): number[] {
    return xs.map((x) => this.evaluate(x));
  }

  /**
   * First derivative of the spline at x.
   * Uses the analytic formula: S'_i(x) = b_i + 2·c_i·h + 3·d_i·h²
   *
   * @param x - The point at which to evaluate the derivative.
   * @returns First derivative value.
   */
  derivative(x: number): number {
    const i = this.#findInterval(x);
    const h = x - this.xs[i];
    return this.#b[i] + 2 * this.#c[i] * h + 3 * this.#d[i] * h * h;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — equivalent to `new CubicSpline(xs, ys)`.
 *
 * @param xs - Strictly-increasing x-coordinates.
 * @param ys - Corresponding y-coordinates.
 * @returns A fitted `CubicSpline` instance.
 */
export function createCubicSpline(xs: number[], ys: number[]): CubicSpline {
  return new CubicSpline(xs, ys);
}
