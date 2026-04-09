// @ts-check
// ─── Deque ──────────────────────────────────────────────────────────────────
// Double-ended queue backed by a dynamic circular array.
// Supports O(1) amortized push/pop at both ends.

// ─── Deque ──────────────────────────────────────────────────────────────────

/**
 * A double-ended queue (deque).
 *
 * Allows efficient insertion and removal at both the front and back.
 * Internally uses a circular array that grows automatically when needed.
 *
 * @template T - The element type stored in the deque.
 *
 * @example
 *   const dq = new Deque<number>([1, 2, 3]);
 *   dq.pushFront(0);
 *   dq.pushBack(4);
 *   dq.toArray(); // [0, 1, 2, 3, 4]
 */
export class Deque<T> {
  #buffer: (T | undefined)[];
  #head = 0;
  #size = 0;

  constructor(items?: T[]) {
    const initial = items ?? [];
    const cap = Math.max(4, initial.length);
    this.#buffer = new Array<T | undefined>(cap);
    for (let i = 0; i < initial.length; i++) {
      this.#buffer[i] = initial[i];
    }
    this.#size = initial.length;
  }

  // ─── Capacity helpers ───────────────────────────────────────────────────

  #grow(): void {
    const oldCap = this.#buffer.length;
    const newCap = oldCap * 2;
    const newBuf = new Array<T | undefined>(newCap);
    for (let i = 0; i < this.#size; i++) {
      newBuf[i] = this.#buffer[(this.#head + i) % oldCap];
    }
    this.#buffer = newBuf;
    this.#head = 0;
  }

  // ─── Size ───────────────────────────────────────────────────────────────

  /** Current number of elements. */
  get size(): number {
    return this.#size;
  }

  /** Whether the deque contains no elements. */
  get isEmpty(): boolean {
    return this.#size === 0;
  }

  // ─── Mutation ───────────────────────────────────────────────────────────

  /** Add an element to the front (index 0). */
  pushFront(item: T): void {
    if (this.#size === this.#buffer.length) this.#grow();
    this.#head = (this.#head - 1 + this.#buffer.length) % this.#buffer.length;
    this.#buffer[this.#head] = item;
    this.#size++;
  }

  /** Add an element to the back. */
  pushBack(item: T): void {
    if (this.#size === this.#buffer.length) this.#grow();
    const writeIndex = (this.#head + this.#size) % this.#buffer.length;
    this.#buffer[writeIndex] = item;
    this.#size++;
  }

  /**
   * Remove and return the front element.
   * Returns `undefined` if the deque is empty.
   */
  popFront(): T | undefined {
    if (this.#size === 0) return undefined;
    const value = this.#buffer[this.#head];
    this.#buffer[this.#head] = undefined;
    this.#head = (this.#head + 1) % this.#buffer.length;
    this.#size--;
    return value;
  }

  /**
   * Remove and return the back element.
   * Returns `undefined` if the deque is empty.
   */
  popBack(): T | undefined {
    if (this.#size === 0) return undefined;
    const backIndex = (this.#head + this.#size - 1) % this.#buffer.length;
    const value = this.#buffer[backIndex];
    this.#buffer[backIndex] = undefined;
    this.#size--;
    return value;
  }

  /** Remove all elements. */
  clear(): void {
    this.#buffer = new Array<T | undefined>(4);
    this.#head = 0;
    this.#size = 0;
  }

  // ─── Access ─────────────────────────────────────────────────────────────

  /**
   * Return the front element without removing it.
   * Returns `undefined` if the deque is empty.
   */
  peekFront(): T | undefined {
    if (this.#size === 0) return undefined;
    return this.#buffer[this.#head];
  }

  /**
   * Return the back element without removing it.
   * Returns `undefined` if the deque is empty.
   */
  peekBack(): T | undefined {
    if (this.#size === 0) return undefined;
    const backIndex = (this.#head + this.#size - 1) % this.#buffer.length;
    return this.#buffer[backIndex];
  }

  /**
   * Access an element by logical index (0 = front).
   * Returns `undefined` if the index is out of range.
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    return this.#buffer[(this.#head + index) % this.#buffer.length];
  }

  // ─── Conversion / iteration ─────────────────────────────────────────────

  /** Return a snapshot array ordered front-to-back. */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.#size; i++) {
      result.push(this.#buffer[(this.#head + i) % this.#buffer.length] as T);
    }
    return result;
  }

  /** Iterate front-to-back. */
  [Symbol.iterator](): Iterator<T> {
    let i = 0;
    const self = this;
    return {
      next(): IteratorResult<T> {
        if (i >= self.size) return { done: true, value: undefined };
        return { done: false, value: self.get(i++) as T };
      },
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a double-ended queue, optionally seeded with initial items.
 *
 * @example
 *   const dq = createDeque([1, 2, 3]);
 */
export function createDeque<T>(items?: T[]): Deque<T> {
  return new Deque<T>(items);
}
