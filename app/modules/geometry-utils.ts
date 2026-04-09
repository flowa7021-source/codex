// @ts-check
// ─── Geometry Utilities ───────────────────────────────────────────────────────
// 2D geometry helpers: points, lines, circles, rectangles, and polygons.
// No browser APIs — pure math.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface Line2D {
  p1: Point2D;
  p2: Point2D;
}

export interface Circle2D {
  center: Point2D;
  radius: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Point operations ────────────────────────────────────────────────────────

/** Euclidean distance between two points. */
export function distance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Midpoint between two points. */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Angle from point a to point b in radians (range: -π to π). */
export function angle(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Rotate a point around an origin by the given angle (radians).
 * Positive angle = counter-clockwise.
 */
export function rotate(point: Point2D, origin: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Scale a point by `factor` relative to an optional origin (default: {0,0}).
 */
export function scale(point: Point2D, factor: number, origin: Point2D = { x: 0, y: 0 }): Point2D {
  return {
    x: origin.x + (point.x - origin.x) * factor,
    y: origin.y + (point.y - origin.y) * factor,
  };
}

/** Translate a point by (dx, dy). */
export function translate(point: Point2D, dx: number, dy: number): Point2D {
  return { x: point.x + dx, y: point.y + dy };
}

// ─── Line operations ─────────────────────────────────────────────────────────

/** Length of a line segment. */
export function lineLength(line: Line2D): number {
  return distance(line.p1, line.p2);
}

/**
 * Point on a line at parameter t ∈ [0, 1].
 * t=0 → p1, t=1 → p2.
 */
export function pointOnLine(line: Line2D, t: number): Point2D {
  return {
    x: line.p1.x + (line.p2.x - line.p1.x) * t,
    y: line.p1.y + (line.p2.y - line.p1.y) * t,
  };
}

/**
 * Intersection of two infinite lines defined by their segments.
 * Returns null if lines are parallel (or coincident).
 */
export function lineIntersect(l1: Line2D, l2: Line2D): Point2D | null {
  const x1 = l1.p1.x, y1 = l1.p1.y;
  const x2 = l1.p2.x, y2 = l1.p2.y;
  const x3 = l2.p1.x, y3 = l2.p1.y;
  const x4 = l2.p2.x, y4 = l2.p2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denom === 0) return null; // parallel or coincident

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

// ─── Containment & intersection tests ───────────────────────────────────────

/** Returns true if point lies within (or on the boundary of) the rectangle. */
export function pointInRect(point: Point2D, rect: Rect2D): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Returns true if point lies within (or on the boundary of) the circle. */
export function pointInCircle(point: Point2D, circle: Circle2D): boolean {
  return distance(point, circle.center) <= circle.radius;
}

/** Returns true if two circles overlap (distance between centres < sum of radii). */
export function circleIntersect(c1: Circle2D, c2: Circle2D): boolean {
  return distance(c1.center, c2.center) <= c1.radius + c2.radius;
}

/** Returns true if two axis-aligned rectangles overlap (touching counts). */
export function rectIntersect(r1: Rect2D, r2: Rect2D): boolean {
  return (
    r1.x <= r2.x + r2.width &&
    r1.x + r1.width >= r2.x &&
    r1.y <= r2.y + r2.height &&
    r1.y + r1.height >= r2.y
  );
}

// ─── Polygon operations ──────────────────────────────────────────────────────

/**
 * Area of a simple (non-self-intersecting) polygon via the shoelace formula.
 * Always returns a non-negative value.
 * Returns 0 for fewer than 3 vertices.
 */
export function polygonArea(vertices: Point2D[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += vertices[i].x * vertices[j].y;
    sum -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Returns true if the polygon defined by `vertices` is convex.
 * A polygon is convex if all cross products of consecutive edge pairs
 * have the same sign (or are zero).
 * Returns false for fewer than 3 vertices.
 */
export function isConvex(vertices: Point2D[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const c = vertices[(i + 2) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) {
      const crossSign = cross > 0 ? 1 : -1;
      if (sign === 0) {
        sign = crossSign;
      } else if (crossSign !== sign) {
        return false;
      }
    }
  }
  return true;
}
