// @ts-check
// ─── Line Sweep Algorithms ──────────────────────────────────────────────────
// Sweep-line based geometric algorithms: segment intersection, closest pair,
// and rectangle union area.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Intersection {
  point: Point;
  segments: [number, number];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EPS = 1e-9;

/** Cross product of vectors (b-a) and (c-a). */
function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Check if point q lies on segment pr (assuming collinearity). */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + EPS &&
    q.x >= Math.min(p.x, r.x) - EPS &&
    q.y <= Math.max(p.y, r.y) + EPS &&
    q.y >= Math.min(p.y, r.y) - EPS
  );
}

/**
 * Compute intersection point of two line segments, or null if they don't
 * intersect. Segments are defined by their endpoints.
 */
function segmentIntersection(s1: Segment, s2: Segment): Point | null {
  const p1: Point = { x: s1.x1, y: s1.y1 };
  const q1: Point = { x: s1.x2, y: s1.y2 };
  const p2: Point = { x: s2.x1, y: s2.y1 };
  const q2: Point = { x: s2.x2, y: s2.y2 };

  const d1 = cross(p2, q2, p1);
  const d2 = cross(p2, q2, q1);
  const d3 = cross(p1, q1, p2);
  const d4 = cross(p1, q1, q2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    // Proper intersection — compute the point.
    const t = d1 / (d1 - d2);
    return {
      x: p1.x + t * (q1.x - p1.x),
      y: p1.y + t * (q1.y - p1.y),
    };
  }

  // Check collinear / endpoint cases.
  if (Math.abs(d1) < EPS && onSegment(p2, p1, q2))
    return { x: p1.x, y: p1.y };
  if (Math.abs(d2) < EPS && onSegment(p2, q1, q2))
    return { x: q1.x, y: q1.y };
  if (Math.abs(d3) < EPS && onSegment(p1, p2, q1))
    return { x: p2.x, y: p2.y };
  if (Math.abs(d4) < EPS && onSegment(p1, q2, q1))
    return { x: q2.x, y: q2.y };

  return null;
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Find all pairwise intersections among the given segments.
 * Uses a sweep-line approach: events are segment endpoints sorted by x.
 * Active segments are checked for intersection when they overlap in x.
 *
 * Returns an array of intersections with the point and pair of segment indices.
 */
export function findIntersections(segments: Segment[]): Intersection[] {
  const results: Intersection[] = [];
  const n = segments.length;

  // Events: (x, type, segIdx)  type: 0=start 1=end
  interface SweepEvent {
    x: number;
    type: number; // 0 = start, 1 = end
    idx: number;
  }

  const events: SweepEvent[] = [];
  for (let i = 0; i < n; i++) {
    const s = segments[i];
    const lx = Math.min(s.x1, s.x2);
    const rx = Math.max(s.x1, s.x2);
    events.push({ x: lx, type: 0, idx: i });
    events.push({ x: rx, type: 1, idx: i });
  }

  events.sort((a, b) => a.x - b.x || a.type - b.type);

  // Active set of segment indices.
  const active = new Set<number>();

  for (const ev of events) {
    if (ev.type === 0) {
      // Start: test against all currently active segments.
      for (const j of active) {
        const pt = segmentIntersection(segments[ev.idx], segments[j]);
        if (pt) {
          const i1 = Math.min(ev.idx, j);
          const i2 = Math.max(ev.idx, j);
          results.push({ point: pt, segments: [i1, i2] });
        }
      }
      active.add(ev.idx);
    } else {
      active.delete(ev.idx);
    }
  }

  return results;
}

/**
 * Find the closest pair of points using a divide-and-conquer / sweep approach.
 * Returns the two points and their distance.
 */
export function closestPair(points: Point[]): {
  p1: Point;
  p2: Point;
  distance: number;
} {
  const n = points.length;
  if (n < 2) {
    throw new Error('Need at least 2 points');
  }

  // Sort by x, then y.
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);

  let bestDist = Infinity;
  let bestP1 = sorted[0];
  let bestP2 = sorted[1];
  bestDist = dist(bestP1, bestP2);

  // Strip-based sweep: maintain a "strip" of candidates sorted by y.
  const strip: Point[] = [];

  for (let i = 0; i < n; i++) {
    // Remove points too far left.
    while (strip.length > 0 && sorted[i].x - strip[0].x > bestDist) {
      strip.shift();
    }

    // Compare with strip points (at most O(1) amortized due to y-distance bound).
    for (let j = strip.length - 1; j >= 0; j--) {
      const dy = sorted[i].y - strip[j].y;
      if (Math.abs(dy) > bestDist) continue;

      const d = dist(sorted[i], strip[j]);
      if (d < bestDist) {
        bestDist = d;
        bestP1 = strip[j];
        bestP2 = sorted[i];
      }
    }

    // Insert into strip maintaining y-sorted order (insertion sort).
    let insertAt = strip.length;
    while (insertAt > 0 && strip[insertAt - 1].y > sorted[i].y) {
      insertAt--;
    }
    strip.splice(insertAt, 0, sorted[i]);
  }

  return { p1: bestP1, p2: bestP2, distance: bestDist };
}

/**
 * Compute the total area covered by the union of axis-aligned rectangles.
 * Each rectangle is defined by its lower-left (x1,y1) and upper-right (x2,y2).
 * Uses coordinate compression + sweep line.
 */
export function rectangleUnionArea(
  rects: { x1: number; y1: number; x2: number; y2: number }[],
): number {
  if (rects.length === 0) return 0;

  // Collect unique y-coordinates.
  const ys = new Set<number>();
  for (const r of rects) {
    ys.add(r.y1);
    ys.add(r.y2);
  }
  const yCoords = [...ys].sort((a, b) => a - b);
  const yIndex = new Map<number, number>();
  for (let i = 0; i < yCoords.length; i++) {
    yIndex.set(yCoords[i], i);
  }

  // Events: (x, type, y1idx, y2idx)  type: 0=start 1=end
  interface RectEvent {
    x: number;
    type: number;
    y1: number;
    y2: number;
  }

  const events: RectEvent[] = [];
  for (const r of rects) {
    events.push({ x: r.x1, type: 0, y1: yIndex.get(r.y1)!, y2: yIndex.get(r.y2)! });
    events.push({ x: r.x2, type: 1, y1: yIndex.get(r.y1)!, y2: yIndex.get(r.y2)! });
  }
  events.sort((a, b) => a.x - b.x || a.type - b.type);

  // Count array: how many rectangles cover each y-interval.
  const cnt = new Array(yCoords.length - 1).fill(0);

  /** Compute total y-length covered (count > 0). */
  function coveredLength(): number {
    let total = 0;
    for (let i = 0; i < cnt.length; i++) {
      if (cnt[i] > 0) {
        total += yCoords[i + 1] - yCoords[i];
      }
    }
    return total;
  }

  let area = 0;
  let prevX = events[0].x;

  for (const ev of events) {
    // Add area swept since last x.
    area += (ev.x - prevX) * coveredLength();
    prevX = ev.x;

    const delta = ev.type === 0 ? 1 : -1;
    for (let i = ev.y1; i < ev.y2; i++) {
      cnt[i] += delta;
    }
  }

  return area;
}
