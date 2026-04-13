// @ts-check
// ─── Resource Pool ───────────────────────────────────────────────────────────
// Generic object pool for reusing expensive-to-create resources.
// Useful for canvas contexts, worker threads, or network connections.

// ─── ResourcePool ────────────────────────────────────────────────────────────

interface PoolOptions<T> {
  create: () => T | Promise<T>;
  destroy?: (resource: T) => void;
  maxSize?: number;
  minSize?: number;
  validate?: (resource: T) => boolean;
}

/**
 * A generic object pool for reusing expensive-to-create resources.
 *
 * Maintains a set of idle resources available for immediate checkout.
 * When all resources are in use and the pool is at capacity, new `acquire()`
 * calls wait in a FIFO queue until a resource is released.
 *
 * @template T - The resource type managed by this pool.
 *
 * @example
 *   const pool = createPool({
 *     create: () => new OffscreenCanvas(1, 1).getContext('2d'),
 *     maxSize: 4,
 *   });
 *   const ctx = await pool.acquire();
 *   try { drawPage(ctx); } finally { pool.release(ctx); }
 */
export class ResourcePool<T> {
  readonly #create: () => T | Promise<T>;
  readonly #destroy: ((resource: T) => void) | undefined;
  readonly #maxSize: number;
  readonly #minSize: number;
  readonly #validate: ((resource: T) => boolean) | undefined;

  #idle: T[] = [];
  #inUse: Set<T> = new Set();
  #waiters: Array<(resource: T) => void> = [];
  #drained = false;

  constructor(options: PoolOptions<T>) {
    this.#create = options.create;
    this.#destroy = options.destroy;
    this.#maxSize = options.maxSize ?? 10;
    this.#minSize = options.minSize ?? 0;
    this.#validate = options.validate;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Current number of available (idle) resources. */
  get available(): number {
    return this.#idle.length;
  }

  /** Current total resources (idle + in-use). */
  get total(): number {
    return this.#idle.length + this.#inUse.size;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Acquire a resource from the pool.
   * If an idle resource is available it is returned immediately.
   * If the pool is not yet at capacity a new resource is created.
   * Otherwise the call waits until a resource is released.
   */
  acquire(): Promise<T> {
    // Try to get a valid idle resource
    while (this.#idle.length > 0) {
      const resource = this.#idle.pop() as T;
      if (this.#validate && !this.#validate(resource)) {
        this.#destroy?.(resource);
        continue;
      }
      this.#inUse.add(resource);
      return Promise.resolve(resource);
    }

    // Can we create a new one?
    if (this.total < this.#maxSize) {
      return Promise.resolve(this.#create()).then((resource) => {
        this.#inUse.add(resource);
        return resource;
      });
    }

    // Wait for a release
    return new Promise<T>((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  /**
   * Release a resource back to the pool.
   * If waiters are queued the resource is handed off directly.
   * If the resource fails validation it is destroyed and a new one is created
   * for the next waiter (or returned to idle).
   */
  release(resource: T): void {
    if (!this.#inUse.has(resource)) return;
    this.#inUse.delete(resource);

    // Validate before returning to pool
    const valid = !this.#validate || this.#validate(resource);
    if (!valid) {
      this.#destroy?.(resource);
      // If there are waiters, create a replacement
      if (this.#waiters.length > 0) {
        const resolve = this.#waiters.shift()!;
        Promise.resolve(this.#create()).then((fresh) => {
          this.#inUse.add(fresh);
          resolve(fresh);
        });
      }
      return;
    }

    // Hand off to a waiter directly
    if (this.#waiters.length > 0) {
      const resolve = this.#waiters.shift()!;
      this.#inUse.add(resource);
      resolve(resource);
      return;
    }

    this.#idle.push(resource);
  }

  /**
   * Execute a function with a pooled resource, releasing it automatically
   * when the function returns (or throws).
   */
  async use<R>(fn: (resource: T) => R | Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }

  /**
   * Drain the pool: destroy all idle resources immediately and resolve once
   * all in-use resources have been released.
   */
  drain(): Promise<void> {
    // Destroy idle resources
    for (const resource of this.#idle) {
      this.#destroy?.(resource);
    }
    this.#idle = [];

    if (this.#inUse.size === 0) {
      return Promise.resolve();
    }

    // Wait for all in-use resources to be released
    return new Promise<void>((resolve) => {
      this.#drained = false;
      const check = () => {
        if (this.#inUse.size === 0) {
          resolve();
        }
      };
      // Patch release to notify drain when the last resource is returned
      const origRelease = this.release.bind(this);
      this.release = (resource: T) => {
        origRelease(resource);
        check();
      };
      check();
    });
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a resource pool.
 *
 * @example
 *   const pool = createPool({ create: () => new Worker('./worker.js'), maxSize: 4 });
 */
export function createPool<T>(
  options: ConstructorParameters<typeof ResourcePool<T>>[0],
): ResourcePool<T> {
  return new ResourcePool<T>(options);
}
