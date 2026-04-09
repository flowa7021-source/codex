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
