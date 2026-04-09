// ─── Object Pool ──────────────────────────────────────────────────────────────
// Generic pool for reusing expensive-to-create objects.
// Acquired objects are returned as `PooledObject<T>` with a `release()` handle.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PooledObject<T> {
  /** The pooled value. */
  value: T;
  /** Return this object to the pool. Idempotent — safe to call multiple times. */
  release(): void;
}

export interface ObjectPoolOptions<T> {
  /** Factory that creates a fresh object. */
  create: () => T;
  /** Called when an object is returned to the pool; use to reset mutable state. */
  reset?: (obj: T) => void;
  /** Maximum number of objects kept in the pool. Extras are discarded on release. */
  maxSize?: number;
  /** Number of objects to pre-create immediately. */
  initialSize?: number;
}

// ─── ObjectPool ───────────────────────────────────────────────────────────────

export class ObjectPool<T> {
  #create: () => T;
  #reset: ((obj: T) => void) | undefined;
  #maxSize: number | undefined;
  #pool: T[] = [];
  #totalCreated = 0;

  constructor(options: ObjectPoolOptions<T>) {
    this.#create = options.create;
    this.#reset = options.reset;
    this.#maxSize = options.maxSize;

    const initial = options.initialSize ?? 0;
    if (initial > 0) {
      this.prewarm(initial);
    }
  }

  /**
   * Acquire an object from the pool.
   * If the pool is empty, a new object is created.
   * The returned `PooledObject.release()` returns the object to the pool.
   */
  acquire(): PooledObject<T> {
    const obj = this.#pool.length > 0 ? this.#pool.pop()! : this.#makeNew();
    let released = false;

    return {
      value: obj,
      release: () => {
        if (released) return;
        released = true;
        this.release(obj);
      },
    };
  }

  /**
   * Explicitly return an object to the pool.
   * The `reset` callback is invoked (if configured) before the object is stored.
   * Objects exceeding `maxSize` are silently discarded.
   */
  release(obj: T): void {
    if (this.#maxSize !== undefined && this.#pool.length >= this.#maxSize) {
      return;
    }
    this.#reset?.(obj);
    this.#pool.push(obj);
  }

  /**
   * Pre-create `n` objects and add them to the pool.
   * Respects `maxSize` — objects beyond the cap are not created.
   */
  prewarm(n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.#maxSize !== undefined && this.#pool.length >= this.#maxSize) {
        break;
      }
      this.#pool.push(this.#makeNew());
    }
  }

  /** Discard all pooled objects. In-flight objects are unaffected. */
  drain(): void {
    this.#pool = [];
  }

  /** Total objects ever created by this pool. */
  get size(): number {
    return this.#totalCreated;
  }

  /** Objects currently sitting in the pool, ready to be acquired. */
  get available(): number {
    return this.#pool.length;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  #makeNew(): T {
    this.#totalCreated += 1;
    return this.#create();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory for `ObjectPool<T>`. */
export function createObjectPool<T>(options: ObjectPoolOptions<T>): ObjectPool<T> {
  return new ObjectPool(options);
}
