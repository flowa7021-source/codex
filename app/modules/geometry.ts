// @ts-check
// ─── 2D Geometry Primitives & Operations ─────────────────────────────────────
// Pure functional 2D geometry library. All functions return NEW objects and
// never mutate their inputs. Floating-point comparisons use epsilon = 1e-10.

const EPSILON = 1e-10;

// ─── Types ────────────────────────────────────────────────────────────────────

/** A point in 2D space. */
export interface Point {
  x: number;
  y: number;
}

/** A directed line segment defined by two endpoints. */
export interface Line {
  a: Point;
  b: Point;
}

/** An axis-aligned rectangle. */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A circle defined by centre point and radius. */
export interface Circle {
  center: Point;
  radius: number;
}

/** A polygon defined by an ordered list of vertices. */
export interface Polygon {
  vertices: Point[];
}

// ─── Point Operations ─────────────────────────────────────────────────────────

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Midpoint of two points. */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Translate a point by (dx, dy). */
export function translate(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

/**
 * Rotate a point by `angle` radians about `origin` (default (0, 0)).
 * Positive angles rotate counter-clockwise.
 */
export function rotate(p: Point, angle: number, origin: Point = { x: 0, y: 0 }): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Rotate a point by `angleDeg` degrees about `pivot`.
 * Positive angles rotate counter-clockwise.
 */
export function rotatePoint(p: Point, pivot: Point, angleDeg: number): Point {
  return rotate(p, (angleDeg * Math.PI) / 180, pivot);
}

/**
 * Scale a point by `factor` relative to `origin` (default (0, 0)).
 */
export function scale(p: Point, factor: number, origin: Point = { x: 0, y: 0 }): Point {
  return {
    x: origin.x + (p.x - origin.x) * factor,
    y: origin.y + (p.y - origin.y) * factor,
  };
}

/**
 * Scale a point by `factor` relative to `pivot`.
 */
export function scalePoint(p: Point, pivot: Point, factor: number): Point {
  return scale(p, factor, pivot);
}

// ─── Line Operations ──────────────────────────────────────────────────────────

/** Length of a line segment. */
export function lineLength(line: Line): number {
  return distance(line.a, line.b);
}

/**
 * Slope (rise / run) of a line segment.
 * Returns `Infinity` for vertical lines.
 */
export function lineSlope(line: Line): number {
  const dx = line.b.x - line.a.x;
  if (Math.abs(dx) < EPSILON) return Infinity;
  return (line.b.y - line.a.y) / dx;
}

/** Alias for lineSlope. */
export const slope = lineSlope;

/** Y-intercept of a line: b = y1 - m * x1. Returns NaN for vertical lines. */
export function yIntercept(line: Line): number {
  const m = lineSlope(line);
  if (!isFinite(m)) return NaN;
  return line.a.y - m * line.a.x;
}

/**
 * Angle of a line segment in radians in the range [0, 2π).
 * Measured from the positive x-axis toward point b.
 */
export function lineAngle(line: Line): number {
  const angle = Math.atan2(line.b.y - line.a.y, line.b.x - line.a.x);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

/**
 * Interpolate a point on a line at parameter `t`.
 * t=0 → a, t=1 → b. Values outside [0,1] extrapolate beyond the segment.
 * (Internal helper)
 */
function interpolateLine(line: Line, t: number): Point {
  return {
    x: line.a.x + t * (line.b.x - line.a.x),
    y: line.a.y + t * (line.b.y - line.a.y),
  };
}

/**
 * Returns true if point `p` lies on the infinite line defined by `line`
 * (within epsilon tolerance).
 */
export function pointOnLine(p: Point, line: Line): boolean {
  // Check using perpendicular distance to the infinite line
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < EPSILON) return distance(p, line.a) < EPSILON;
  // Perpendicular distance
  const dist = Math.abs((p.x - line.a.x) * dy - (p.y - line.a.y) * dx) / len;
  return dist <= EPSILON;
}

/**
 * Intersection point of two infinite lines, or `null` if they are parallel
 * (including coincident). Uses the parametric form to handle all orientations.
 */
export function lineIntersection(a: Line, b: Line): Point | null {
  const dx1 = a.b.x - a.a.x;
  const dy1 = a.b.y - a.a.y;
  const dx2 = b.b.x - b.a.x;
  const dy2 = b.b.y - b.a.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPSILON) return null; // parallel or coincident
  const t =
    ((b.a.x - a.a.x) * dy2 - (b.a.y - a.a.y) * dx2) / denom;
  return {
    x: a.a.x + t * dx1,
    y: a.a.y + t * dy1,
  };
}

/**
 * Perpendicular distance from point `p` to the infinite line passing through
 * `line.a` and `line.b`.
 */
export function distanceToLine(p: Point, line: Line): number {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < EPSILON) return distance(p, line.a);
  return Math.abs((p.x - line.a.x) * dy - (p.y - line.a.y) * dx) / len;
}

// ─── Rectangle Operations ─────────────────────────────────────────────────────

/** Returns true if point `p` is inside or on the boundary of `rect`. */
export function rectContainsPoint(rect: Rectangle, p: Point): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  );
}

/** Returns true if two rectangles overlap (touching edges count). */
export function rectIntersects(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

/** Alias for rectIntersects. */
export const rectsOverlap = rectIntersects;

/** Smallest axis-aligned rectangle that contains both `a` and `b`. */
export function rectUnion(a: Rectangle, b: Rectangle): Rectangle {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/** Intersection of two rectangles, or `null` if they do not overlap. */
export function rectIntersection(a: Rectangle, b: Rectangle): Rectangle | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right < x || bottom < y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** Area of a rectangle. */
export function rectArea(rect: Rectangle): number {
  return rect.width * rect.height;
}

/** Perimeter of a rectangle: 2*(w+h). */
export function rectPerimeter(rect: Rectangle): number {
  return 2 * (rect.width + rect.height);
}

/** Centre point of a rectangle. */
export function rectCenter(rect: Rectangle): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// ─── Circle Operations ────────────────────────────────────────────────────────

/** Area of a circle: π r². */
export function circleArea(circle: Circle): number {
  return Math.PI * circle.radius * circle.radius;
}

/** Circumference (perimeter) of a circle: 2πr. */
export function circlePerimeter(circle: Circle): number {
  return 2 * Math.PI * circle.radius;
}

/** Returns true if point `p` is inside or on the boundary of `circle`. */
export function circleContainsPoint(circle: Circle, p: Point): boolean {
  const dx = p.x - circle.center.x;
  const dy = p.y - circle.center.y;
  return dx * dx + dy * dy <= circle.radius * circle.radius + EPSILON;
}

/** Returns true if two circles overlap (touching circles count). */
export function circlesIntersect(a: Circle, b: Circle): boolean {
  const dx = b.center.x - a.center.x;
  const dy = b.center.y - a.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= a.radius + b.radius + EPSILON;
}

/** Intersection point(s) of a circle with an infinite line. */
export function circleLineIntersection(circle: Circle, line: Line): Point[] {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const fx = line.a.x - circle.center.x;
  const fy = line.a.y - circle.center.y;

  const aa = dx * dx + dy * dy;
  if (aa < EPSILON) return [];

  const bb = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - circle.radius * circle.radius;
  let discriminant = bb * bb - 4 * aa * cc;

  if (discriminant < -EPSILON) return [];
  if (discriminant < 0) discriminant = 0;

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-bb - sqrtD) / (2 * aa);
  const t2 = (-bb + sqrtD) / (2 * aa);

  if (Math.abs(discriminant) < EPSILON) {
    return [interpolateLine(line, t1)];
  }
  return [interpolateLine(line, t1), interpolateLine(line, t2)];
}

// ─── Polygon Operations ───────────────────────────────────────────────────────

/**
 * Area of a polygon using the Shoelace formula (always unsigned).
 * Returns 0 for degenerate polygons with fewer than 3 vertices.
 */
export function polygonArea(polygon: Polygon): number {
  const pts = polygon.vertices;
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const j = (i + 1) % n;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

/** Perimeter of a polygon (sum of all edge lengths, including closing edge). */
export function polygonPerimeter(polygon: Polygon): number {
  const pts = polygon.vertices;
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    total += distance(pts[i], pts[(i + 1) % n]);
  }
  return total;
}

/**
 * Returns true if point `p` is inside `polygon` using the ray-casting algorithm.
 */
export function polygonContainsPoint(polygon: Polygon, p: Point): boolean {
  const pts = polygon.vertices;
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersects =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Centroid of a polygon. */
export function polygonCentroid(polygon: Polygon): Point {
  const pts = polygon.vertices;
  if (pts.length === 0) return { x: 0, y: 0 };

  if (pts.length < 3) {
    let sx = 0;
    let sy = 0;
    for (const pt of pts) {
      sx += pt.x;
      sy += pt.y;
    }
    return { x: sx / pts.length, y: sy / pts.length };
  }

  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    area += cross;
    cx += (pts[i].x + pts[j].x) * cross;
    cy += (pts[i].y + pts[j].y) * cross;
  }
  area /= 2;

  if (Math.abs(area) < EPSILON) {
    let sx = 0;
    let sy = 0;
    for (const pt of pts) {
      sx += pt.x;
      sy += pt.y;
    }
    return { x: sx / pts.length, y: sy / pts.length };
  }

  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** Convex hull of a set of points (Graham scan, CCW order). */
export function convexHull(points: Point[]): Point[] {
  if (points.length <= 1) return points.map((p) => ({ ...p }));

  let pivot = points[0];
  for (const p of points) {
    if (p.y < pivot.y || (p.y === pivot.y && p.x < pivot.x)) pivot = p;
  }

  const sorted = points
    .filter((p) => p !== pivot)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      if (Math.abs(angleA - angleB) > EPSILON) return angleA - angleB;
      return distance(pivot, a) - distance(pivot, b);
    });

  const hull: Point[] = [pivot];
  for (const p of sorted) {
    while (hull.length >= 2) {
      const o = hull[hull.length - 2];
      const aa = hull[hull.length - 1];
      const cross = (aa.x - o.x) * (p.y - o.y) - (aa.y - o.y) * (p.x - o.x);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }

  return hull;
}
