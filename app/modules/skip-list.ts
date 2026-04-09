// @ts-check
// ─── Skip List ──────────────────────────────────────────────────────────────
// Probabilistic sorted map with O(log n) expected search, insert, and delete.

// ─── Internal node ──────────────────────────────────────────────────────────

/** Maximum number of levels in the skip list. */
const MAX_LEVEL = 32;

/** Probability factor for level promotion (1/4 gives good balance). */
const P = 0.25;

interface SkipNode<K, V> {
  key: K;
  value: V;
  forward: Array<SkipNode<K, V> | null>;
}

function createNode<K, V>(
  key: K,
  value: V,
  level: number,
): SkipNode<K, V> {
  return { key, value, forward: new Array<SkipNode<K, V> | null>(level + 1).fill(null) };
}

// ─── Random level generator ─────────────────────────────────────────────────

function randomLevel(): number {
  let lvl = 0;
  while (lvl < MAX_LEVEL - 1 && Math.random() < P) {
    lvl++;
  }
  return lvl;
}

// ─── Default comparator ─────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── Class ──────────────────────────────────────────────────────────────────

/**
 * A skip list implementing a sorted map from keys to values.
 * Keys are ordered by the supplied comparator (defaults to `<` / `>`).
 */
export class SkipList<K, V> {
  private readonly _compare: (a: K, b: K) => number;
  private _head: SkipNode<K, V>;
  private _level: number;
  private _size: number;

  constructor(compare?: (a: K, b: K) => number) {
    this._compare = compare ?? defaultCompare;
    // Sentinel head node — key/value are never read.
    this._head = createNode<K, V>(undefined as unknown as K, undefined as unknown as V, MAX_LEVEL - 1);
    this._level = 0;
    this._size = 0;
  }

  /** Number of key-value pairs in the skip list. */
  get size(): number {
    return this._size;
  }

  /**
   * Insert or update a key-value pair.
   */
  set(key: K, value: V): void {
    const update: Array<SkipNode<K, V>> = new Array(MAX_LEVEL);
    let current = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (current.forward[i] !== null && this._compare(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const candidate = current.forward[0];
    if (candidate !== null && this._compare(candidate.key, key) === 0) {
      // Key already exists — update value.
      candidate.value = value;
      return;
    }

    const newLevel = randomLevel();
    if (newLevel > this._level) {
      for (let i = this._level + 1; i <= newLevel; i++) {
        update[i] = this._head;
      }
      this._level = newLevel;
    }

    const node = createNode(key, value, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      node.forward[i] = update[i].forward[i];
      update[i].forward[i] = node;
    }
    this._size++;
  }

  /**
   * Retrieve the value associated with `key`, or `undefined` if absent.
   */
  get(key: K): V | undefined {
    const node = this._findNode(key);
    return node ? node.value : undefined;
  }

  /**
   * Returns `true` if the skip list contains `key`.
   */
  has(key: K): boolean {
    return this._findNode(key) !== null;
  }

  /**
   * Remove the entry for `key`. Returns `true` if the key was present.
   */
  delete(key: K): boolean {
    const update: Array<SkipNode<K, V>> = new Array(MAX_LEVEL);
    let current = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (current.forward[i] !== null && this._compare(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const target = current.forward[0];
    if (target === null || this._compare(target.key, key) !== 0) {
      return false;
    }

    for (let i = 0; i <= this._level; i++) {
      if (update[i].forward[i] !== target) break;
      update[i].forward[i] = target.forward[i];
    }

    // Lower the level if we removed the tallest node.
    while (this._level > 0 && this._head.forward[this._level] === null) {
      this._level--;
    }

    this._size--;
    return true;
  }

  /** Return all keys in sorted order. */
  keys(): K[] {
    const result: K[] = [];
    let node = this._head.forward[0];
    while (node !== null) {
      result.push(node.key);
      node = node.forward[0];
    }
    return result;
  }

  /** Return all values in key-sorted order. */
  values(): V[] {
    const result: V[] = [];
    let node = this._head.forward[0];
    while (node !== null) {
      result.push(node.value);
      node = node.forward[0];
    }
    return result;
  }

  /** Return all entries as [key, value] pairs in sorted order. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    let node = this._head.forward[0];
    while (node !== null) {
      result.push([node.key, node.value]);
      node = node.forward[0];
    }
    return result;
  }

  /** Return the entry with the smallest key, or null if empty. */
  min(): [K, V] | null {
    const first = this._head.forward[0];
    return first ? [first.key, first.value] : null;
  }

  /** Return the entry with the largest key, or null if empty. */
  max(): [K, V] | null {
    let current = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (current.forward[i] !== null) {
        current = current.forward[i]!;
      }
    }
    return current === this._head ? null : [current.key, current.value];
  }

  /**
   * Return all entries whose keys satisfy `low <= key <= high` (inclusive).
   */
  range(low: K, high: K): [K, V][] {
    const result: [K, V][] = [];
    let current = this._head;

    // Descend to the first node with key >= low.
    for (let i = this._level; i >= 0; i--) {
      while (current.forward[i] !== null && this._compare(current.forward[i]!.key, low) < 0) {
        current = current.forward[i]!;
      }
    }

    // Walk forward at level 0 while key <= high.
    let node = current.forward[0];
    while (node !== null && this._compare(node.key, high) <= 0) {
      result.push([node.key, node.value]);
      node = node.forward[0];
    }

    return result;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private _findNode(key: K): SkipNode<K, V> | null {
    let current = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (current.forward[i] !== null && this._compare(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
    }
    const candidate = current.forward[0];
    if (candidate !== null && this._compare(candidate.key, key) === 0) {
      return candidate;
    }
    return null;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new empty SkipList.
 */
export function createSkipList<K, V>(
  compare?: (a: K, b: K) => number,
): SkipList<K, V> {
  return new SkipList(compare);
}
