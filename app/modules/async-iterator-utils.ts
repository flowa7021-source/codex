// ─── Async Iterator Utilities ────────────────────────────────────────────────
// Standalone functional helpers for `AsyncIterable<T>`.
// All intermediate helpers are lazy — they wrap the source iterable without
// consuming it until iterated.  Terminal helpers (`collect`, `take`) drive
// iteration and return a concrete value / array.

// ─── Terminal helpers ─────────────────────────────────────────────────────────

/**
 * Collect all items from an async iterable into an array.
 *
 * @example
 *   const items = await collect(someAsyncIterable);
 */
export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

/**
 * Collect at most the first `n` items from an async iterable into an array.
 * Stops early once `n` items have been gathered.
 *
 * @example
 *   const first3 = await take(stream, 3);
 */
export async function take<T>(iter: AsyncIterable<T>, n: number): Promise<T[]> {
  const result: T[] = [];
  if (n <= 0) return result;
  for await (const item of iter) {
    result.push(item);
    if (result.length >= n) break;
  }
  return result;
}

// ─── Lazy transformation helpers ──────────────────────────────────────────────

/**
 * Skip the first `n` items from an async iterable, then yield the rest.
 *
 * @example
 *   for await (const item of skip(stream, 2)) { … }
 */
export function skip<T>(iter: AsyncIterable<T>, n: number): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      let remaining = n;
      for await (const item of iter) {
        if (remaining > 0) {
          remaining--;
        } else {
          yield item;
        }
      }
    },
  };
}

/**
 * Apply a synchronous mapping function to each item of an async iterable.
 *
 * @example
 *   const doubled = map(stream, x => x * 2);
 */
export function map<T, U>(
  iter: AsyncIterable<T>,
  fn: (item: T) => U,
): AsyncIterable<U> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const item of iter) {
        yield fn(item);
      }
    },
  };
}

/**
 * Keep only items for which a synchronous predicate returns `true`.
 *
 * @example
 *   const evens = filter(stream, x => x % 2 === 0);
 */
export function filter<T>(
  iter: AsyncIterable<T>,
  predicate: (item: T) => boolean,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const item of iter) {
        if (predicate(item)) yield item;
      }
    },
  };
}

/**
 * Zip two async iterables together, producing `[A, B]` pairs.
 * Stops as soon as the shorter source is exhausted.
 *
 * @example
 *   const pairs = zip(streamA, streamB);
 *   // [[a0, b0], [a1, b1], …]
 */
export function zip<A, B>(
  a: AsyncIterable<A>,
  b: AsyncIterable<B>,
): AsyncIterable<[A, B]> {
  return {
    async *[Symbol.asyncIterator]() {
      const iterA = a[Symbol.asyncIterator]();
      const iterB = b[Symbol.asyncIterator]();
      while (true) {
        const [resA, resB] = await Promise.all([iterA.next(), iterB.next()]);
        if (resA.done || resB.done) break;
        yield [resA.value, resB.value] as [A, B];
      }
    },
  };
}

/**
 * Pair each item with its zero-based index, yielding `[index, item]` tuples.
 *
 * @example
 *   for await (const [i, item] of enumerate(stream)) { … }
 */
export function enumerate<T>(iter: AsyncIterable<T>): AsyncIterable<[number, T]> {
  return {
    async *[Symbol.asyncIterator]() {
      let index = 0;
      for await (const item of iter) {
        yield [index++, item] as [number, T];
      }
    },
  };
}

/**
 * Batch items into arrays of at most `size` elements each.
 * The final batch may be smaller if the source is not evenly divisible.
 *
 * @example
 *   const batches = chunk(stream, 3);
 *   // [[0,1,2], [3,4,5], [6]]
 */
export function chunk<T>(iter: AsyncIterable<T>, size: number): AsyncIterable<T[]> {
  return {
    async *[Symbol.asyncIterator]() {
      if (size <= 0) return;
      let batch: T[] = [];
      for await (const item of iter) {
        batch.push(item);
        if (batch.length >= size) {
          yield batch;
          batch = [];
        }
      }
      if (batch.length > 0) yield batch;
    },
  };
}

/**
 * Flatten one level of async iterables — each item of `iter` is itself an
 * `AsyncIterable<T>` whose items are yielded in order.
 *
 * @example
 *   const flat = flatten(streamOfStreams);
 */
export function flatten<T>(iter: AsyncIterable<AsyncIterable<T>>): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const inner of iter) {
        yield* inner;
      }
    },
  };
}

// ─── Pipeline composer ────────────────────────────────────────────────────────

/**
 * Compose a sequence of async-iterable transformation functions into a single
 * function that accepts a source iterable and returns a transformed iterable.
 *
 * Each function in `fns` takes an `AsyncIterable` and returns an `AsyncIterable`.
 * Functions are applied left-to-right (i.e. the first function receives the
 * source, its result flows into the second, and so on).
 *
 * @example
 *   const process = pipeline(
 *     iter => filter(iter, x => x > 0),
 *     iter => map(iter, x => x * 2),
 *   );
 *   const result = await collect(process(fromArray([-1, 2, 3])));
 *   // [4, 6]
 */
export function pipeline<T>(
  ...fns: ((iter: AsyncIterable<unknown>) => AsyncIterable<unknown>)[]
): (source: AsyncIterable<T>) => AsyncIterable<unknown> {
  return (source: AsyncIterable<T>) =>
    fns.reduce(
      (iter, fn) => fn(iter),
      source as AsyncIterable<unknown>,
    );
}
