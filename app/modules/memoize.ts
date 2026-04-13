// @ts-check
// ─── Memoization & Function Caching Utilities ───────────────────────────────
// Provides memoize, memoizeTTL, memoizeLRU, debounce, throttle, once, retry,
// plus memoizeAsync, weakMemoize, and thunk for backwards compatibility.

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
 * Basic memoize with a Map cache.  Uses the first argument as the cache key by
 * default; supply `keyFn` to derive a custom key from all arguments.
 *
 * The returned function exposes:
 *   - `.cache`      — the underlying Map (read/write)
 *   - `.clear()`    — empties the cache
 *   - `.invalidate(...args)` — removes a specific cached entry
 *
 * Also accepts an options object for `maxSize` (LRU eviction) and `ttl` (ms).
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFnOrOptions?: ((...args: Parameters<T>) => unknown) | MemoizeOptions<Parameters<T>>,
): T & { cache: Map<unknown, ReturnType<T>>; clear(): void; invalidate(...args: Parameters<T>): void } {
  let resolvedKeyFn: (...args: Parameters<T>) => unknown;
  let maxSize = Infinity;
  let ttl: number | null = null;

  if (typeof keyFnOrOptions === 'function') {
    resolvedKeyFn = keyFnOrOptions;
  } else if (keyFnOrOptions && typeof keyFnOrOptions === 'object') {
    maxSize = keyFnOrOptions.maxSize ?? Infinity;
    ttl = keyFnOrOptions.ttl ?? null;
    resolvedKeyFn = keyFnOrOptions.keyFn ?? ((...args: Parameters<T>) => JSON.stringify(args));
  } else {
    // Default: use first argument as key (simple Map lookup, no serialisation).
    resolvedKeyFn = (...args: Parameters<T>) => args[0];
  }

  // Map preserves insertion order — used for LRU eviction.
  const internal = new Map<unknown, CacheEntry<ReturnType<T>>>();

  function evictExpired(): void {
    const now = Date.now();
    for (const [k, entry] of internal) {
      if (entry.expiry !== null && now > entry.expiry) {
        internal.delete(k);
      }
    }
  }

  const memoized = function (...args: Parameters<T>): ReturnType<T> {
    const key = resolvedKeyFn(...args);
    const now = Date.now();
    const entry = internal.get(key);

    if (entry !== undefined) {
      if (entry.expiry === null || now <= entry.expiry) {
        // Refresh recency for LRU.
        internal.delete(key);
        internal.set(key, entry);
        return entry.value;
      }
      internal.delete(key);
    }

    const value: ReturnType<T> = fn(...args);
    const expiry = ttl !== null ? now + ttl : null;

    if (internal.size >= maxSize) {
      evictExpired();
      if (internal.size >= maxSize) {
        const firstKey = internal.keys().next().value;
        if (firstKey !== undefined) internal.delete(firstKey);
      }
    }

    internal.set(key, { value, expiry });
    return value;
  } as T & { cache: Map<unknown, ReturnType<T>>; clear(): void; invalidate(...args: Parameters<T>): void };

  // Expose a Map-compatible view of cached values (without expiry metadata).
  const publicCache = new Proxy(new Map<unknown, ReturnType<T>>(), {
    get(_target, prop) {
      if (prop === 'size') return internal.size;
      if (prop === 'has') return (k: unknown) => internal.has(k);
      if (prop === 'get') return (k: unknown) => internal.get(k)?.value;
      if (prop === 'set') return (k: unknown, v: ReturnType<T>) => { internal.set(k, { value: v, expiry: null }); return publicCache; };
      if (prop === 'delete') return (k: unknown) => internal.delete(k);
      if (prop === 'clear') return () => internal.clear();
      if (prop === 'keys') return () => internal.keys();
      if (prop === 'values') {
        return () => (function* () { for (const e of internal.values()) yield e.value; })();
      }
      if (prop === 'entries') {
        return () => (function* () { for (const [k, e] of internal.entries()) yield [k, e.value] as [unknown, ReturnType<T>]; })();
      }
      if (prop === Symbol.iterator) {
        return () => (function* () { for (const [k, e] of internal.entries()) yield [k, e.value] as [unknown, ReturnType<T>]; })();
      }
      if (prop === 'forEach') {
        return (cb: (v: ReturnType<T>, k: unknown) => void) => { for (const [k, e] of internal) cb(e.value, k); };
      }
      return undefined;
    },
  });

  memoized.cache = publicCache as unknown as Map<unknown, ReturnType<T>>;

  memoized.clear = function (): void {
    internal.clear();
  };

  memoized.invalidate = function (...args: Parameters<T>): void {
    const key = resolvedKeyFn(...args);
    internal.delete(key);
  };

  return memoized;
}

// ─── memoizeTTL ──────────────────────────────────────────────────────────────

/**
 * Memoize with a Time-To-Live (TTL) expiry in milliseconds.
 * Entries are recomputed once they expire.
 */
export function memoizeTTL<T extends (...args: any[]) => any>(
  fn: T,
  ttlMs: number,
  keyFn?: (...args: Parameters<T>) => unknown,
): T & { clear(): void } {
  type Entry = { value: ReturnType<T>; expiresAt: number };
  const cache = new Map<unknown, Entry>();

  const memoized = function (...args: Parameters<T>): ReturnType<T> {
    const key = keyFn ? keyFn(...args) : args[0];
    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now < entry.expiresAt) {
      return entry.value;
    }
    const value: ReturnType<T> = fn(...args);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  } as T & { clear(): void };

  memoized.clear = () => cache.clear();
  return memoized;
}

// ─── memoizeLRU ──────────────────────────────────────────────────────────────

/**
 * Memoize with LRU (Least Recently Used) eviction.
 * When `maxSize` entries are held and a new key is seen the oldest entry is
 * dropped.
 *
 * The returned function exposes:
 *   - `.size`    — current number of cached entries (getter)
 *   - `.clear()` — evict all entries
 */
export function memoizeLRU<T extends (...args: any[]) => any>(
  fn: T,
  maxSize: number,
  keyFn?: (...args: Parameters<T>) => unknown,
): T & { clear(): void; readonly size: number } {
  // Map preserves insertion order; delete-then-re-insert tracks recency.
  const cache = new Map<unknown, ReturnType<T>>();

  const memoized = function (...args: Parameters<T>): ReturnType<T> {
    const key = keyFn ? keyFn(...args) : args[0];
    if (cache.has(key)) {
      const value = cache.get(key) as ReturnType<T>;
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    const value: ReturnType<T> = fn(...args);
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, value);
    return value;
  } as T & { clear(): void; readonly size: number };

  memoized.clear = () => cache.clear();
  Object.defineProperty(memoized, 'size', {
    get() { return cache.size; },
    enumerable: true,
    configurable: true,
  });
  return memoized;
}

// ─── debounce ─────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that delays invocation until `delayMs`
 * milliseconds have elapsed since the last call.
 *
 * The returned function exposes:
 *   - `.cancel()` — cancel any pending invocation
 *   - `.flush()`  — immediately invoke the pending call (if any)
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: Parameters<T> | undefined;

  const debounced = function (...args: Parameters<T>): void {
    pendingArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const a = pendingArgs as Parameters<T>;
      pendingArgs = undefined;
      fn(...a);
    }, delayMs);
  } as T & { cancel(): void; flush(): void };

  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingArgs = undefined;
  };

  debounced.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      const a = pendingArgs as Parameters<T>;
      pendingArgs = undefined;
      fn(...a);
    }
  };

  return debounced;
}

// ─── throttle ─────────────────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn` that is invoked at most once per
 * `intervalMs` milliseconds.  Calls during the cooldown are silently dropped.
 *
 * The returned function exposes:
 *   - `.cancel()` — reset the throttle state immediately
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  intervalMs: number,
): T & { cancel(): void } {
  let lastCall = 0;

  const throttled = function (...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    }
  } as T & { cancel(): void };

  throttled.cancel = () => { lastCall = 0; };

  return throttled;
}

// ─── once ─────────────────────────────────────────────────────────────────────

/**
 * Returns a wrapper that calls `fn` only on the very first invocation.
 * Subsequent calls return the cached result of that first call.
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;

  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  } as T;
}

// ─── retry ────────────────────────────────────────────────────────────────────

/**
 * Call `fn` up to `maxAttempts` times, returning a Promise that resolves on
 * the first success.  If all attempts fail the last error is re-thrown.
 * An optional `delayMs` introduces a pause between consecutive attempts.
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  maxAttempts: number,
  delayMs = 0,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
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
        const expiry = ttl !== null ? now + ttl : null;
        cache.set(key, { promise: Promise.resolve(result), expiry });
        return result;
      },
      (err: unknown) => {
        cache.delete(key);
        return Promise.reject(err);
      },
    );

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
