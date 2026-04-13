// @ts-check
// ─── Fibonacci Heap (Min-Heap) ──────────────────────────────────────────────
// A mergeable priority queue with amortised O(1) insert and merge, and
// amortised O(log n) extract-min.  Useful when merge operations dominate.

// ─── Internal Node ──────────────────────────────────────────────────────────

interface FibNode<T> {
  value: T;
  degree: number;
  parent: FibNode<T> | null;
  child: FibNode<T> | null;
  left: FibNode<T>;
  right: FibNode<T>;
  mark: boolean;
}

function createFibNode<T>(value: T): FibNode<T> {
  const node: Partial<FibNode<T>> = {
    value,
    degree: 0,
    parent: null,
    child: null,
    mark: false,
  };
  // Circular self-link
  (node as FibNode<T>).left = node as FibNode<T>;
  (node as FibNode<T>).right = node as FibNode<T>;
  return node as FibNode<T>;
}

// ─── Circular-list helpers ──────────────────────────────────────────────────

/** Insert `node` to the right of `anchor` in a circular list. */
function listInsert<T>(anchor: FibNode<T>, node: FibNode<T>): void {
  node.right = anchor.right;
  node.left = anchor;
  anchor.right.left = node;
  anchor.right = node;
}

/** Remove `node` from its circular list. */
function listRemove<T>(node: FibNode<T>): void {
  node.left.right = node.right;
  node.right.left = node.left;
  node.left = node;
  node.right = node;
}

/** Merge two circular lists. Returns the new head (or null). */
function listMerge<T>(a: FibNode<T> | null, b: FibNode<T> | null): FibNode<T> | null {
  if (a === null) return b;
  if (b === null) return a;
  // Splice b-list into a-list
  const aRight = a.right;
  const bLeft = b.left;
  a.right = b;
  b.left = a;
  aRight.left = bLeft;
  bLeft.right = aRight;
  return a;
}

/** Iterate all nodes in a circular list starting at `start`. */
function listToArray<T>(start: FibNode<T> | null): FibNode<T>[] {
  if (start === null) return [];
  const result: FibNode<T>[] = [];
  let cur = start;
  do {
    result.push(cur);
    cur = cur.right;
  } while (cur !== start);
  return result;
}

// ─── FibonacciHeap ──────────────────────────────────────────────────────────

const defaultCompare = (a: number, b: number): number => a - b;

export class FibonacciHeap<T> {
  readonly #compare: (a: T, b: T) => number;
  #min: FibNode<T> | null = null;
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
    const node = createFibNode(value);
    this.#min = listMerge(this.#min, node);
    if (this.#compare(node.value, this.#min!.value) < 0) {
      this.#min = node;
    }
    this.#size++;
  }

  findMin(): T | undefined {
    return this.#min?.value;
  }

  extractMin(): T | undefined {
    const z = this.#min;
    if (z === null) return undefined;

    // Add each child of z to root list
    if (z.child !== null) {
      const children = listToArray(z.child);
      for (const child of children) {
        child.parent = null;
      }
      this.#min = listMerge(this.#min, z.child);
      z.child = null;
    }

    // Remove z from root list
    if (z === z.right) {
      // z was the only root and had no children promoted? Actually children
      // may have been merged.  If z is still alone the heap is now empty.
      this.#min = null;
    } else {
      this.#min = z.right;
      listRemove(z);
      this.#consolidate();
    }

    this.#size--;
    return z.value;
  }

  merge(other: FibonacciHeap<T>): FibonacciHeap<T> {
    const merged = new FibonacciHeap<T>(this.#compare);
    merged.#min = listMerge(this.#min, other.#min);
    merged.#size = this.#size + other.#size;
    if (merged.#min !== null && this.#min !== null && other.#min !== null) {
      if (this.#compare(other.#min.value, this.#min.value) < 0) {
        merged.#min = other.#min;
      } else {
        merged.#min = this.#min;
      }
    }
    // Detach originals so they can't corrupt the merged heap
    this.#min = null;
    this.#size = 0;
    other.#min = null;
    other.#size = 0;
    return merged;
  }

  clear(): void {
    this.#min = null;
    this.#size = 0;
  }

  toArray(): T[] {
    const result: T[] = [];
    // Non-destructive: build a temporary heap copy by re-inserting values.
    const values = this.#collectValues(this.#min);
    const tmp = new FibonacciHeap<T>(this.#compare);
    for (const v of values) tmp.insert(v);
    while (!tmp.isEmpty) {
      result.push(tmp.extractMin()!);
    }
    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Recursively collect all values. */
  #collectValues(node: FibNode<T> | null): T[] {
    if (node === null) return [];
    const vals: T[] = [];
    const siblings = listToArray(node);
    for (const n of siblings) {
      vals.push(n.value);
      vals.push(...this.#collectValues(n.child));
    }
    return vals;
  }

  /** Consolidate root list so no two roots share the same degree. */
  #consolidate(): void {
    // Upper bound on max degree: floor(log_phi(n)) + 1 ≈ 1.44 * log2(n) + 1
    const maxDegree = Math.floor(Math.log(this.#size + 1) * 2.1) + 2;
    const A: (FibNode<T> | null)[] = new Array<FibNode<T> | null>(maxDegree + 1).fill(null);

    const roots = listToArray(this.#min!);
    for (const w of roots) {
      let x = w;
      let d = x.degree;
      while (A[d] !== null) {
        let y = A[d]!;
        if (this.#compare(x.value, y.value) > 0) {
          const tmp = x;
          x = y;
          y = tmp;
        }
        this.#link(y, x);
        A[d] = null;
        d++;
      }
      A[d] = x;
    }

    // Rebuild root list
    this.#min = null;
    for (const node of A) {
      if (node !== null) {
        node.left = node;
        node.right = node;
        this.#min = listMerge(this.#min, node);
        if (this.#compare(node.value, this.#min!.value) < 0) {
          this.#min = node;
        }
      }
    }
  }

  /** Make y a child of x. */
  #link(y: FibNode<T>, x: FibNode<T>): void {
    listRemove(y);
    y.parent = x;
    if (x.child === null) {
      x.child = y;
      y.left = y;
      y.right = y;
    } else {
      listInsert(x.child, y);
    }
    x.degree++;
    y.mark = false;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createFibonacciHeap<T>(compare?: (a: T, b: T) => number): FibonacciHeap<T> {
  return new FibonacciHeap<T>(compare);
}
