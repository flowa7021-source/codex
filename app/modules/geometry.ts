// @ts-check
// ─── 2D Geometry Primitives ───────────────────────────────────────────────────
// Provides fundamental 2-D geometry types and operations: points, lines,
// circles, rectangles, and polygons.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Point { x: number; y: number; }
export interface Line { a: Point; b: Point; }
export interface Circle { center: Point; radius: number; }
export interface Rectangle { x: number; y: number; width: number; height: number; }
export interface Polygon { vertices: Point[]; }

// ─── Point / Line Primitives ─────────────────────────────────────────────────

/**
 * Euclidean distance between two points.
 */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Midpoint of two points.
 */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Length of a line segment.
 */
export function lineLength(line: Line): number {
  return distance(line.a, line.b);
}

/**
 * Slope of a line (rise / run).  Returns `Infinity` for a vertical line.
 */
export function slope(line: Line): number {
  const dx = line.b.x - line.a.x;
  if (dx === 0) return Infinity;
  return (line.b.y - line.a.y) / dx;
}

/**
 * Y-intercept of the infinite line passing through `line.a` and `line.b`.
 * Returns `NaN` for a vertical line.
 */
export function yIntercept(line: Line): number {
  const m = slope(line);
  if (!isFinite(m)) return NaN;
  return line.a.y - m * line.a.x;
}

/**
 * Intersection point of two infinite lines, or `null` if they are parallel.
 */
export function lineIntersection(l1: Line, l2: Line): Point | null {
  // Using the parametric form to avoid special-casing verticals.
  const dx1 = l1.b.x - l1.a.x;
  const dy1 = l1.b.y - l1.a.y;
  const dx2 = l2.b.x - l2.a.x;
  const dy2 = l2.b.y - l2.a.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (denom === 0) return null; // parallel or coincident

  const t =
    ((l2.a.x - l1.a.x) * dy2 - (l2.a.y - l1.a.y) * dx2) / denom;

  return {
    x: l1.a.x + t * dx1,
    y: l1.a.y + t * dy1,
  };
}

/**
 * Returns `true` if point `p` lies on the infinite line defined by `l`
 * within the given `tolerance` (default 1e-9).
 */
export function pointOnLine(p: Point, l: Line, tolerance: number = 1e-9): boolean {
  // Cross-product magnitude of vectors (b-a) and (p-a) equals zero for collinear.
  const dx = l.b.x - l.a.x;
  const dy = l.b.y - l.a.y;
  const cross = (p.x - l.a.x) * dy - (p.y - l.a.y) * dx;
  return Math.abs(cross) <= tolerance * Math.max(1, Math.hypot(dx, dy));
}

// ─── Circle ───────────────────────────────────────────────────────────────────

/**
 * Area of a circle.
 */
export function circleArea(c: Circle): number {
  return Math.PI * c.radius * c.radius;
}

/**
 * Perimeter (circumference) of a circle.
 */
export function circlePerimeter(c: Circle): number {
  return 2 * Math.PI * c.radius;
}

/**
 * Returns `true` if point `p` is inside or on the boundary of circle `c`.
 */
export function circleContainsPoint(c: Circle, p: Point): boolean {
  return distance(c.center, p) <= c.radius;
}

// ─── Rectangle ───────────────────────────────────────────────────────────────

/**
 * Area of a rectangle.
 */
export function rectArea(r: Rectangle): number {
  return r.width * r.height;
}

/**
 * Perimeter of a rectangle.
 */
export function rectPerimeter(r: Rectangle): number {
  return 2 * (r.width + r.height);
}

/**
 * Returns `true` if point `p` is inside or on the boundary of rectangle `r`.
 * `r.x` and `r.y` represent the top-left corner.
 */
export function rectContainsPoint(r: Rectangle, p: Point): boolean {
  return (
    p.x >= r.x &&
    p.x <= r.x + r.width &&
    p.y >= r.y &&
    p.y <= r.y + r.height
  );
}

/**
 * Returns `true` if two rectangles overlap (including touching edges).
 */
export function rectsOverlap(r1: Rectangle, r2: Rectangle): boolean {
  return (
    r1.x <= r2.x + r2.width &&
    r1.x + r1.width >= r2.x &&
    r1.y <= r2.y + r2.height &&
    r1.y + r1.height >= r2.y
  );
}

// ─── Polygon ─────────────────────────────────────────────────────────────────

/**
 * Area of a polygon using the shoelace (Gauss) formula.
 * Works for simple (non-self-intersecting) polygons.
 */
export function polygonArea(poly: Polygon): number {
  const v = poly.vertices;
  const n = v.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Perimeter of a polygon (sum of all edge lengths).
 */
export function polygonPerimeter(poly: Polygon): number {
  const v = poly.vertices;
  const n = v.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += distance(v[i], v[(i + 1) % n]);
  }
  return total;
}

/**
 * Returns `true` if point `p` is inside `poly` using the ray-casting algorithm.
 * Points on the boundary may return either `true` or `false`.
 */
export function polygonContainsPoint(poly: Polygon, p: Point): boolean {
  const v = poly.vertices;
  const n = v.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = v[i].x, yi = v[i].y;
    const xj = v[j].x, yj = v[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Transformations ─────────────────────────────────────────────────────────

/**
 * Rotate point `p` around `origin` by `angleDeg` degrees (counter-clockwise).
 */
export function rotatePoint(p: Point, origin: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Scale point `p` away from / towards `origin` by the given `factor`.
 */
export function scalePoint(p: Point, origin: Point, factor: number): Point {
  return {
    x: origin.x + (p.x - origin.x) * factor,
    y: origin.y + (p.y - origin.y) * factor,
  };
}
