// @ts-check
// ─── Ring Buffer ────────────────────────────────────────────────────────────
// A typed ring buffer backed by Float64Array for numeric data.
// Designed for audio/signal processing use cases where bulk read/write
// of floating-point samples is the primary access pattern.

// ─── RingBuffer ─────────────────────────────────────────────────────────────

/**
 * A fixed-capacity ring buffer for numeric (Float64) data.
 *
 * Unlike {@link CircularBuffer}, this buffer does **not** overwrite on full —
 * `write()` only writes as many values as free space allows. Data is stored in
 * a contiguous `Float64Array` and accessed via bulk `read()` / `peek()` calls,
 * making it suitable for audio buffers, DSP pipelines, and signal capture.
 *
 * @example
 *   const rb = new RingBuffer(1024);
 *   rb.write(new Float64Array([1, 2, 3]));
 *   const chunk = rb.read(2); // Float64Array [1, 2]
 */
export class RingBuffer {
  readonly #capacity: number;
  readonly #buffer: Float64Array;
  #head = 0;   // index of first readable element
  #size = 0;   // number of readable elements

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Capacity must be a positive integer');
    }
    this.#capacity = capacity;
    this.#buffer = new Float64Array(capacity);
  }

  // ─── Capacity / status ──────────────────────────────────────────────────

  /** Maximum number of samples the buffer can hold. */
  get capacity(): number {
    return this.#capacity;
  }

  /** Number of samples available for reading. */
  get available(): number {
    return this.#size;
  }

  /** Number of samples that can be written before the buffer is full. */
  get free(): number {
    return this.#capacity - this.#size;
  }

  /** Whether the buffer has no free space. */
  get isFull(): boolean {
    return this.#size === this.#capacity;
  }

  /** Whether the buffer contains no readable samples. */
  get isEmpty(): boolean {
    return this.#size === 0;
  }

  // ─── Write ──────────────────────────────────────────────────────────────

  /**
   * Write samples into the buffer.
   *
   * Only as many values as `free` space allows will be written.
   * Returns the number of samples actually written.
   */
  write(values: Float64Array | number[]): number {
    const toWrite = Math.min(values.length, this.free);
    if (toWrite === 0) return 0;

    const writeStart = (this.#head + this.#size) % this.#capacity;

    // How many fit before we wrap around to index 0?
    const firstChunk = Math.min(toWrite, this.#capacity - writeStart);
    for (let i = 0; i < firstChunk; i++) {
      this.#buffer[writeStart + i] = values[i];
    }

    // Remaining values wrap to the beginning of the backing array.
    const secondChunk = toWrite - firstChunk;
    for (let i = 0; i < secondChunk; i++) {
      this.#buffer[i] = values[firstChunk + i];
    }

    this.#size += toWrite;
    return toWrite;
  }

  // ─── Read ───────────────────────────────────────────────────────────────

  /**
   * Read and remove up to `count` samples from the buffer.
   *
   * Returns a new `Float64Array` containing the consumed samples.
   * The returned length may be less than `count` if fewer samples are available.
   */
  read(count: number): Float64Array {
    const toRead = Math.min(count, this.#size);
    const result = this.#copy(toRead);
    this.#head = (this.#head + toRead) % this.#capacity;
    this.#size -= toRead;
    return result;
  }

  /**
   * Peek at up to `count` samples without removing them.
   *
   * Returns a new `Float64Array` snapshot. The returned length may be less than
   * `count` if fewer samples are available.
   */
  peek(count: number): Float64Array {
    const toRead = Math.min(count, this.#size);
    return this.#copy(toRead);
  }

  // ─── Mutation ───────────────────────────────────────────────────────────

  /** Discard all samples and reset the buffer to empty. */
  clear(): void {
    this.#head = 0;
    this.#size = 0;
    // No need to zero the backing array — data past #size is unreachable.
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  /** Copy `count` samples starting at #head into a new Float64Array. */
  #copy(count: number): Float64Array {
    const result = new Float64Array(count);
    const firstChunk = Math.min(count, this.#capacity - this.#head);
    for (let i = 0; i < firstChunk; i++) {
      result[i] = this.#buffer[this.#head + i];
    }
    const secondChunk = count - firstChunk;
    for (let i = 0; i < secondChunk; i++) {
      result[firstChunk + i] = this.#buffer[i];
    }
    return result;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a typed ring buffer for numeric data.
 *
 * @example
 *   const rb = createRingBuffer(4096);
 */
export function createRingBuffer(capacity: number): RingBuffer {
  return new RingBuffer(capacity);
}
