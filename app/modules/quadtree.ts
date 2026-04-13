// @ts-check
// ─── Quadtree ───────────────────────────────────────────────────────────────
// 2D spatial partitioning tree for efficient point queries.

// ─── Types ──────────────────────────────────────────────────────────────────

/** A point in 2D space with optional associated data. */
export interface Point2D {
  x: number;
  y: number;
  data?: unknown;
}

/** An axis-aligned bounding rectangle. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function containsPoint(b: Bounds, p: Point2D): boolean {
  return (
    p.x >= b.x &&
    p.x <= b.x + b.width &&
    p.y >= b.y &&
    p.y <= b.y + b.height
  );
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x > b.x + b.width ||
    a.x + a.width < b.x ||
    a.y > b.y + b.height ||
    a.y + a.height < b.y
  );
}

// ─── Quadtree Class ─────────────────────────────────────────────────────────

/** 2D quadtree for spatial partitioning. */
export class Quadtree {
  private readonly _bounds: Bounds;
  private readonly _capacity: number;
  private _points: Point2D[] = [];
  private _divided = false;
  private _nw: Quadtree | null = null;
  private _ne: Quadtree | null = null;
  private _sw: Quadtree | null = null;
  private _se: Quadtree | null = null;
  private _size = 0;

  constructor(bounds: Bounds, capacity = 4) {
    this._bounds = { ...bounds };
    this._capacity = capacity;
  }

  // ── public getters ──────────────────────────────────────────────────────

  /** Total number of points stored in this subtree. */
  get size(): number {
    return this._size;
  }

  /** The bounding rectangle. */
  get bounds(): Bounds {
    return { ...this._bounds };
  }

  // ── public methods ──────────────────────────────────────────────────────

  /** Insert a point. Returns false if the point is outside bounds. */
  insert(point: Point2D): boolean {
    if (!containsPoint(this._bounds, point)) return false;

    if (!this._divided && this._points.length < this._capacity) {
      this._points.push(point);
      this._size++;
      return true;
    }

    if (!this._divided) {
      this._subdivide();
    }

    if (
      this._nw!.insert(point) ||
      this._ne!.insert(point) ||
      this._sw!.insert(point) ||
      this._se!.insert(point)
    ) {
      this._size++;
      return true;
    }

    /* istanbul ignore next — should not reach */
    return false;
  }

  /** Return all points within the given rectangular range. */
  query(range: Bounds): Point2D[] {
    const found: Point2D[] = [];
    this._query(range, found);
    return found;
  }

  /** Return all points within a circle centered at (cx, cy) with `radius`. */
  queryRadius(cx: number, cy: number, radius: number): Point2D[] {
    // Start with a bounding-box query, then filter by distance.
    const rangeBounds: Bounds = {
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
    };
    const candidates = this.query(rangeBounds);
    const r2 = radius * radius;
    return candidates.filter((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return dx * dx + dy * dy <= r2;
    });
  }

  /** Check whether a point with the same x and y coordinates exists. */
  has(point: Point2D): boolean {
    if (!containsPoint(this._bounds, point)) return false;

    for (const p of this._points) {
      if (p.x === point.x && p.y === point.y) return true;
    }

    if (this._divided) {
      return (
        this._nw!.has(point) ||
        this._ne!.has(point) ||
        this._sw!.has(point) ||
        this._se!.has(point)
      );
    }

    return false;
  }

  /** Remove all points and collapse subdivisions. */
  clear(): void {
    this._points = [];
    this._size = 0;
    this._divided = false;
    this._nw = null;
    this._ne = null;
    this._sw = null;
    this._se = null;
  }

  /** Return all points stored in the tree as a flat array. */
  toArray(): Point2D[] {
    const result: Point2D[] = [];
    this._collect(result);
    return result;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private _subdivide(): void {
    const { x, y, width, height } = this._bounds;
    const hw = width / 2;
    const hh = height / 2;

    this._nw = new Quadtree({ x, y, width: hw, height: hh }, this._capacity);
    this._ne = new Quadtree({ x: x + hw, y, width: hw, height: hh }, this._capacity);
    this._sw = new Quadtree({ x, y: y + hh, width: hw, height: hh }, this._capacity);
    this._se = new Quadtree({ x: x + hw, y: y + hh, width: hw, height: hh }, this._capacity);

    // Re-insert existing points into children.
    for (const p of this._points) {
      this._nw.insert(p) ||
        this._ne.insert(p) ||
        this._sw.insert(p) ||
        this._se.insert(p);
    }
    this._points = [];
    this._divided = true;
  }

  private _query(range: Bounds, found: Point2D[]): void {
    if (!boundsIntersect(this._bounds, range)) return;

    for (const p of this._points) {
      if (containsPoint(range, p)) found.push(p);
    }

    if (this._divided) {
      this._nw!._query(range, found);
      this._ne!._query(range, found);
      this._sw!._query(range, found);
      this._se!._query(range, found);
    }
  }

  private _collect(result: Point2D[]): void {
    for (const p of this._points) result.push(p);
    if (this._divided) {
      this._nw!._collect(result);
      this._ne!._collect(result);
      this._sw!._collect(result);
      this._se!._collect(result);
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a new Quadtree with the given bounds and capacity. */
export function createQuadtree(bounds: Bounds, capacity?: number): Quadtree {
  return new Quadtree(bounds, capacity);
}
