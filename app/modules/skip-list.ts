// ─── Skip List ───────────────────────────────────────────────────────────────
// Probabilistic sorted map with O(log n) expected search, insert, and delete.
// Configurable maximum level count and level-promotion probability.

// ─── Internal Node ───────────────────────────────────────────────────────────

interface SkipNode<K, V> {
  key: K;
  value: V;
  /** forward[i] is the next node pointer at level i. */
  forward: Array<SkipNode<K, V> | null>;
}

function makeNode<K, V>(key: K, value: V, level: number): SkipNode<K, V> {
  return {
    key,
    value,
    forward: new Array<SkipNode<K, V> | null>(level + 1).fill(null),
  };
}

// ─── Default Comparator ──────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ─── SkipList ────────────────────────────────────────────────────────────────

/**
 * Ordered map backed by a skip list.
 *
 * Keys are maintained in the order defined by `compareFn` (defaults to `< / >`).
 * All mutating operations and lookups run in O(log n) expected time.
 *
 * @example
 *   const sl = new SkipList<number, string>();
 *   sl.set(3, 'c');
 *   sl.set(1, 'a');
 *   sl.keys(); // [1, 3]
 *   sl.range(1, 2); // [[1, 'a']]
 */
export class SkipList<K, V> {
  #maxLevel: number;
  #probability: number;
  #compare: (a: K, b: K) => number;
  #head: SkipNode<K, V>;
  #level: number;   // current highest occupied level (0-based)
  #size: number;

  constructor(
    compareFn?: (a: K, b: K) => number,
    maxLevel?: number,
    probability?: number,
  ) {
    this.#maxLevel = maxLevel ?? 16;
    this.#probability = probability ?? 0.5;
    this.#compare = compareFn ?? defaultCompare;
    // Sentinel head — its key/value are never exposed.
    this.#head = makeNode<K, V>(
      undefined as unknown as K,
      undefined as unknown as V,
      this.#maxLevel - 1,
    );
    this.#level = 0;
    this.#size = 0;
  }

  /** Number of key-value pairs in the list. */
  get size(): number {
    return this.#size;
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  /** Random level for a new node (geometric distribution). */
  #randomLevel(): number {
    let lvl = 0;
    while (lvl < this.#maxLevel - 1 && Math.random() < this.#probability) {
      lvl++;
    }
    return lvl;
  }

  /**
   * Fill `update[i]` with the rightmost node at level i whose forward
   * pointer at i points past `key` (or is null).  Also returns the
   * candidate node at level 0 for the key.
   */
  #buildUpdate(key: K, update: Array<SkipNode<K, V>>): SkipNode<K, V> | null {
    let current: SkipNode<K, V> = this.#head;
    for (let i = this.#level; i >= 0; i--) {
      while (
        current.forward[i] !== null &&
        this.#compare(current.forward[i]!.key, key) < 0
      ) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }
    return current.forward[0];
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Insert or update the value for `key`.
   */
  set(key: K, value: V): void {
    const update: Array<SkipNode<K, V>> = new Array(this.#maxLevel);
    const candidate = this.#buildUpdate(key, update);

    if (candidate !== null && this.#compare(candidate.key, key) === 0) {
      // Key already exists — update in place.
      candidate.value = value;
      return;
    }

    const newLevel = this.#randomLevel();
    if (newLevel > this.#level) {
      for (let i = this.#level + 1; i <= newLevel; i++) {
        update[i] = this.#head;
      }
      this.#level = newLevel;
    }

    const node = makeNode(key, value, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      node.forward[i] = update[i].forward[i];
      update[i].forward[i] = node;
    }
    this.#size++;
  }

  /**
   * Retrieve the value for `key`, or `undefined` if absent.
   */
  get(key: K): V | undefined {
    let current: SkipNode<K, V> = this.#head;
    for (let i = this.#level; i >= 0; i--) {
      while (
        current.forward[i] !== null &&
        this.#compare(current.forward[i]!.key, key) < 0
      ) {
        current = current.forward[i]!;
      }
    }
    const candidate = current.forward[0];
    if (candidate !== null && this.#compare(candidate.key, key) === 0) {
      return candidate.value;
    }
    return undefined;
  }

  /**
   * Returns `true` if `key` is present in the list.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove the entry for `key`.
   * Returns `true` if the key was present, `false` otherwise.
   */
  delete(key: K): boolean {
    const update: Array<SkipNode<K, V>> = new Array(this.#maxLevel);
    const target = this.#buildUpdate(key, update);

    if (target === null || this.#compare(target.key, key) !== 0) {
      return false;
    }

    for (let i = 0; i <= this.#level; i++) {
      if (update[i].forward[i] !== target) break;
      update[i].forward[i] = target.forward[i];
    }

    // Shrink the effective level if the tallest node was removed.
    while (this.#level > 0 && this.#head.forward[this.#level] === null) {
      this.#level--;
    }

    this.#size--;
    return true;
  }

  /** Return all keys in sorted order. */
  keys(): K[] {
    const result: K[] = [];
    let node = this.#head.forward[0];
    while (node !== null) {
      result.push(node.key);
      node = node.forward[0];
    }
    return result;
  }

  /** Return all values in key-sorted order. */
  values(): V[] {
    const result: V[] = [];
    let node = this.#head.forward[0];
    while (node !== null) {
      result.push(node.value);
      node = node.forward[0];
    }
    return result;
  }

  /** Return all [key, value] entries in sorted key order. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    let node = this.#head.forward[0];
    while (node !== null) {
      result.push([node.key, node.value]);
      node = node.forward[0];
    }
    return result;
  }

  /**
   * Return all entries whose keys satisfy `lo <= key <= hi` (inclusive).
   */
  range(lo: K, hi: K): [K, V][] {
    const result: [K, V][] = [];
    // Descend to the first node with key >= lo.
    let current: SkipNode<K, V> = this.#head;
    for (let i = this.#level; i >= 0; i--) {
      while (
        current.forward[i] !== null &&
        this.#compare(current.forward[i]!.key, lo) < 0
      ) {
        current = current.forward[i]!;
      }
    }
    // Walk forward at level 0 collecting keys <= hi.
    let node = current.forward[0];
    while (node !== null && this.#compare(node.key, hi) <= 0) {
      result.push([node.key, node.value]);
      node = node.forward[0];
    }
    return result;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a new empty `SkipList`.
 *
 * @param compareFn  Optional key comparator.  Defaults to natural `< / >` order.
 */
export function createSkipList<K, V>(
  compareFn?: (a: K, b: K) => number,
): SkipList<K, V> {
  return new SkipList<K, V>(compareFn);
}
