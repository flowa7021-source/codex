// @ts-check
// ─── Sparse Array ───────────────────────────────────────────────────────────
// A sparse array backed by a Map, providing efficient storage for arrays
// with large gaps between populated indices.

// ─── Public API ──────────────────────────────────────────────────────────────

/** A sparse array backed by a Map for efficient gap-heavy storage. */
export class SparseArray<T> {
  private _map: Map<number, T>;

  constructor() {
    this._map = new Map();
  }

  /** Set a value at the given index. */
  set(index: number, value: T): void {
    this._map.set(index, value);
  }

  /** Get the value at the given index, or undefined if not set. */
  get(index: number): T | undefined {
    return this._map.get(index);
  }

  /** Check whether a value exists at the given index. */
  has(index: number): boolean {
    return this._map.has(index);
  }

  /** Delete the value at the given index. Returns true if the element existed. */
  delete(index: number): boolean {
    return this._map.delete(index);
  }

  /** Number of set elements. */
  get size(): number {
    return this._map.size;
  }

  /** Density: size / (maxIndex + 1), or 0 if empty. */
  get density(): number {
    if (this._map.size === 0) return 0;
    const maxIndex = Math.max(...this._map.keys());
    return this._map.size / (maxIndex + 1);
  }

  /** Sorted list of set indices. */
  indices(): number[] {
    return [...this._map.keys()].sort((a, b) => a - b);
  }

  /** Values in index order. */
  values(): T[] {
    return this.indices().map((i) => this._map.get(i)!);
  }

  /** [index, value] pairs in index order. */
  entries(): [number, T][] {
    return this.indices().map((i) => [i, this._map.get(i)!]);
  }

  /** Iterate over entries in index order. */
  forEach(fn: (value: T, index: number) => void): void {
    for (const i of this.indices()) {
      fn(this._map.get(i)!, i);
    }
  }

  /** Map each value to a new SparseArray. */
  map<U>(fn: (value: T, index: number) => U): SparseArray<U> {
    const result = new SparseArray<U>();
    for (const i of this.indices()) {
      result.set(i, fn(this._map.get(i)!, i));
    }
    return result;
  }

  /** Filter entries into a new SparseArray. */
  filter(fn: (value: T, index: number) => boolean): SparseArray<T> {
    const result = new SparseArray<T>();
    for (const i of this.indices()) {
      const value = this._map.get(i)!;
      if (fn(value, i)) {
        result.set(i, value);
      }
    }
    return result;
  }

  /** Remove all entries. */
  clear(): void {
    this._map.clear();
  }

  /** Convert to a dense array with gaps as undefined. */
  toArray(): (T | undefined)[] {
    if (this._map.size === 0) return [];
    const maxIndex = Math.max(...this._map.keys());
    const result: (T | undefined)[] = new Array(maxIndex + 1).fill(undefined);
    for (const [i, v] of this._map) {
      result[i] = v;
    }
    return result;
  }
}

/** Factory function to create a new SparseArray. */
export function createSparseArray<T>(): SparseArray<T> {
  return new SparseArray<T>();
}
