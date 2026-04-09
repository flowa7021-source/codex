// @ts-check
// ─── Binomial Heap (Min-Heap) ───────────────────────────────────────────────
// A mergeable priority queue built from binomial trees.  All core operations
// run in O(log n) time.

// ─── Internal Node ──────────────────────────────────────────────────────────

interface BinNode<T> {
  value: T;
  degree: number;
  parent: BinNode<T> | null;
  child: BinNode<T> | null;
  sibling: BinNode<T> | null;
}

function createBinNode<T>(value: T): BinNode<T> {
  return { value, degree: 0, parent: null, child: null, sibling: null };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultCompare = (a: number, b: number): number => a - b;

/** Link tree rooted at y as a child of tree rooted at z (same degree). */
function linkTrees<T>(y: BinNode<T>, z: BinNode<T>): void {
  y.parent = z;
  y.sibling = z.child;
  z.child = y;
  z.degree++;
}

/**
 * Merge two sorted-by-degree root lists into one sorted-by-degree list.
 * Neither input list is modified beyond pointer reuse (they share nodes).
 */
function mergeRootLists<T>(
  h1: BinNode<T> | null,
  h2: BinNode<T> | null,
): BinNode<T> | null {
  if (h1 === null) return h2;
  if (h2 === null) return h1;

  let head: BinNode<T>;
  let tail: BinNode<T>;
  let p1: BinNode<T> | null = h1;
  let p2: BinNode<T> | null = h2;

  if (p1.degree <= p2.degree) {
    head = p1;
    p1 = p1.sibling;
  } else {
    head = p2;
    p2 = p2.sibling;
  }
  tail = head;

  while (p1 !== null && p2 !== null) {
    if (p1.degree <= p2.degree) {
      tail.sibling = p1;
      p1 = p1.sibling;
    } else {
      tail.sibling = p2;
      p2 = p2.sibling;
    }
    tail = tail.sibling!;
  }

  tail.sibling = p1 ?? p2;
  return head;
}

/**
 * Union two binomial heaps (given as root-list heads) into a single heap.
 * Returns the new root-list head.
 */
function unionHeaps<T>(
  h1: BinNode<T> | null,
  h2: BinNode<T> | null,
  compare: (a: T, b: T) => number,
): BinNode<T> | null {
  let head = mergeRootLists(h1, h2);
  if (head === null) return null;

  let prev: BinNode<T> | null = null;
  let curr: BinNode<T> | null = head;
  let next: BinNode<T> | null = curr.sibling;

  while (next !== null) {
    if (
      curr.degree !== next.degree ||
      (next.sibling !== null && next.sibling.degree === curr.degree)
    ) {
      // Case 1 & 2: move on
      prev = curr;
      curr = next;
    } else if (compare(curr.value, next.value) <= 0) {
      // Case 3: curr is smaller — link next under curr
      curr.sibling = next.sibling;
      linkTrees(next, curr);
    } else {
      // Case 4: next is smaller — link curr under next
      if (prev === null) {
        head = next;
      } else {
        prev.sibling = next;
      }
      linkTrees(curr, next);
      curr = next;
    }
    next = curr.sibling;
  }

  return head;
}

// ─── BinomialHeap ───────────────────────────────────────────────────────────

export class BinomialHeap<T> {
  readonly #compare: (a: T, b: T) => number;
  #head: BinNode<T> | null = null;
  #size = 0;

  constructor(compare?: (a: T, b: T) => number) {
    this.#compare = (compare ?? defaultCompare) as (a: T, b: T) => number;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  get isEmpty(): boolean {
    return this.#size === 0;
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  insert(value: T): void {
    const node = createBinNode(value);
    this.#head = unionHeaps(this.#head, node, this.#compare);
    this.#size++;
  }

  findMin(): T | undefined {
    if (this.#head === null) return undefined;
    let min = this.#head;
    let cur: BinNode<T> | null = this.#head.sibling;
    while (cur !== null) {
      if (this.#compare(cur.value, min.value) < 0) min = cur;
      cur = cur.sibling;
    }
    return min.value;
  }

  extractMin(): T | undefined {
    if (this.#head === null) return undefined;

    // Find the tree with minimum root
    let minPrev: BinNode<T> | null = null;
    let min = this.#head;
    let prev: BinNode<T> | null = null;
    let cur: BinNode<T> | null = this.#head;
    while (cur !== null) {
      if (this.#compare(cur.value, min.value) < 0) {
        min = cur;
        minPrev = prev;
      }
      prev = cur;
      cur = cur.sibling;
    }

    // Remove min's tree from root list
    if (minPrev === null) {
      this.#head = min.sibling;
    } else {
      minPrev.sibling = min.sibling;
    }

    // Reverse children of min to form a new root list
    let child = min.child;
    let newHead: BinNode<T> | null = null;
    while (child !== null) {
      const next = child.sibling;
      child.sibling = newHead;
      child.parent = null;
      newHead = child;
      child = next;
    }

    this.#head = unionHeaps(this.#head, newHead, this.#compare);
    this.#size--;
    return min.value;
  }

  merge(other: BinomialHeap<T>): BinomialHeap<T> {
    const merged = new BinomialHeap<T>(this.#compare);
    merged.#head = unionHeaps(this.#head, other.#head, this.#compare);
    merged.#size = this.#size + other.#size;
    // Detach originals
    this.#head = null;
    this.#size = 0;
    other.#head = null;
    other.#size = 0;
    return merged;
  }

  clear(): void {
    this.#head = null;
    this.#size = 0;
  }

  toArray(): T[] {
    // Non-destructive sorted extraction via a temporary heap.
    const values = this.#collectValues(this.#head);
    const tmp = new BinomialHeap<T>(this.#compare);
    for (const v of values) tmp.insert(v);
    const result: T[] = [];
    while (!tmp.isEmpty) {
      result.push(tmp.extractMin()!);
    }
    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  #collectValues(node: BinNode<T> | null): T[] {
    const vals: T[] = [];
    let cur = node;
    while (cur !== null) {
      vals.push(cur.value);
      vals.push(...this.#collectValues(cur.child));
      cur = cur.sibling;
    }
    return vals;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createBinomialHeap<T>(compare?: (a: T, b: T) => number): BinomialHeap<T> {
  return new BinomialHeap<T>(compare);
}
