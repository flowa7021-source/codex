// @ts-check
// ─── Ring Buffer ─────────────────────────────────────────────────────────────
// Fixed-capacity numeric ring buffer backed by a Float64Array.
// Does NOT overwrite on overflow — write returns 0 when full.

export class RingBuffer {
  #buf: Float64Array;
  #capacity: number;
  #head: number;   // index of oldest item
  #available: number; // count of readable items

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`RingBuffer: capacity must be a positive integer, got ${capacity}`);
    }
    this.#capacity = capacity;
    this.#buf = new Float64Array(capacity);
    this.#head = 0;
    this.#available = 0;
  }

  get capacity(): number { return this.#capacity; }
  get available(): number { return this.#available; }
  get free(): number { return this.#capacity - this.#available; }
  get isEmpty(): boolean { return this.#available === 0; }
  get isFull(): boolean { return this.#available === this.#capacity; }

  /**
   * Write samples into the buffer. Stops when full.
   * Returns number of samples actually written.
   */
  write(data: number[] | Float64Array): number {
    const toWrite = Math.min(data.length, this.free);
    if (toWrite === 0) return 0;
    const writeStart = (this.#head + this.#available) % this.#capacity;
    for (let i = 0; i < toWrite; i++) {
      this.#buf[(writeStart + i) % this.#capacity] = data[i];
    }
    this.#available += toWrite;
    return toWrite;
  }

  /**
   * Read up to `count` samples from the front. Removes them from the buffer.
   * Returns a Float64Array (may be shorter than count if not enough available).
   */
  read(count: number): Float64Array {
    const toRead = Math.min(count, this.#available);
    const out = new Float64Array(toRead);
    for (let i = 0; i < toRead; i++) {
      out[i] = this.#buf[(this.#head + i) % this.#capacity];
    }
    this.#head = (this.#head + toRead) % this.#capacity;
    this.#available -= toRead;
    return out;
  }

  /**
   * Peek at up to `count` samples from the front without consuming them.
   * Returns a Float64Array.
   */
  peek(count: number): Float64Array {
    const toPeek = Math.min(count, this.#available);
    const out = new Float64Array(toPeek);
    for (let i = 0; i < toPeek; i++) {
      out[i] = this.#buf[(this.#head + i) % this.#capacity];
    }
    return out;
  }

  /** Reset the buffer to empty. */
  clear(): void {
    this.#head = 0;
    this.#available = 0;
  }
}

export function createRingBuffer(capacity: number): RingBuffer {
  return new RingBuffer(capacity);
}
