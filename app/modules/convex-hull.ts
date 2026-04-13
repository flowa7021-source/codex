// @ts-check
// ─── Convex Hull & Computational Geometry ────────────────────────────────────
// Graham scan, Jarvis march, Welzl's min-enclosing circle, closest pair,
// and simple fan triangulation.

import type { Point } from './geometry.js';

// ─── Re-exported Types ────────────────────────────────────────────────────────

export interface Triangle { a: Point; b: Point; c: Point; }

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Squared Euclidean distance (avoids sqrt for comparisons). */
function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** True Euclidean distance. */
function dist(a: Point, b: Point): number {
  return Math.sqrt(dist2(a, b));
}

/**
 * 2-D cross product of vectors OA and OB.
 *  > 0  → counter-clockwise turn
 *  = 0  → collinear
 *  < 0  → clockwise turn
 */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// ─── Graham Scan ──────────────────────────────────────────────────────────────

/**
 * Compute the convex hull of `points` using the Graham scan algorithm.
 * Returns the hull vertices in counter-clockwise order.
 * Returns an empty array for fewer than 3 non-collinear points (or all collinear).
 * For 1–2 points the input is returned as-is.
 */
export function grahamScan(points: Point[]): Point[] {
  const n = points.length;
  if (n <= 2) return points.slice();

  // Find the bottommost point (then leftmost for ties).
  let pivot = points[0];
  for (const p of points) {
    if (p.y < pivot.y || (p.y === pivot.y && p.x < pivot.x)) {
      pivot = p;
    }
  }

  // Sort by polar angle relative to pivot; break ties by distance (closer first).
  const sorted = points
    .filter(p => p !== pivot)
    .sort((a, b) => {
      const c = cross(pivot, a, b);
      if (c !== 0) return -c; // counter-clockwise order
      return dist2(pivot, a) - dist2(pivot, b);
    });

  const hull: Point[] = [pivot];

  for (const p of sorted) {
    // Remove points that would create a clockwise or collinear turn.
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  return hull;
}

// ─── Jarvis March (Gift Wrapping) ─────────────────────────────────────────────

/**
 * Compute the convex hull of `points` using the Jarvis march algorithm.
 * Returns the hull vertices in counter-clockwise order.
 */
export function jarvisMarch(points: Point[]): Point[] {
  const n = points.length;
  if (n <= 2) return points.slice();

  // Start from the leftmost point (then bottommost for ties).
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    if (
      points[i].x < points[startIdx].x ||
      (points[i].x === points[startIdx].x && points[i].y < points[startIdx].y)
    ) {
      startIdx = i;
    }
  }

  const hull: Point[] = [];
  let current = startIdx;

  do {
    hull.push(points[current]);
    let next = (current + 1) % n;

    for (let i = 0; i < n; i++) {
      const c = cross(points[current], points[next], points[i]);
      if (c > 0) {
        // points[i] is more counter-clockwise than points[next]
        next = i;
      } else if (c === 0) {
        // Collinear: pick the farther point to avoid including interior collinear pts
        if (dist2(points[current], points[i]) > dist2(points[current], points[next])) {
          next = i;
        }
      }
    }

    current = next;
  } while (current !== startIdx && hull.length <= n);

  return hull;
}

// ─── Convexity Check ─────────────────────────────────────────────────────────

/**
 * Returns `true` if the polygon defined by `points` (in order) is convex.
 * A polygon is convex when all consecutive cross-products have the same sign.
 */
export function isConvex(points: Point[]): boolean {
  const n = points.length;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const o = points[i];
    const a = points[(i + 1) % n];
    const b = points[(i + 2) % n];
    const c = cross(o, a, b);
    if (c !== 0) {
      const s = c > 0 ? 1 : -1;
      if (sign === 0) {
        sign = s;
      } else if (sign !== s) {
        return false;
      }
    }
  }
  return true;
}

// ─── Minimum Enclosing Circle (Welzl) ────────────────────────────────────────

/** Circle type local to this module. */
interface MEC { center: Point; radius: number; }

function makeCircle2(a: Point, b: Point): MEC {
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { center, radius: dist(a, center) };
}

function makeCircle3(a: Point, b: Point, c: Point): MEC | null {
  const ax = b.x - a.x, ay = b.y - a.y;
  const bx = c.x - a.x, by = c.y - a.y;
  const D = 2 * (ax * by - ay * bx);
  if (Math.abs(D) < 1e-10) return null; // collinear
  const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / D;
  const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / D;
  const center = { x: a.x + ux, y: a.y + uy };
  return { center, radius: dist(a, center) };
}

function inCircle(c: MEC, p: Point): boolean {
  return dist(c.center, p) <= c.radius + 1e-10;
}

function welzl(pts: Point[], R: Point[], n: number): MEC {
  if (n === 0 || R.length === 3) {
    if (R.length === 0) return { center: { x: 0, y: 0 }, radius: 0 };
    if (R.length === 1) return { center: { ...R[0] }, radius: 0 };
    if (R.length === 2) return makeCircle2(R[0], R[1]);
    // R.length === 3
    const c = makeCircle3(R[0], R[1], R[2]);
    if (c) return c;
    // Collinear – return circle through the two farthest points.
    const d01 = dist2(R[0], R[1]);
    const d12 = dist2(R[1], R[2]);
    const d02 = dist2(R[0], R[2]);
    if (d01 >= d12 && d01 >= d02) return makeCircle2(R[0], R[1]);
    if (d12 >= d01 && d12 >= d02) return makeCircle2(R[1], R[2]);
    return makeCircle2(R[0], R[2]);
  }

  const p = pts[n - 1];
  const d = welzl(pts, R, n - 1);

  if (inCircle(d, p)) return d;

  return welzl(pts, [...R, p], n - 1);
}

/**
 * Minimum enclosing circle of `points` using a randomised Welzl algorithm.
 * Returns `{ center: {x,y}, radius }`.
 */
export function minEnclosingCircle(points: Point[]): { center: Point; radius: number } {
  if (points.length === 0) return { center: { x: 0, y: 0 }, radius: 0 };
  if (points.length === 1) return { center: { ...points[0] }, radius: 0 };

  // Shuffle for expected O(n) time.
  const shuffled = points.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return welzl(shuffled, [], shuffled.length);
}

// ─── Closest Pair ─────────────────────────────────────────────────────────────

/**
 * Find the closest pair of points using the divide-and-conquer algorithm.
 * Returns `{ distance, a, b }`, or `null` if fewer than 2 points are given.
 */
export function closestPair(points: Point[]): { distance: number; a: Point; b: Point } | null {
  if (points.length < 2) return null;

  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const result = closestPairRec(sorted);
  return { distance: result.d, a: result.a, b: result.b };
}

interface CPResult { d: number; a: Point; b: Point; }

function closestPairRec(pts: Point[]): CPResult {
  const n = pts.length;

  if (n <= 3) {
    // Brute force for small sets.
    let best: CPResult = { d: Infinity, a: pts[0], b: pts[1] };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = dist(pts[i], pts[j]);
        if (d < best.d) best = { d, a: pts[i], b: pts[j] };
      }
    }
    return best;
  }

  const mid = Math.floor(n / 2);
  const midX = pts[mid].x;

  const left = closestPairRec(pts.slice(0, mid));
  const right = closestPairRec(pts.slice(mid));

  let best: CPResult = left.d < right.d ? left : right;

  // Strip: all points within best.d of the dividing line.
  const strip = pts.filter(p => Math.abs(p.x - midX) < best.d);
  strip.sort((a, b) => a.y - b.y);

  for (let i = 0; i < strip.length; i++) {
    for (let j = i + 1; j < strip.length && strip[j].y - strip[i].y < best.d; j++) {
      const d = dist(strip[i], strip[j]);
      if (d < best.d) best = { d, a: strip[i], b: strip[j] };
    }
  }

  return best;
}

// ─── Convenience API ─────────────────────────────────────────────────────────

/**
 * Compute the convex hull (alias for grahamScan with collinear handling).
 * Returns hull in CCW order; collinear inputs return only the endpoints.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length === 0) return [];
  return grahamScan(points);
}

/** Check whether `point` is inside or on the boundary of a convex hull. */
export function isInsideHull(hull: Point[], point: Point): boolean {
  if (hull.length === 0) return false;
  if (hull.length === 1) return hull[0].x === point.x && hull[0].y === point.y;
  if (hull.length === 2) {
    // On the line segment?
    const { x: x1, y: y1 } = hull[0];
    const { x: x2, y: y2 } = hull[1];
    const { x, y } = point;
    const cross2 = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (Math.abs(cross2) > 1e-10) return false;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    return x >= minX - 1e-10 && x <= maxX + 1e-10 && y >= minY - 1e-10 && y <= maxY + 1e-10;
  }
  // Use winding number / all cross products same sign for convex polygon.
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    if (cross(a, b, point) < -1e-10) return false;
  }
  return true;
}

/** Area of a convex hull using the shoelace formula. */
export function hullArea(hull: Point[]): number {
  if (hull.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Perimeter of a convex hull. */
export function hullPerimeter(hull: Point[]): number {
  if (hull.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < hull.length; i++) {
    p += dist(hull[i], hull[(i + 1) % hull.length]);
  }
  return p;
}

/** Factory: compute hull, area, and perimeter in one call. */
export function createConvexHull(points: Point[]): { hull: Point[]; area: number; perimeter: number } {
  const hull = convexHull(points);
  return { hull, area: hullArea(hull), perimeter: hullPerimeter(hull) };
}

// ─── Triangulation ────────────────────────────────────────────────────────────

/**
 * Triangulate a set of points using a simple fan triangulation from the
 * convex hull.  Returns an array of triangles.
 * Returns an empty array for fewer than 3 points.
 */
export function triangulate(points: Point[]): Triangle[] {
  if (points.length < 3) return [];

  const hull = grahamScan(points);
  if (hull.length < 3) return [];

  // Fan from the first hull vertex.
  const fan: Triangle[] = [];
  for (let i = 1; i < hull.length - 1; i++) {
    fan.push({ a: hull[0], b: hull[i], c: hull[i + 1] });
  }
  return fan;
}
