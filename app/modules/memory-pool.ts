// ─── Memory Pool ──────────────────────────────────────────────────────────────
// Fixed-size block allocator for efficient ArrayBuffer reuse.
// Avoids GC pressure by recycling identically-sized buffers.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryPoolOptions {
  /** Size of each block in bytes. */
  blockSize: number;
  /** Number of blocks to pre-allocate on construction. */
  initialBlocks?: number;
  /** Hard cap on total blocks the pool may hold. */
  maxBlocks?: number;
}

// ─── MemoryPool ───────────────────────────────────────────────────────────────

export class MemoryPool {
  #blockSize: number;
  #maxBlocks: number | undefined;
  #pool: ArrayBuffer[] = [];
  #totalAllocated = 0;

  constructor(options: MemoryPoolOptions) {
    if (options.blockSize <= 0) {
      throw new RangeError('blockSize must be positive');
    }
    this.#blockSize = options.blockSize;
    this.#maxBlocks = options.maxBlocks;

    const initial = options.initialBlocks ?? 0;
    if (initial > 0) {
      this.grow(initial);
    }
  }

  /**
   * Allocate a block from the pool.
   * Returns `null` when `maxBlocks` is set and has been reached.
   */
  allocate(): ArrayBuffer | null {
    if (this.#pool.length > 0) {
      return this.#pool.pop()!;
    }

    if (this.#maxBlocks !== undefined && this.#totalAllocated >= this.#maxBlocks) {
      return null;
    }

    this.#totalAllocated += 1;
    return new ArrayBuffer(this.#blockSize);
  }

  /**
   * Return a previously allocated block to the pool.
   * Blocks that exceed `maxBlocks` are silently discarded.
   */
  free(buffer: ArrayBuffer): void {
    if (this.#maxBlocks !== undefined && this.#pool.length >= this.#maxBlocks) {
      return;
    }
    this.#pool.push(buffer);
  }

  /**
   * Allocate `n` additional blocks and add them to the available pool.
   * Respects `maxBlocks` — extra blocks beyond the cap are not created.
   */
  grow(n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.#maxBlocks !== undefined && this.#totalAllocated >= this.#maxBlocks) {
        break;
      }
      this.#pool.push(new ArrayBuffer(this.#blockSize));
      this.#totalAllocated += 1;
    }
  }

  /** Clear the pool — all recycled blocks are discarded. */
  clear(): void {
    this.#pool = [];
    this.#totalAllocated = 0;
  }

  /** Total blocks ever allocated (both in-use and pooled). */
  get size(): number {
    return this.#totalAllocated;
  }

  /** Blocks currently sitting in the pool, ready to be allocated. */
  get available(): number {
    return this.#pool.length;
  }

  /** Blocks currently checked out (allocated but not yet freed). */
  get used(): number {
    return this.#totalAllocated - this.#pool.length;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory for `MemoryPool`. */
export function createMemoryPool(options: MemoryPoolOptions): MemoryPool {
  return new MemoryPool(options);
}

// ─── ObjectPool ──────────────────────────────────────────────────────────────

export interface PoolOptions<T> {
  /** Factory to create a new object. */
  create: () => T;
  /** Reset object for reuse (called when releasing back to pool). */
  reset?: (obj: T) => void;
  /** Initial pool size. */
  initialSize?: number;
  /** Max pool size (excess objects are discarded). */
  maxSize?: number;
}

export class ObjectPool<T> {
  #create: () => T;
  #reset: ((obj: T) => void) | undefined;
  #maxSize: number;
  #pool: T[] = [];
  #created: number = 0;
  #inUse: number = 0;

  constructor(options: PoolOptions<T>) {
    this.#create = options.create;
    this.#reset = options.reset;
    this.#maxSize = options.maxSize ?? Infinity;

    const initialSize = options.initialSize ?? 0;
    for (let i = 0; i < initialSize; i++) {
      this.#pool.push(this.#create());
      this.#created++;
    }
  }

  /** Acquire an object from the pool (creates new if empty). */
  acquire(): T {
    let obj: T;
    if (this.#pool.length > 0) {
      obj = this.#pool.pop() as T;
    } else {
      obj = this.#create();
      this.#created++;
    }
    this.#inUse++;
    return obj;
  }

  /** Release an object back to the pool. */
  release(obj: T): void {
    if (this.#inUse > 0) {
      this.#inUse--;
    }
    if (this.#pool.length < this.#maxSize) {
      if (this.#reset) {
        this.#reset(obj);
      }
      this.#pool.push(obj);
    }
    // Discard excess objects silently
  }

  /** Current number of available objects in pool. */
  get available(): number {
    return this.#pool.length;
  }

  /** Total objects ever created. */
  get created(): number {
    return this.#created;
  }

  /** Total objects currently acquired (in use). */
  get inUse(): number {
    return this.#inUse;
  }

  /** Drain and discard all pooled objects. */
  drain(): void {
    this.#pool.length = 0;
  }
}

// ─── TypedArrayPool ──────────────────────────────────────────────────────────

type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Uint8ArrayConstructor
  | Int32ArrayConstructor;

type TypedArrayInstance = Float32Array | Uint8Array | Int32Array;

/** Typed array pool for reusing Float32Array/Uint8Array/Int32Array etc. */
export class TypedArrayPool {
  #ArrayType: TypedArrayConstructor;
  #size: number;
  #pool: TypedArrayInstance[] = [];

  constructor(
    ArrayType: Float32ArrayConstructor | Uint8ArrayConstructor | Int32ArrayConstructor,
    size: number,
  ) {
    this.#ArrayType = ArrayType;
    this.#size = size;
  }

  acquire(): Float32Array | Uint8Array | Int32Array {
    if (this.#pool.length > 0) {
      return this.#pool.pop() as TypedArrayInstance;
    }
    return new this.#ArrayType(this.#size);
  }

  release(arr: Float32Array | Uint8Array | Int32Array): void {
    this.#pool.push(arr);
  }

  get available(): number {
    return this.#pool.length;
  }
}
