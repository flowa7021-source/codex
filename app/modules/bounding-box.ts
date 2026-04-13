// @ts-check
// ─── Bounding Box (AABB) Utilities ───────────────────────────────────────────
// Axis-aligned bounding box operations.
// No browser APIs — pure math.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─── Construction ────────────────────────────────────────────────────────────

/**
 * Create an AABB from a top-left corner plus width/height.
 * Negative dimensions are handled by normalising min/max.
 */
export function createAABB(x: number, y: number, w: number, h: number): AABB {
  return {
    minX: w >= 0 ? x : x + w,
    minY: h >= 0 ? y : y + h,
    maxX: w >= 0 ? x + w : x,
    maxY: h >= 0 ? y + h : y,
  };
}

/**
 * Compute the tightest AABB that contains all given points.
 * Returns a degenerate box (all zeros) for an empty array.
 */
export function fromPoints(points: { x: number; y: number }[]): AABB {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** AABB that exactly bounds a circle. */
export function fromCircle(center: { x: number; y: number }, radius: number): AABB {
  return {
    minX: center.x - radius,
    minY: center.y - radius,
    maxX: center.x + radius,
    maxY: center.y + radius,
  };
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

/** Width of the box. */
export function width(box: AABB): number {
  return box.maxX - box.minX;
}

/** Height of the box. */
export function height(box: AABB): number {
  return box.maxY - box.minY;
}

/** Area of the box. */
export function area(box: AABB): number {
  return width(box) * height(box);
}

/** Centre point of the box. */
export function center(box: AABB): { x: number; y: number } {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  };
}

// ─── Spatial tests ───────────────────────────────────────────────────────────

/** Returns true if the point lies within (or on the boundary of) the box. */
export function contains(box: AABB, point: { x: number; y: number }): boolean {
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.y >= box.minY &&
    point.y <= box.maxY
  );
}

/** Returns true if two AABBs overlap (touching boundaries count). */
export function intersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Returns the intersection AABB of two boxes, or null if they do not overlap.
 * Touching boundaries produce a degenerate (zero-area) box.
 */
export function intersection(a: AABB, b: AABB): AABB | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/** Smallest AABB that contains both boxes. */
export function union(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

// ─── Transformations ─────────────────────────────────────────────────────────

/** Expand (positive) or shrink (negative) the box by `amount` on every side. */
export function expand(box: AABB, amount: number): AABB {
  return {
    minX: box.minX - amount,
    minY: box.minY - amount,
    maxX: box.maxX + amount,
    maxY: box.maxY + amount,
  };
}

/** Translate the box by (dx, dy). */
export function translate(box: AABB, dx: number, dy: number): AABB {
  return {
    minX: box.minX + dx,
    minY: box.minY + dy,
    maxX: box.maxX + dx,
    maxY: box.maxY + dy,
  };
}

/**
 * Scale the box by `factor` relative to an optional origin (default: box centre).
 */
export function scale(
  box: AABB,
  factor: number,
  origin?: { x: number; y: number },
): AABB {
  const ox = origin !== undefined ? origin.x : (box.minX + box.maxX) / 2;
  const oy = origin !== undefined ? origin.y : (box.minY + box.maxY) / 2;
  return {
    minX: ox + (box.minX - ox) * factor,
    minY: oy + (box.minY - oy) * factor,
    maxX: ox + (box.maxX - ox) * factor,
    maxY: oy + (box.maxY - oy) * factor,
  };
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/** Convert to an {x, y, width, height} rectangle. */
export function toRect(box: AABB): { x: number; y: number; width: number; height: number } {
  return {
    x: box.minX,
    y: box.minY,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
  };
}
