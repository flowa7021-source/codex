// @ts-check
// ─── Memoization Utilities ───────────────────────────────────────────────────
// Advanced memoization helpers: Map cache, async deduplication, WeakMap, once,
// and thunk (lazy evaluation).

// ─── Internal Types ──────────────────────────────────────────────────────────

interface CacheEntry<R> {
  value: R;
  expiry: number | null; // null = no TTL
}

interface MemoizeOptions<T extends unknown[]> {
  maxSize?: number;
  ttl?: number;
  keyFn?: (...args: T) => string;
}

interface MemoizeAsyncOptions {
  maxSize?: number;
  ttl?: number;
}

// ─── memoize ─────────────────────────────────────────────────────────────────

/**
 * Simple memoize with Map cache.
 * Supports optional `maxSize` (LRU eviction), `ttl` (ms), and custom `keyFn`.
 * The returned function exposes `.cache`, `.clear()`, and `.invalidate(...args)`.
 */
export function memoize<T extends unknown[], R>(
  fn: (...args: T) => R,
  options?: MemoizeOptions<T>,
): ((...args: T) => R) & { cache: Map<string, R>; clear(): void; invalidate(...args: T): void } {
  const maxSize = options?.maxSize ?? Infinity;
  const ttl = options?.ttl ?? null;
  const keyFn = options?.keyFn ?? ((...args: T) => JSON.stringify(args));

  // Map preserves insertion order — we use that for LRU eviction.
  const internal = new Map<string, CacheEntry<R>>();

  function evictExpired(): void {
    const now = Date.now();
    for (const [k, entry] of internal) {
      if (entry.expiry !== null && now > entry.expiry) {
        internal.delete(k);
      }
    }
  }

  function memoized(...args: T): R {
    const key = keyFn(...args);
    const now = Date.now();
    const entry = internal.get(key);

    if (entry !== undefined) {
      if (entry.expiry === null || now <= entry.expiry) {
        // Move to end (most recently used) for LRU
        internal.delete(key);
        internal.set(key, entry);
        return entry.value;
      }
      // Expired — remove it
      internal.delete(key);
    }

    const value = fn(...args);
    const expiry = ttl !== null ? now + ttl : null;

    // Evict LRU entries if over maxSize
    if (internal.size >= maxSize) {
      evictExpired();
      if (internal.size >= maxSize) {
        // Delete the oldest (first) entry
        const firstKey = internal.keys().next().value;
        if (firstKey !== undefined) internal.delete(firstKey);
      }
    }

    internal.set(key, { value, expiry });
    return value;
  }

  // Expose a plain Map view of cached values (without expiry metadata)
  const publicCache = new Proxy(new Map<string, R>(), {
    get(_, prop) {
      if (prop === 'size') return internal.size;
      if (prop === 'has') return (k: string) => internal.has(k);
      if (prop === 'get') return (k: string) => internal.get(k)?.value;
      if (prop === 'keys') return () => internal.keys();
      if (prop === 'values') return () => (function* () { for (const e of internal.values()) yield e.value; })();
      if (prop === 'entries') return () => (function* () { for (const [k, e] of internal.entries()) yield [k, e.value] as [string, R]; })();
      if (prop === Symbol.iterator) return () => (function* () { for (const [k, e] of internal.entries()) yield [k, e.value] as [string, R]; })();
      if (prop === 'forEach') return (cb: (v: R, k: string) => void) => { for (const [k, e] of internal) cb(e.value, k); };
      return undefined;
    },
  });

  memoized.cache = publicCache as unknown as Map<string, R>;

  memoized.clear = function (): void {
    internal.clear();
  };

  memoized.invalidate = function (...args: T): void {
    const key = keyFn(...args);
    internal.delete(key);
  };

  return memoized;
}

// ─── memoizeAsync ─────────────────────────────────────────────────────────────

/**
 * Memoize async function.
 * Prevents duplicate in-flight requests: concurrent calls with the same key
 * share a single Promise.
 */
export function memoizeAsync<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options?: MemoizeAsyncOptions,
): (...args: T) => Promise<R> {
  const maxSize = options?.maxSize ?? Infinity;
  const ttl = options?.ttl ?? null;

  const cache = new Map<string, { promise: Promise<R>; expiry: number | null }>();

  return function (...args: T): Promise<R> {
    const key = JSON.stringify(args);
    const now = Date.now();
    const entry = cache.get(key);

    if (entry !== undefined) {
      if (entry.expiry === null || now <= entry.expiry) {
        return entry.promise;
      }
      cache.delete(key);
    }

    const promise = fn(...args).then(
      (result) => {
        // Replace with a resolved entry so TTL still applies on later lookups
        const expiry = ttl !== null ? now + ttl : null;
        cache.set(key, { promise: Promise.resolve(result), expiry });
        return result;
      },
      (err: unknown) => {
        // Remove failed entries so callers can retry
        cache.delete(key);
        return Promise.reject(err);
      },
    );

    // Store the in-flight promise immediately (expiry will be set on resolution)
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(key, { promise, expiry: null });

    return promise;
  };
}

// ─── weakMemoize ──────────────────────────────────────────────────────────────

/**
 * Weak memoize using WeakMap (for object keys).
 * Cache entries are automatically garbage-collected when the key object is GC'd.
 */
export function weakMemoize<K extends object, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();

  return function (key: K): V {
    if (cache.has(key)) {
      return cache.get(key) as V;
    }
    const value = fn(key);
    cache.set(key, value);
    return value;
  };
}

// ─── once ─────────────────────────────────────────────────────────────────────

/**
 * Once: only execute function once, return cached result on subsequent calls.
 */
export function once<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
  let called = false;
  let result: R;

  return function (...args: T): R {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

// ─── thunk ────────────────────────────────────────────────────────────────────

/**
 * Thunk: lazy evaluation.
 * Returns a zero-argument function that evaluates `fn` on first call and caches
 * the result for all subsequent calls.
 */
export function thunk<T>(fn: () => T): () => T {
  let evaluated = false;
  let value: T;

  return function (): T {
    if (!evaluated) {
      evaluated = true;
      value = fn();
    }
    return value;
  };
}
