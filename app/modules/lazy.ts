// @ts-check
// ─── Lazy Evaluation & Infinite Sequences ────────────────────────────────────
// Lazy<T> for deferred single-value computation, LazySeq<T> for infinite
// lazy sequences, and built-in sequences: naturals, fibonacci, primes.

// ─── Lazy ─────────────────────────────────────────────────────────────────────

/**
 * Lazy value: computed once on first access, then cached.
 * `.reset()` clears the cache so the next `.value` access recomputes.
 */
export class Lazy<T> {
  private _fn: () => T;
  private _computed = false;
  private _value: T | undefined = undefined;

  constructor(fn: () => T) {
    this._fn = fn;
  }

  get value(): T {
    if (!this._computed) {
      this._value = this._fn();
      this._computed = true;
    }
    return this._value as T;
  }

  get isComputed(): boolean {
    return this._computed;
  }

  reset(): void {
    this._computed = false;
    this._value = undefined;
  }

  /**
   * Returns a new `Lazy<U>` whose value is `fn(this.value)`.
   * The mapped value is computed lazily when first accessed.
   */
  map<U>(fn: (val: T) => U): Lazy<U> {
    return new Lazy<U>(() => fn(this.value));
  }
}

// ─── LazySeq ─────────────────────────────────────────────────────────────────

/**
 * Infinite lazy sequence backed by a generator factory.
 * The generator is recreated each time iteration is needed, so the sequence
 * is always available from the beginning.
 */
export class LazySeq<T> {
  private _generatorFn: () => Generator<T>;

  constructor(generatorFn: () => Generator<T>) {
    this._generatorFn = generatorFn;
  }

  /** Take the first `n` items from the sequence. */
  take(n: number): T[] {
    const result: T[] = [];
    if (n <= 0) return result;
    for (const item of this._generatorFn()) {
      result.push(item);
      if (result.length >= n) break;
    }
    return result;
  }

  /** Take items while `fn` returns true. */
  takeWhile(fn: (item: T) => boolean): T[] {
    const result: T[] = [];
    for (const item of this._generatorFn()) {
      if (!fn(item)) break;
      result.push(item);
    }
    return result;
  }

  /** Map each item through `fn`, returning a new `LazySeq<U>`. */
  map<U>(fn: (item: T) => U): LazySeq<U> {
    const source = this._generatorFn;
    return new LazySeq<U>(function* () {
      for (const item of source()) {
        yield fn(item);
      }
    });
  }

  /** Filter items, returning a new `LazySeq<T>` of only matching items. */
  filter(fn: (item: T) => boolean): LazySeq<T> {
    const source = this._generatorFn;
    return new LazySeq<T>(function* () {
      for (const item of source()) {
        if (fn(item)) yield item;
      }
    });
  }

  /** Return the first item matching `fn`, or `undefined` if none found. */
  find(fn: (item: T) => boolean): T | undefined {
    for (const item of this._generatorFn()) {
      if (fn(item)) return item;
    }
    return undefined;
  }

  /** Return the item at 0-based index `n`, or `undefined` if out of range. */
  nth(n: number): T | undefined {
    if (n < 0) return undefined;
    let i = 0;
    for (const item of this._generatorFn()) {
      if (i === n) return item;
      i++;
    }
    return undefined;
  }
}

// ─── Factory helpers ─────────────────────────────────────────────────────────

/** Create a `Lazy<T>` wrapping the given factory function. */
export function lazy<T>(fn: () => T): Lazy<T> {
  return new Lazy<T>(fn);
}

/** Create a `LazySeq<T>` from a generator factory. */
export function lazySeq<T>(generatorFn: () => Generator<T>): LazySeq<T> {
  return new LazySeq<T>(generatorFn);
}

// ─── Built-in sequences ──────────────────────────────────────────────────────

/** Infinite sequence of natural numbers starting at `start` (default 0). */
export function naturals(start = 0): LazySeq<number> {
  return new LazySeq<number>(function* () {
    let n = start;
    while (true) {
      yield n++;
    }
  });
}

/** Infinite Fibonacci sequence: 0, 1, 1, 2, 3, 5, 8, … */
export function fibonacci(): LazySeq<number> {
  return new LazySeq<number>(function* () {
    let a = 0;
    let b = 1;
    while (true) {
      yield a;
      [a, b] = [b, a + b];
    }
  });
}

/** Infinite sequence of prime numbers: 2, 3, 5, 7, 11, … */
export function primes(): LazySeq<number> {
  return new LazySeq<number>(function* () {
    // Trial-division sieve; tracks smallest prime factors seen so far.
    const composites = new Map<number, number>();
    let n = 2;
    while (true) {
      if (!composites.has(n)) {
        // n is prime
        yield n;
        composites.set(n * n, n);
      } else {
        // n is composite — advance each prime that marks it
        let p = composites.get(n) as number;
        let next = n + p;
        while (composites.has(next)) next += p;
        composites.delete(n);
        composites.set(next, p);
      }
      n++;
    }
  });
}
