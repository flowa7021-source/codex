// @ts-check
// ─── Stream Pipeline ─────────────────────────────────────────────────────────
// Synchronous lazy stream / pipeline abstraction.

// ─── Stream Class ─────────────────────────────────────────────────────────────

export class Stream<T> {
  /** @internal */
  private readonly _source: Iterable<T>;

  constructor(items: Iterable<T>) {
    this._source = items;
  }

  // ─── Intermediate Operations ───────────────────────────────────────────────

  map<U>(fn: (item: T) => U): Stream<U> {
    const source = this._source;
    return new Stream<U>({
      [Symbol.iterator]() {
        function* gen() {
          for (const item of source) {
            yield fn(item);
          }
        }
        return gen();
      },
    });
  }

  filter(fn: (item: T) => boolean): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          for (const item of source) {
            if (fn(item)) yield item;
          }
        }
        return gen();
      },
    });
  }

  flatMap<U>(fn: (item: T) => Iterable<U>): Stream<U> {
    const source = this._source;
    return new Stream<U>({
      [Symbol.iterator]() {
        function* gen() {
          for (const item of source) {
            yield* fn(item);
          }
        }
        return gen();
      },
    });
  }

  take(n: number): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          let count = 0;
          for (const item of source) {
            if (count >= n) break;
            yield item;
            count++;
          }
        }
        return gen();
      },
    });
  }

  skip(n: number): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          let count = 0;
          for (const item of source) {
            if (count < n) {
              count++;
              continue;
            }
            yield item;
          }
        }
        return gen();
      },
    });
  }

  takeWhile(fn: (item: T) => boolean): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          for (const item of source) {
            if (!fn(item)) break;
            yield item;
          }
        }
        return gen();
      },
    });
  }

  skipWhile(fn: (item: T) => boolean): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          let skipping = true;
          for (const item of source) {
            if (skipping && fn(item)) continue;
            skipping = false;
            yield item;
          }
        }
        return gen();
      },
    });
  }

  distinct(): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          const seen = new Set<T>();
          for (const item of source) {
            if (!seen.has(item)) {
              seen.add(item);
              yield item;
            }
          }
        }
        return gen();
      },
    });
  }

  distinctBy<K>(fn: (item: T) => K): Stream<T> {
    const source = this._source;
    return new Stream<T>({
      [Symbol.iterator]() {
        function* gen() {
          const seen = new Set<K>();
          for (const item of source) {
            const key = fn(item);
            if (!seen.has(key)) {
              seen.add(key);
              yield item;
            }
          }
        }
        return gen();
      },
    });
  }

  sort(compareFn?: (a: T, b: T) => number): Stream<T> {
    const arr = this.toArray();
    arr.sort(compareFn);
    return new Stream<T>(arr);
  }

  sortBy<K>(fn: (item: T) => K): Stream<T> {
    const arr = this.toArray();
    arr.sort((a, b) => {
      const ka = fn(a);
      const kb = fn(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return 0;
    });
    return new Stream<T>(arr);
  }

  reverse(): Stream<T> {
    const arr = this.toArray();
    arr.reverse();
    return new Stream<T>(arr);
  }

  zip<U>(other: Stream<U> | Iterable<U>): Stream<[T, U]> {
    const source = this._source;
    const otherIterable: Iterable<U> = other instanceof Stream ? other._source : other;
    return new Stream<[T, U]>({
      [Symbol.iterator]() {
        function* gen() {
          const iterA = source[Symbol.iterator]();
          const iterB = otherIterable[Symbol.iterator]();
          while (true) {
            const a = iterA.next();
            const b = iterB.next();
            if (a.done || b.done) break;
            yield [a.value, b.value] as [T, U];
          }
        }
        return gen();
      },
    });
  }

  // ─── Terminal Operations ───────────────────────────────────────────────────

  /** Collect to array. */
  toArray(): T[] {
    return [...this._source];
  }

  /** Reduce. */
  reduce<U>(fn: (acc: U, item: T) => U, initial: U): U {
    let acc = initial;
    for (const item of this._source) {
      acc = fn(acc, item);
    }
    return acc;
  }

  /** For each. */
  forEach(fn: (item: T) => void): void {
    for (const item of this._source) {
      fn(item);
    }
  }

  /** Find first match. */
  find(fn: (item: T) => boolean): T | undefined {
    for (const item of this._source) {
      if (fn(item)) return item;
    }
    return undefined;
  }

  /** Check any match. */
  some(fn: (item: T) => boolean): boolean {
    for (const item of this._source) {
      if (fn(item)) return true;
    }
    return false;
  }

  /** Check all match. */
  every(fn: (item: T) => boolean): boolean {
    for (const item of this._source) {
      if (!fn(item)) return false;
    }
    return true;
  }

  /** Count elements. */
  count(): number {
    let n = 0;
    for (const _item of this._source) n++;
    return n;
  }

  /** Group by key. */
  groupBy<K extends string>(fn: (item: T) => K): Record<K, T[]> {
    const result = {} as Record<K, T[]>;
    for (const item of this._source) {
      const key = fn(item);
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/** Create a Stream from any iterable. */
export function stream<T>(items: Iterable<T>): Stream<T> {
  return new Stream<T>(items);
}

/**
 * Generate a stream of numbers from `start` (inclusive) to `end` (exclusive),
 * advancing by `step` (default 1).
 */
export function range(start: number, end: number, step = 1): Stream<number> {
  return new Stream<number>({
    [Symbol.iterator]() {
      function* gen() {
        if (step > 0) {
          for (let i = start; i < end; i += step) yield i;
        } else if (step < 0) {
          for (let i = start; i > end; i += step) yield i;
        }
      }
      return gen();
    },
  });
}

/** Create a stream of `count` copies of `value`. */
export function repeat<T>(value: T, count: number): Stream<T> {
  return new Stream<T>({
    [Symbol.iterator]() {
      function* gen() {
        for (let i = 0; i < count; i++) yield value;
      }
      return gen();
    },
  });
}

/** Create a stream of `count` values produced by calling `fn(index)`. */
export function generate<T>(fn: (index: number) => T, count: number): Stream<T> {
  return new Stream<T>({
    [Symbol.iterator]() {
      function* gen() {
        for (let i = 0; i < count; i++) yield fn(i);
      }
      return gen();
    },
  });
}
