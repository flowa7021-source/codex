// @ts-check
// ─── Lazy Stream / Iterator Utilities ───────────────────────────────────────
// A lazy, generator-backed Stream<T> with composable transformations and
// terminal operations. Streams are single-use (consumed once like iterators).

// ─── Stream ──────────────────────────────────────────────────────────────────

/**
 * A lazy sequence built on top of ES generators.
 *
 * Every transformation (map, filter, …) returns a new Stream without pulling
 * any values. Values are only materialised when a terminal operation such as
 * `toArray()` or `forEach()` is called.
 *
 * Streams are single-use: once consumed the underlying iterator is exhausted.
 */
export class Stream<T> {
  /** The generator function that backs this stream. */
  readonly #source: () => Generator<T>;

  constructor(source: () => Generator<T>) {
    this.#source = source;
  }

  // ─── Static Factories ─────────────────────────────────────────────────────

  /** Create a Stream from any iterable (array, Set, Map, generator, …). */
  static from<T>(iterable: Iterable<T>): Stream<T> {
    return new Stream(function* () {
      yield* iterable;
    });
  }

  /** Create a Stream from a fixed list of values. */
  static of<T>(...items: T[]): Stream<T> {
    return Stream.from(items);
  }

  /**
   * Create a Stream of numbers `[start, end)` with an optional `step`.
   * `Stream.range(1, 5)` → 1, 2, 3, 4
   * `Stream.range(0, 10, 2)` → 0, 2, 4, 6, 8
   */
  static range(start: number, end: number, step = 1): Stream<number> {
    if (step === 0) throw new RangeError('Stream.range: step must not be zero');
    return new Stream(function* () {
      if (step > 0) {
        for (let i = start; i < end; i += step) yield i;
      } else {
        for (let i = start; i > end; i += step) yield i;
      }
    });
  }

  /**
   * Create a Stream that yields `value` repeatedly.
   * When `count` is omitted the stream is infinite — only safe with `.take(n)`.
   */
  static repeat<T>(value: T, count?: number): Stream<T> {
    return new Stream(function* () {
      if (count === undefined) {
        while (true) yield value;
      } else {
        for (let i = 0; i < count; i++) yield value;
      }
    });
  }

  /**
   * Create a Stream by calling `fn(index)` for each successive index.
   * When `count` is omitted the stream is infinite — only safe with `.take(n)`.
   */
  static generate<T>(fn: (index: number) => T, count?: number): Stream<T> {
    return new Stream(function* () {
      if (count === undefined) {
        let i = 0;
        while (true) yield fn(i++);
      } else {
        for (let i = 0; i < count; i++) yield fn(i);
      }
    });
  }

  // ─── Lazy Transformations ─────────────────────────────────────────────────

  /** Transform each element with `fn`. */
  map<U>(fn: (item: T, index: number) => U): Stream<U> {
    const source = this.#source;
    return new Stream(function* () {
      let i = 0;
      for (const item of source()) {
        yield fn(item, i++);
      }
    });
  }

  /** Keep only elements for which `predicate` returns true. */
  filter(predicate: (item: T, index: number) => boolean): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      let i = 0;
      for (const item of source()) {
        if (predicate(item, i++)) yield item;
      }
    });
  }

  /** Yield at most the first `n` elements. */
  take(n: number): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      if (n <= 0) return;
      let count = 0;
      for (const item of source()) {
        yield item;
        if (++count >= n) return;
      }
    });
  }

  /** Skip the first `n` elements. */
  skip(n: number): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      let skipped = 0;
      for (const item of source()) {
        if (skipped < n) {
          skipped++;
        } else {
          yield item;
        }
      }
    });
  }

  /** Map each element to an iterable and flatten one level. */
  flatMap<U>(fn: (item: T) => Iterable<U>): Stream<U> {
    const source = this.#source;
    return new Stream(function* () {
      for (const item of source()) {
        yield* fn(item);
      }
    });
  }

  /** Yield elements as long as `predicate` returns true, then stop. */
  takeWhile(predicate: (item: T) => boolean): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      for (const item of source()) {
        if (!predicate(item)) return;
        yield item;
      }
    });
  }

  /** Skip elements as long as `predicate` returns true, then yield the rest. */
  skipWhile(predicate: (item: T) => boolean): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      let skipping = true;
      for (const item of source()) {
        if (skipping && predicate(item)) continue;
        skipping = false;
        yield item;
      }
    });
  }

  /**
   * Pair each element of this stream with the corresponding element of
   * `other`. Stops when either stream is exhausted.
   */
  zip<U>(other: Iterable<U>): Stream<[T, U]> {
    const source = this.#source;
    return new Stream(function* () {
      const otherIter = other[Symbol.iterator]();
      for (const item of source()) {
        const next = otherIter.next();
        if (next.done) return;
        yield [item, next.value] as [T, U];
      }
    });
  }

  /** Group elements into non-overlapping arrays of length `size`. */
  chunk(size: number): Stream<T[]> {
    if (size <= 0) throw new RangeError('Stream.chunk: size must be > 0');
    const source = this.#source;
    return new Stream(function* () {
      let buf: T[] = [];
      for (const item of source()) {
        buf.push(item);
        if (buf.length === size) {
          yield buf;
          buf = [];
        }
      }
      if (buf.length > 0) yield buf;
    });
  }

  /** Yield only the first occurrence of each element (by reference equality). */
  distinct(): Stream<T> {
    const source = this.#source;
    return new Stream(function* () {
      const seen = new Set<T>();
      for (const item of source()) {
        if (!seen.has(item)) {
          seen.add(item);
          yield item;
        }
      }
    });
  }

  /**
   * Flatten one level of nested iterables.
   * Each element of this stream must itself be `Iterable`.
   */
  flatten(): Stream<T extends Iterable<infer U> ? U : never> {
    const source = this.#source;
    return new Stream(function* () {
      for (const item of source()) {
        yield* item as Iterable<unknown>;
      }
    }) as Stream<T extends Iterable<infer U> ? U : never>;
  }

  // ─── Terminal Operations ──────────────────────────────────────────────────

  /** Collect all elements into an array. */
  toArray(): T[] {
    const result: T[] = [];
    for (const item of this.#source()) {
      result.push(item);
    }
    return result;
  }

  /** Collect all elements into a Set. */
  toSet(): Set<T> {
    return new Set(this.#source());
  }

  /** Collect all elements into a Map using `keyFn` and `valueFn`. */
  toMap<K, V>(keyFn: (item: T) => K, valueFn: (item: T) => V): Map<K, V> {
    const map = new Map<K, V>();
    for (const item of this.#source()) {
      map.set(keyFn(item), valueFn(item));
    }
    return map;
  }

  /** Left-fold the stream with an accumulator. */
  reduce<U>(fn: (acc: U, item: T) => U, initial: U): U {
    let acc = initial;
    for (const item of this.#source()) {
      acc = fn(acc, item);
    }
    return acc;
  }

  /** Call `fn` for each element (consumes the stream). */
  forEach(fn: (item: T) => void): void {
    for (const item of this.#source()) {
      fn(item);
    }
  }

  /** Return the first element for which `predicate` returns true, or undefined. */
  find(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.#source()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  /** Return true if `predicate` holds for every element (vacuously true if empty). */
  every(predicate: (item: T) => boolean): boolean {
    for (const item of this.#source()) {
      if (!predicate(item)) return false;
    }
    return true;
  }

  /** Return true if `predicate` holds for at least one element. */
  some(predicate: (item: T) => boolean): boolean {
    for (const item of this.#source()) {
      if (predicate(item)) return true;
    }
    return false;
  }

  /** Count the number of elements in the stream. */
  count(): number {
    let n = 0;
    for (const _item of this.#source()) n++;
    return n;
  }

  /** Return the first element, or undefined if the stream is empty. */
  first(): T | undefined {
    for (const item of this.#source()) return item;
    return undefined;
  }

  /** Return the last element, or undefined if the stream is empty. */
  last(): T | undefined {
    let last: T | undefined;
    let hasAny = false;
    for (const item of this.#source()) {
      last = item;
      hasAny = true;
    }
    return hasAny ? last : undefined;
  }

  // ─── Iterator Protocol ────────────────────────────────────────────────────

  /** Make Stream directly usable in `for…of` loops and spread expressions. */
  [Symbol.iterator](): Generator<T> {
    return this.#source();
  }
}
