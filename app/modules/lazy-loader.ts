// @ts-check
// ─── Lazy Loader ─────────────────────────────────────────────────────────────
// Lazy initialization and deferred value loading utilities.
// Provides synchronous and async lazy-initialized values and maps.

// ─── Lazy ─────────────────────────────────────────────────────────────────────

/**
 * A value that is computed once on first access and cached for all subsequent
 * accesses. Computation can be reset to force recomputation on next access.
 *
 * @template T - Value type
 *
 * @example
 *   const config = new Lazy(() => loadConfig());
 *   config.value; // calls loadConfig() once
 *   config.value; // returns cached result
 */
export class Lazy<T> {
  #fn: () => T;
  #value: T | undefined = undefined;
  #initialized = false;

  constructor(fn: () => T) {
    this.#fn = fn;
  }

  /** Get the value, computing it if not yet initialized. */
  get value(): T {
    if (!this.#initialized) {
      this.#value = this.#fn();
      this.#initialized = true;
    }
    return this.#value as T;
  }

  /** Whether the value has been computed. */
  get initialized(): boolean {
    return this.#initialized;
  }

  /** Reset, forcing recomputation on next access. */
  reset(): void {
    this.#value = undefined;
    this.#initialized = false;
  }
}

// ─── AsyncLazy ────────────────────────────────────────────────────────────────

/**
 * Async version of {@link Lazy}: computed once on first `get()` call.
 * Concurrent calls share the same in-flight promise so the factory is invoked
 * exactly once even when multiple callers race.
 *
 * @template T - Value type
 *
 * @example
 *   const settings = new AsyncLazy(() => fetchSettings());
 *   const s1 = await settings.get(); // calls fetchSettings() once
 *   const s2 = await settings.get(); // returns cached result
 */
export class AsyncLazy<T> {
  #fn: () => Promise<T>;
  #value: T | undefined = undefined;
  #promise: Promise<T> | undefined = undefined;
  #initialized = false;

  constructor(fn: () => Promise<T>) {
    this.#fn = fn;
  }

  /**
   * Get the value, computing it if needed.
   * Concurrent calls share the same promise so the factory is called only once.
   */
  get(): Promise<T> {
    if (this.#initialized) {
      return Promise.resolve(this.#value as T);
    }
    if (this.#promise === undefined) {
      this.#promise = this.#fn().then((value) => {
        this.#value = value;
        this.#initialized = true;
        this.#promise = undefined;
        return value;
      });
    }
    return this.#promise;
  }

  /** Whether the value has been computed and cached. */
  get initialized(): boolean {
    return this.#initialized;
  }

  /** Reset, forcing recomputation on next access. */
  reset(): void {
    this.#value = undefined;
    this.#promise = undefined;
    this.#initialized = false;
  }
}

// ─── LazyMap ──────────────────────────────────────────────────────────────────

/**
 * Lazy map: compute values on demand and cache them.
 * Each key is computed at most once using the provided `compute` function,
 * unless explicitly invalidated.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const map = new LazyMap((id) => loadUser(id));
 *   map.get('alice'); // calls loadUser('alice')
 *   map.get('alice'); // returns cached result
 */
export class LazyMap<K, V> {
  #compute: (key: K) => V;
  #cache: Map<K, V> = new Map();

  constructor(compute: (key: K) => V) {
    this.#compute = compute;
  }

  /** Get value for key, computing and caching it if not already present. */
  get(key: K): V {
    if (!this.#cache.has(key)) {
      this.#cache.set(key, this.#compute(key));
    }
    return this.#cache.get(key) as V;
  }

  /** Whether a cached value exists for the given key. */
  has(key: K): boolean {
    return this.#cache.has(key);
  }

  /** Remove the cached value for a key, forcing recomputation on next access. */
  invalidate(key: K): void {
    this.#cache.delete(key);
  }

  /** Remove all cached values. */
  invalidateAll(): void {
    this.#cache.clear();
  }

  /** Number of currently cached entries. */
  size(): number {
    return this.#cache.size;
  }
}

// ─── AsyncLazyMap ─────────────────────────────────────────────────────────────

/**
 * Async lazy map: compute values asynchronously on demand and cache them.
 * Concurrent calls for the same key share the same in-flight promise so the
 * factory is invoked exactly once per key until invalidated.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const map = new AsyncLazyMap((id) => fetchUser(id));
 *   const user = await map.get('alice'); // calls fetchUser('alice')
 *   const same = await map.get('alice'); // returns cached result
 */
export class AsyncLazyMap<K, V> {
  #compute: (key: K) => Promise<V>;
  #cache: Map<K, V> = new Map();
  #inflight: Map<K, Promise<V>> = new Map();

  constructor(compute: (key: K) => Promise<V>) {
    this.#compute = compute;
  }

  /**
   * Get value for key, computing and caching it if not already present.
   * Concurrent calls for the same key share the same in-flight promise.
   */
  get(key: K): Promise<V> {
    if (this.#cache.has(key)) {
      return Promise.resolve(this.#cache.get(key) as V);
    }
    if (this.#inflight.has(key)) {
      return this.#inflight.get(key) as Promise<V>;
    }
    const promise = this.#compute(key).then((value) => {
      this.#cache.set(key, value);
      this.#inflight.delete(key);
      return value;
    });
    this.#inflight.set(key, promise);
    return promise;
  }

  /** Whether a cached value exists for the given key. */
  has(key: K): boolean {
    return this.#cache.has(key);
  }

  /** Remove the cached value for a key, forcing recomputation on next access. */
  invalidate(key: K): void {
    this.#cache.delete(key);
    this.#inflight.delete(key);
  }

  /** Remove all cached values and cancel any in-flight tracking. */
  invalidateAll(): void {
    this.#cache.clear();
    this.#inflight.clear();
  }
}
