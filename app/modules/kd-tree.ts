// @ts-check
// ─── KD-Tree ────────────────────────────────────────────────────────────────
// k-dimensional tree for efficient spatial queries (nearest neighbor, range).

// ─── Types ──────────────────────────────────────────────────────────────────

/** A point in k-dimensional space with optional associated data. */
export interface KDPoint {
  coords: number[];
  data?: unknown;
}

// ─── Internal Node ──────────────────────────────────────────────────────────

interface KDNode {
  point: KDPoint;
  left: KDNode | null;
  right: KDNode | null;
  depth: number;
}

// ─── Bounded Priority Queue (max-heap by distance) ──────────────────────────

class BoundedPQ {
  private items: { point: KDPoint; dist: number }[] = [];
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  get length(): number {
    return this.items.length;
  }

  /** Worst (largest) distance currently stored. */
  worstDist(): number {
    if (this.items.length === 0) return Infinity;
    return this.items[0].dist;
  }

  push(point: KDPoint, dist: number): void {
    if (this.items.length < this.max) {
      this.items.push({ point, dist });
      this._bubbleUp(this.items.length - 1);
    } else if (dist < this.items[0].dist) {
      this.items[0] = { point, dist };
      this._sinkDown(0);
    }
  }

  /** Return results sorted closest-first. */
  drain(): KDPoint[] {
    return this.items
      .sort((a, b) => a.dist - b.dist)
      .map((e) => e.point);
  }

  // ── max-heap helpers ────────────────────────────────────────────────────

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[i].dist <= this.items[parent].dist) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.items.length;
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.items[left].dist > this.items[largest].dist) largest = left;
      if (right < n && this.items[right].dist > this.items[largest].dist) largest = right;
      if (largest === i) break;
      [this.items[i], this.items[largest]] = [this.items[largest], this.items[i]];
      i = largest;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

// ─── KDTree Class ───────────────────────────────────────────────────────────

/** k-dimensional tree for spatial queries. */
export class KDTree {
  private root: KDNode | null = null;
  private _size = 0;
  private readonly _k: number;

  constructor(points: KDPoint[], k?: number) {
    if (points.length === 0) {
      this._k = k ?? 0;
      return;
    }
    this._k = k ?? points[0].coords.length;
    this.root = this._build(points.slice(), 0);
    this._size = points.length;
  }

  // ── public getters ──────────────────────────────────────────────────────

  /** Number of points stored. */
  get size(): number {
    return this._size;
  }

  /** Number of dimensions. */
  get dimensions(): number {
    return this._k;
  }

  // ── public methods ──────────────────────────────────────────────────────

  /** Return the `count` nearest neighbors of `target`, closest first. */
  nearest(target: number[], count = 1): KDPoint[] {
    if (!this.root || count <= 0) return [];
    const pq = new BoundedPQ(count);
    this._nearestSearch(this.root, target, pq);
    return pq.drain();
  }

  /** Return all points within the axis-aligned bounding box [min, max]. */
  rangeSearch(min: number[], max: number[]): KDPoint[] {
    const results: KDPoint[] = [];
    this._rangeSearch(this.root, min, max, 0, results);
    return results;
  }

  /** Insert a new point into the tree. */
  insert(point: KDPoint): void {
    if (this._k === 0) {
      // Tree was constructed empty without k — infer from first insert.
      (this as unknown as { _k: number })._k = point.coords.length;
    }
    this.root = this._insertNode(this.root, point, 0);
    this._size++;
  }

  /** Return all points as an array (in-order traversal). */
  toArray(): KDPoint[] {
    const result: KDPoint[] = [];
    this._collect(this.root, result);
    return result;
  }

  // ── private: tree construction ──────────────────────────────────────────

  private _build(points: KDPoint[], depth: number): KDNode | null {
    if (points.length === 0) return null;

    const axis = depth % this._k;
    points.sort((a, b) => a.coords[axis] - b.coords[axis]);
    const mid = points.length >> 1;

    return {
      point: points[mid],
      left: this._build(points.slice(0, mid), depth + 1),
      right: this._build(points.slice(mid + 1), depth + 1),
      depth,
    };
  }

  // ── private: nearest neighbor ───────────────────────────────────────────

  private _nearestSearch(node: KDNode | null, target: number[], pq: BoundedPQ): void {
    if (!node) return;

    const dist = squaredDistance(node.point.coords, target);
    pq.push(node.point, dist);

    const axis = node.depth % this._k;
    const diff = target[axis] - node.point.coords[axis];
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;

    this._nearestSearch(first, target, pq);

    // Only explore the other subtree if the splitting plane is closer than
    // the current worst distance.
    if (diff * diff < pq.worstDist() || pq.length < pq['max']) {
      this._nearestSearch(second, target, pq);
    }
  }

  // ── private: range search ───────────────────────────────────────────────

  private _rangeSearch(
    node: KDNode | null,
    min: number[],
    max: number[],
    depth: number,
    results: KDPoint[],
  ): void {
    if (!node) return;

    // Check whether the node's point lies inside the bounding box.
    let inside = true;
    for (let i = 0; i < this._k; i++) {
      if (node.point.coords[i] < min[i] || node.point.coords[i] > max[i]) {
        inside = false;
        break;
      }
    }
    if (inside) results.push(node.point);

    const axis = depth % this._k;
    if (min[axis] <= node.point.coords[axis]) {
      this._rangeSearch(node.left, min, max, depth + 1, results);
    }
    if (max[axis] >= node.point.coords[axis]) {
      this._rangeSearch(node.right, min, max, depth + 1, results);
    }
  }

  // ── private: insertion ──────────────────────────────────────────────────

  private _insertNode(node: KDNode | null, point: KDPoint, depth: number): KDNode {
    if (!node) return { point, left: null, right: null, depth };

    const axis = depth % this._k;
    if (point.coords[axis] < node.point.coords[axis]) {
      node.left = this._insertNode(node.left, point, depth + 1);
    } else {
      node.right = this._insertNode(node.right, point, depth + 1);
    }
    return node;
  }

  // ── private: traversal ──────────────────────────────────────────────────

  private _collect(node: KDNode | null, result: KDPoint[]): void {
    if (!node) return;
    this._collect(node.left, result);
    result.push(node.point);
    this._collect(node.right, result);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a new KDTree from an array of points. */
export function createKDTree(points: KDPoint[], k?: number): KDTree {
  return new KDTree(points, k);
}
