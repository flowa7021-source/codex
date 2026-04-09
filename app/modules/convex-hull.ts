// @ts-check
// ─── Convex Hull Algorithms ─────────────────────────────────────────────────
// Graham scan and related convex hull utilities.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cross product of vectors OA and OB where O is the origin point. */
function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/** Euclidean distance squared between two points. */
function distSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  return Math.sqrt(distSq(a, b));
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute the convex hull of a set of points using Graham scan.
 * Returns hull vertices in counter-clockwise order.
 * For fewer than 3 non-collinear points, returns the unique points.
 */
export function convexHull(points: Point[]): Point[] {
  const n = points.length;
  if (n <= 1) return points.slice();

  // Find the lowest point (by y, then by x for ties).
  let pivot = 0;
  for (let i = 1; i < n; i++) {
    if (
      points[i].y < points[pivot].y ||
      (points[i].y === points[pivot].y && points[i].x < points[pivot].x)
    ) {
      pivot = i;
    }
  }

  const origin = points[pivot];

  // Sort by polar angle relative to origin; collinear points sorted by distance.
  const sorted = points
    .slice()
    .filter((_, i) => i !== pivot)
    .sort((a, b) => {
      const c = cross(origin, a, b);
      if (c === 0) return distSq(origin, a) - distSq(origin, b);
      return -c; // negative so CCW order
    });

  // Remove duplicate angles — keep the farthest point for collinear sets.
  const filtered: Point[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const c = cross(origin, sorted[i - 1], sorted[i]);
    if (c === 0) {
      filtered[filtered.length - 1] = sorted[i]; // replace with farther
    } else {
      filtered.push(sorted[i]);
    }
  }

  if (filtered.length < 2) {
    return [origin, ...filtered];
  }

  const stack: Point[] = [origin, filtered[0]];
  for (let i = 1; i < filtered.length; i++) {
    while (
      stack.length > 1 &&
      cross(stack[stack.length - 2], stack[stack.length - 1], filtered[i]) <= 0
    ) {
      stack.pop();
    }
    stack.push(filtered[i]);
  }

  return stack;
}

/**
 * Test whether a point lies inside (or on the boundary of) a convex hull.
 * The hull must be in CCW order (as returned by `convexHull`).
 */
export function isInsideHull(hull: Point[], point: Point): boolean {
  const n = hull.length;
  if (n === 0) return false;
  if (n === 1) return hull[0].x === point.x && hull[0].y === point.y;
  if (n === 2) {
    // Check collinearity and between-ness.
    const c = cross(hull[0], hull[1], point);
    if (c !== 0) return false;
    const minX = Math.min(hull[0].x, hull[1].x);
    const maxX = Math.max(hull[0].x, hull[1].x);
    const minY = Math.min(hull[0].y, hull[1].y);
    const maxY = Math.max(hull[0].y, hull[1].y);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (cross(hull[i], hull[j], point) < 0) return false;
  }
  return true;
}

/**
 * Compute the area of a convex hull (given in CCW order).
 * Uses the shoelace formula.
 */
export function hullArea(hull: Point[]): number {
  const n = hull.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += hull[i].x * hull[j].y;
    area -= hull[j].x * hull[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Compute the perimeter of a convex hull (given in CCW order).
 */
export function hullPerimeter(hull: Point[]): number {
  const n = hull.length;
  if (n < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += dist(hull[i], hull[j]);
  }
  return perimeter;
}

/**
 * Factory: compute the convex hull plus its area and perimeter.
 */
export function createConvexHull(points: Point[]): {
  hull: Point[];
  area: number;
  perimeter: number;
} {
  const hull = convexHull(points);
  return {
    hull,
    area: hullArea(hull),
    perimeter: hullPerimeter(hull),
  };
}
