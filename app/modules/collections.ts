// @ts-check
// ─── Specialized Data Structures ────────────────────────────────────────────
// Stack, Queue, Deque, Multiset, and BiMap implementations using private class
// fields (#) and ES2022+ syntax.

// ─── Stack (LIFO) ────────────────────────────────────────────────────────────

/**
 * A last-in, first-out stack.
 * @template T
 */
export class Stack<T> {
  #items: T[] = [];

  /** Push an item onto the top of the stack. */
  push(item: T): void {
    this.#items.push(item);
  }

  /** Remove and return the top item, or `undefined` if empty. */
  pop(): T | undefined {
    return this.#items.pop();
  }

  /** Return the top item without removing it, or `undefined` if empty. */
  peek(): T | undefined {
    return this.#items[this.#items.length - 1];
  }

  /** Total number of items in the stack. */
  get size(): number {
    return this.#items.length;
  }

  /** `true` when the stack contains no items. */
  isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /** Remove all items. */
  clear(): void {
    this.#items = [];
  }

  /** Return a shallow copy of the items, top first. */
  toArray(): T[] {
    return this.#items.slice().reverse();
  }

  /** Iterate items top-first. */
  [Symbol.iterator](): Iterator<T> {
    const arr = this.toArray();
    let index = 0;
    return {
      next(): IteratorResult<T> {
        if (index < arr.length) {
          return { value: arr[index++], done: false };
        }
        return { value: undefined as unknown as T, done: true };
      },
    };
  }
}

// ─── Queue (FIFO) ────────────────────────────────────────────────────────────

/**
 * A first-in, first-out queue.
 * @template T
 */
export class Queue<T> {
  #items: T[] = [];

  /** Add an item to the back of the queue. */
  enqueue(item: T): void {
    this.#items.push(item);
  }

  /** Remove and return the front item, or `undefined` if empty. */
  dequeue(): T | undefined {
    return this.#items.shift();
  }

  /** Return the front item without removing it, or `undefined` if empty. */
  front(): T | undefined {
    return this.#items[0];
  }

  /** Total number of items in the queue. */
  get size(): number {
    return this.#items.length;
  }

  /** `true` when the queue contains no items. */
  isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /** Remove all items. */
  clear(): void {
    this.#items = [];
  }

  /** Return a shallow copy of the items, front first. */
  toArray(): T[] {
    return this.#items.slice();
  }

  /** Iterate items front-first. */
  [Symbol.iterator](): Iterator<T> {
    const arr = this.toArray();
    let index = 0;
    return {
      next(): IteratorResult<T> {
        if (index < arr.length) {
          return { value: arr[index++], done: false };
        }
        return { value: undefined as unknown as T, done: true };
      },
    };
  }
}

// ─── Deque (double-ended queue) ───────────────────────────────────────────────

/**
 * A double-ended queue that supports push and pop at both ends.
 * @template T
 */
export class Deque<T> {
  #items: T[] = [];

  /** Add an item to the front. */
  pushFront(item: T): void {
    this.#items.unshift(item);
  }

  /** Add an item to the back. */
  pushBack(item: T): void {
    this.#items.push(item);
  }

  /** Remove and return the front item, or `undefined` if empty. */
  popFront(): T | undefined {
    return this.#items.shift();
  }

  /** Remove and return the back item, or `undefined` if empty. */
  popBack(): T | undefined {
    return this.#items.pop();
  }

  /** Return the front item without removing it, or `undefined` if empty. */
  peekFront(): T | undefined {
    return this.#items[0];
  }

  /** Return the back item without removing it, or `undefined` if empty. */
  peekBack(): T | undefined {
    return this.#items[this.#items.length - 1];
  }

  /** Total number of items in the deque. */
  get size(): number {
    return this.#items.length;
  }

  /** `true` when the deque contains no items. */
  isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /** Remove all items. */
  clear(): void {
    this.#items = [];
  }

  /** Return a shallow copy of the items, front to back. */
  toArray(): T[] {
    return this.#items.slice();
  }
}

// ─── Multiset (bag) ──────────────────────────────────────────────────────────

/**
 * A multiset (bag) that allows duplicate values and tracks occurrence counts.
 * @template T
 */
export class Multiset<T> {
  #counts: Map<T, number> = new Map();
  #total: number = 0;

  /** Add one occurrence of `item`. */
  add(item: T): void {
    this.#counts.set(item, (this.#counts.get(item) ?? 0) + 1);
    this.#total++;
  }

  /**
   * Remove one occurrence of `item`.
   * Returns `true` if the item was present, `false` otherwise.
   */
  delete(item: T): boolean {
    const current = this.#counts.get(item);
    if (current === undefined) return false;
    if (current === 1) {
      this.#counts.delete(item);
    } else {
      this.#counts.set(item, current - 1);
    }
    this.#total--;
    return true;
  }

  /**
   * Remove all occurrences of `item`.
   * Returns `true` if the item was present, `false` otherwise.
   */
  deleteAll(item: T): boolean {
    const current = this.#counts.get(item);
    if (current === undefined) return false;
    this.#counts.delete(item);
    this.#total -= current;
    return true;
  }

  /** `true` if the item appears at least once. */
  has(item: T): boolean {
    return this.#counts.has(item);
  }

  /** How many times `item` appears (0 if absent). */
  count(item: T): number {
    return this.#counts.get(item) ?? 0;
  }

  /** Total number of items including duplicates. */
  get size(): number {
    return this.#total;
  }

  /** Number of distinct items. */
  get uniqueSize(): number {
    return this.#counts.size;
  }

  /** Return `[item, count]` pairs for every distinct item. */
  entries(): Array<[T, number]> {
    return [...this.#counts.entries()];
  }

  /** Return every item repeated according to its count. */
  toArray(): T[] {
    const result: T[] = [];
    for (const [item, count] of this.#counts) {
      for (let i = 0; i < count; i++) {
        result.push(item);
      }
    }
    return result;
  }

  /** Remove all items. */
  clear(): void {
    this.#counts.clear();
    this.#total = 0;
  }
}

// ─── BiMap (bidirectional map) ────────────────────────────────────────────────

/**
 * A bidirectional map that enforces a one-to-one relationship between keys and
 * values.  Setting a key or value that already exists replaces the old pair.
 * @template K
 * @template V
 */
export class BiMap<K, V> {
  #forward: Map<K, V> = new Map();
  #reverse: Map<V, K> = new Map();

  /**
   * Associate `key` with `value`.
   * Any existing pair sharing `key` or `value` is first removed to preserve
   * the one-to-one constraint.
   */
  set(key: K, value: V): void {
    // Remove stale forward entry for the same key.
    if (this.#forward.has(key)) {
      const oldValue = this.#forward.get(key) as V;
      this.#reverse.delete(oldValue);
    }
    // Remove stale reverse entry for the same value.
    if (this.#reverse.has(value)) {
      const oldKey = this.#reverse.get(value) as K;
      this.#forward.delete(oldKey);
    }
    this.#forward.set(key, value);
    this.#reverse.set(value, key);
  }

  /** Look up the value associated with `key`, or `undefined`. */
  getByKey(key: K): V | undefined {
    return this.#forward.get(key);
  }

  /** Look up the key associated with `value`, or `undefined`. */
  getByValue(value: V): K | undefined {
    return this.#reverse.get(value);
  }

  /**
   * Remove the pair whose key is `key`.
   * Returns `true` if a pair was removed.
   */
  deleteByKey(key: K): boolean {
    if (!this.#forward.has(key)) return false;
    const value = this.#forward.get(key) as V;
    this.#forward.delete(key);
    this.#reverse.delete(value);
    return true;
  }

  /**
   * Remove the pair whose value is `value`.
   * Returns `true` if a pair was removed.
   */
  deleteByValue(value: V): boolean {
    if (!this.#reverse.has(value)) return false;
    const key = this.#reverse.get(value) as K;
    this.#reverse.delete(value);
    this.#forward.delete(key);
    return true;
  }

  /** `true` if a pair with `key` exists. */
  hasKey(key: K): boolean {
    return this.#forward.has(key);
  }

  /** `true` if a pair with `value` exists. */
  hasValue(value: V): boolean {
    return this.#reverse.has(value);
  }

  /** Number of key-value pairs. */
  get size(): number {
    return this.#forward.size;
  }

  /** Remove all pairs. */
  clear(): void {
    this.#forward.clear();
    this.#reverse.clear();
  }

  /** Return all keys. */
  keys(): K[] {
    return [...this.#forward.keys()];
  }

  /** Return all values. */
  values(): V[] {
    return [...this.#forward.values()];
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Create an empty {@link Stack}. */
export function createStack<T>(): Stack<T> {
  return new Stack<T>();
}

/** Create an empty {@link Queue}. */
export function createQueue<T>(): Queue<T> {
  return new Queue<T>();
}

/** Create an empty {@link Deque}. */
export function createDeque<T>(): Deque<T> {
  return new Deque<T>();
}

/** Create an empty {@link Multiset}. */
export function createMultiset<T>(): Multiset<T> {
  return new Multiset<T>();
}

/** Create an empty {@link BiMap}. */
export function createBiMap<K, V>(): BiMap<K, V> {
  return new BiMap<K, V>();
}
