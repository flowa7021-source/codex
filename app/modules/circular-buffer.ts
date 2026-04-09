// @ts-check
// ─── Circular Buffer ────────────────────────────────────────────────────────
// Fixed-size ring buffer that overwrites the oldest element when full.
// Useful for bounded history, rolling logs, or sliding-window computations.

// ─── CircularBuffer ─────────────────────────────────────────────────────────

/**
 * A fixed-size circular (ring) buffer.
 *
 * Elements are added at the back. When the buffer is full, `push()` overwrites
 * the oldest (front) element. Logical index 0 is always the oldest element.
 *
 * @template T - The element type stored in the buffer.
 *
 * @example
 *   const buf = new CircularBuffer<number>(3);
 *   buf.push(1); buf.push(2); buf.push(3);
 *   buf.push(4); // overwrites 1
 *   buf.toArray(); // [2, 3, 4]
 */
export class CircularBuffer<T> {
  readonly #capacity: number;
  #buffer: (T | undefined)[];
  #head = 0;
  #size = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Capacity must be a positive integer');
    }
    this.#capacity = capacity;
    this.#buffer = new Array<T | undefined>(capacity);
  }

  // ─── Capacity / size ────────────────────────────────────────────────────

  /** Maximum number of elements the buffer can hold. */
  get capacity(): number {
    return this.#capacity;
  }

  /** Current number of elements in the buffer. */
  get size(): number {
    return this.#size;
  }

  /** Whether the buffer has reached its capacity. */
  get isFull(): boolean {
    return this.#size === this.#capacity;
  }

  /** Whether the buffer contains no elements. */
  get isEmpty(): boolean {
    return this.#size === 0;
  }

  // ─── Mutation ───────────────────────────────────────────────────────────

  /**
   * Add an element to the back of the buffer.
   * If the buffer is full the oldest (front) element is overwritten.
   */
  push(item: T): void {
    const writeIndex = (this.#head + this.#size) % this.#capacity;
    if (this.#size === this.#capacity) {
      // Overwrite oldest — advance head
      this.#buffer[writeIndex] = item;
      this.#head = (this.#head + 1) % this.#capacity;
    } else {
      this.#buffer[writeIndex] = item;
      this.#size++;
    }
  }

  /**
   * Remove and return the front (oldest) element.
   * Returns `undefined` if the buffer is empty.
   */
  shift(): T | undefined {
    if (this.#size === 0) return undefined;
    const value = this.#buffer[this.#head];
    this.#buffer[this.#head] = undefined;
    this.#head = (this.#head + 1) % this.#capacity;
    this.#size--;
    return value;
  }

  /** Remove all elements from the buffer. */
  clear(): void {
    this.#buffer = new Array<T | undefined>(this.#capacity);
    this.#head = 0;
    this.#size = 0;
  }

  // ─── Access ─────────────────────────────────────────────────────────────

  /**
   * Return the front (oldest) element without removing it.
   * Returns `undefined` if the buffer is empty.
   */
  peek(): T | undefined {
    if (this.#size === 0) return undefined;
    return this.#buffer[this.#head];
  }

  /**
   * Return the back (newest) element without removing it.
   * Returns `undefined` if the buffer is empty.
   */
  peekBack(): T | undefined {
    if (this.#size === 0) return undefined;
    const backIndex = (this.#head + this.#size - 1) % this.#capacity;
    return this.#buffer[backIndex];
  }

  /**
   * Access an element by its logical index (0 = front / oldest).
   * Returns `undefined` if the index is out of range.
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    const realIndex = (this.#head + index) % this.#capacity;
    return this.#buffer[realIndex];
  }

  // ─── Conversion / iteration ─────────────────────────────────────────────

  /** Return a snapshot array ordered front-to-back. */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.#size; i++) {
      result.push(this.#buffer[(this.#head + i) % this.#capacity] as T);
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
 * Create a fixed-size circular buffer.
 *
 * @example
 *   const buf = createCircularBuffer<number>(100);
 */
export function createCircularBuffer<T>(capacity: number): CircularBuffer<T> {
  return new CircularBuffer<T>(capacity);
}
