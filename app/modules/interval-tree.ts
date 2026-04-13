// ─── Interval Tree ────────────────────────────────────────────────────────────
// Augmented BST that supports efficient interval overlap queries.
// All intervals are closed: [low, high].

// @ts-check

// ─── Types ────────────────────────────────────────────────────────────────────

/** A closed interval [low, high] with optional payload. */
export interface Interval {
  low: number;
  high: number;
  data?: unknown;
}

// ─── Internal node ────────────────────────────────────────────────────────────

interface Node {
  interval: Interval;
  /** Maximum high value in the subtree rooted here. */
  max: number;
  left: Node | null;
  right: Node | null;
}

function makeNode(interval: Interval): Node {
  return { interval, max: interval.high, left: null, right: null };
}

// ─── IntervalTree ─────────────────────────────────────────────────────────────

export class IntervalTree {
  #root: Node | null = null;
  #size: number = 0;

  // ── size ──────────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  // ── insert ────────────────────────────────────────────────────────────────

  insert(interval: Interval): void {
    this.#root = this.#insert(this.#root, interval);
    this.#size += 1;
  }

  #insert(node: Node | null, interval: Interval): Node {
    if (node === null) {
      return makeNode(interval);
    }

    // BST ordering by low endpoint; use high as tie-breaker
    if (
      interval.low < node.interval.low ||
      (interval.low === node.interval.low && interval.high < node.interval.high)
    ) {
      node.left = this.#insert(node.left, interval);
    } else {
      node.right = this.#insert(node.right, interval);
    }

    node.max = this.#computeMax(node);
    return node;
  }

  // ── remove ────────────────────────────────────────────────────────────────

  /**
   * Remove the first interval that matches (low, high, data) by reference
   * equality on data or value equality on low/high when data is undefined.
   * Returns true if an interval was removed.
   */
  remove(interval: Interval): boolean {
    const flag = { removed: false };
    this.#root = this.#remove(this.#root, interval, flag);
    if (flag.removed) this.#size -= 1;
    return flag.removed;
  }

  #remove(node: Node | null, target: Interval, flag: { removed: boolean }): Node | null {
    if (node === null) return null;

    if (this.#matches(node.interval, target) && !flag.removed) {
      flag.removed = true;
      if (node.left === null) return node.right;
      if (node.right === null) return node.left;

      // Find the in-order successor (smallest in right subtree)
      let successor = node.right;
      while (successor.left !== null) successor = successor.left;
      node.interval = successor.interval;
      node.right = this.#remove(node.right, successor.interval, { removed: false });
    } else {
      node.left = this.#remove(node.left, target, flag);
      if (!flag.removed) {
        node.right = this.#remove(node.right, target, flag);
      }
    }

    node.max = this.#computeMax(node);
    return node;
  }

  #matches(a: Interval, b: Interval): boolean {
    return a.low === b.low && a.high === b.high && a.data === b.data;
  }

  // ── search (point stabbing) ───────────────────────────────────────────────

  /** Return all intervals that contain the given point (closed: low ≤ point ≤ high). */
  search(point: number): Interval[] {
    const result: Interval[] = [];
    this.#searchPoint(this.#root, point, result);
    return result;
  }

  #searchPoint(node: Node | null, point: number, result: Interval[]): void {
    if (node === null) return;
    // If the maximum high in this subtree is less than the point, no match possible.
    if (node.max < point) return;

    this.#searchPoint(node.left, point, result);

    if (node.interval.low <= point && point <= node.interval.high) {
      result.push(node.interval);
    }

    // Only descend right if there's a chance of a match
    if (node.interval.low <= point) {
      this.#searchPoint(node.right, point, result);
    }
  }

  // ── overlap ───────────────────────────────────────────────────────────────

  /** Return all intervals overlapping the query range [low, high] (closed). */
  overlap(low: number, high: number): Interval[] {
    const result: Interval[] = [];
    this.#searchOverlap(this.#root, low, high, result);
    return result;
  }

  #searchOverlap(node: Node | null, low: number, high: number, result: Interval[]): void {
    if (node === null) return;
    if (node.max < low) return;

    this.#searchOverlap(node.left, low, high, result);

    if (node.interval.low <= high && node.interval.high >= low) {
      result.push(node.interval);
    }

    if (node.interval.low <= high) {
      this.#searchOverlap(node.right, low, high, result);
    }
  }

  // ── toArray ───────────────────────────────────────────────────────────────

  /** Return all intervals in in-order traversal (sorted by low, then high). */
  toArray(): Interval[] {
    const result: Interval[] = [];
    this.#inorder(this.#root, result);
    return result;
  }

  #inorder(node: Node | null, result: Interval[]): void {
    if (node === null) return;
    this.#inorder(node.left, result);
    result.push(node.interval);
    this.#inorder(node.right, result);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  #computeMax(node: Node): number {
    let m = node.interval.high;
    if (node.left !== null && node.left.max > m) m = node.left.max;
    if (node.right !== null && node.right.max > m) m = node.right.max;
    return m;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new, empty IntervalTree. */
export function createIntervalTree(): IntervalTree {
  return new IntervalTree();
}
