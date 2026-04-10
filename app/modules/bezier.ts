// ─── Bezier Curve ─────────────────────────────────────────────────────────────
// @ts-check
// Bezier curve evaluation for NovaReader (linear, quadratic, cubic, n-order).

// ─── Types ────────────────────────────────────────────────────────────────────

/** A 2-D point. */
export interface Point {
  x: number;
  y: number;
}

// ─── Scalar Interpolation ────────────────────────────────────────────────────

/**
 * Linear interpolation between two scalar values.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor in [0, 1]
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Point Interpolation ─────────────────────────────────────────────────────

/**
 * Linear interpolation between two {@link Point}s.
 *
 * @param a - Start point
 * @param b - End point
 * @param t - Interpolation factor in [0, 1]
 */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// ─── Quadratic Bezier ────────────────────────────────────────────────────────

/**
 * Evaluate a quadratic Bezier curve at parameter t.
 *
 * The formula is the degree-2 Bernstein form:
 *   B(t) = (1-t)²·p0 + 2·(1-t)·t·p1 + t²·p2
 *
 * @param p0 - Start point
 * @param p1 - Control point
 * @param p2 - End point
 * @param t  - Parameter in [0, 1]
 */
export function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

// ─── Cubic Bezier ────────────────────────────────────────────────────────────

/**
 * Evaluate a cubic Bezier curve at parameter t.
 *
 * The formula is the degree-3 Bernstein form:
 *   B(t) = (1-t)³·p0 + 3·(1-t)²·t·p1 + 3·(1-t)·t²·p2 + t³·p3
 *
 * @param p0 - Start point
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - End point
 * @param t  - Parameter in [0, 1]
 */
export function cubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

// ─── BezierCurve class ───────────────────────────────────────────────────────

/**
 * General n-order Bezier curve evaluated via De Casteljau's algorithm.
 *
 * The curve order equals `controlPoints.length - 1`:
 * - 2 points → order 1 (linear)
 * - 3 points → order 2 (quadratic)
 * - 4 points → order 3 (cubic)
 * - etc.
 */
export class BezierCurve {
  /** Ordered list of control points (immutable snapshot). */
  readonly #points: Point[];

  /** Curve order: number of control points minus one. */
  readonly order: number;

  /**
   * @param controlPoints - At least 2 points that define the curve.
   * @throws {RangeError} When fewer than 2 control points are supplied.
   */
  constructor(controlPoints: Point[]) {
    if (controlPoints.length < 2) {
      throw new RangeError(
        `BezierCurve requires at least 2 control points, got ${controlPoints.length}`,
      );
    }
    // Snapshot to prevent external mutation.
    this.#points = controlPoints.map(p => ({ x: p.x, y: p.y }));
    this.order = this.#points.length - 1;
  }

  /**
   * Evaluate the curve at parameter t using De Casteljau's algorithm.
   * t is clamped to [0, 1].
   *
   * @param t - Curve parameter (clamped to [0, 1])
   */
  at(t: number): Point {
    const tc = Math.min(1, Math.max(0, t));
    // Working copy for De Casteljau reduction.
    let pts: Point[] = this.#points.map(p => ({ x: p.x, y: p.y }));
    const n = pts.length;
    for (let r = 1; r < n; r++) {
      for (let i = 0; i < n - r; i++) {
        pts[i] = lerpPoint(pts[i], pts[i + 1], tc);
      }
    }
    return pts[0];
  }

  /**
   * Sample n evenly-spaced points along the curve (t = 0 .. 1 inclusive).
   *
   * @param n - Number of sample points (must be ≥ 2)
   * @throws {RangeError} When n < 2.
   */
  sample(n: number): Point[] {
    if (n < 2) {
      throw new RangeError(`sample() requires n ≥ 2, got ${n}`);
    }
    const points: Point[] = [];
    for (let i = 0; i < n; i++) {
      points.push(this.at(i / (n - 1)));
    }
    return points;
  }

  /**
   * Compute the tangent vector at parameter t (not normalized).
   *
   * The tangent is derived by differentiating the De Casteljau reduction one
   * level early: after reducing to 2 points, the tangent direction is
   * order × (p1 − p0).
   *
   * @param t - Curve parameter (clamped to [0, 1])
   */
  tangent(t: number): Point {
    const tc = Math.min(1, Math.max(0, t));
    let pts: Point[] = this.#points.map(p => ({ x: p.x, y: p.y }));
    const n = pts.length;
    // Reduce to 2 points.
    for (let r = 1; r < n - 1; r++) {
      for (let i = 0; i < n - r; i++) {
        pts[i] = lerpPoint(pts[i], pts[i + 1], tc);
      }
    }
    return {
      x: this.order * (pts[1].x - pts[0].x),
      y: this.order * (pts[1].y - pts[0].y),
    };
  }

  /**
   * Approximate the arc length of the curve using numerical integration.
   *
   * Samples `steps` sub-intervals and sums the chord lengths between
   * consecutive sample points.
   *
   * @param steps - Number of integration steps (default: 100)
   */
  length(steps = 100): number {
    const n = Math.max(2, steps + 1);
    let total = 0;
    let prev = this.at(0);
    for (let i = 1; i < n; i++) {
      const curr = this.at(i / (n - 1));
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      total += Math.sqrt(dx * dx + dy * dy);
      prev = curr;
    }
    return total;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Convenience factory that creates a {@link BezierCurve} from an array of
 * control points.
 *
 * @param points - At least 2 control points.
 * @throws {RangeError} Propagated from {@link BezierCurve} constructor.
 */
export function createBezier(points: Point[]): BezierCurve {
  return new BezierCurve(points);
}
