// @ts-check
// ─── Channel ─────────────────────────────────────────────────────────────────
// Typed, buffered/unbuffered channels for CSP-style message passing.
// Mirrors Go's channel semantics: send blocks when the buffer is full,
// receive blocks until a value is available.

/** Resolve/reject pair for a pending send. */
interface PendingSend<T> {
  value: T;
  resolve: () => void;
  reject: (err: Error) => void;
}

/** Resolve/reject pair for a pending receive. */
interface PendingReceive<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}

/**
 * A typed, optionally-buffered channel.
 *
 * @example
 *   const ch = new Channel<number>(4);
 *   ch.trySend(1);
 *   const val = await ch.receive(); // 1
 */
export class Channel<T> {
  #buffer: T[] = [];
  #capacity: number;
  #closed = false;
  #pendingSends: PendingSend<T>[] = [];
  #pendingReceives: PendingReceive<T>[] = [];

  /**
   * @param bufferSize - 0 = unbuffered (default). Positive = buffered.
   */
  constructor(bufferSize = 0) {
    if (bufferSize < 0) throw new RangeError('bufferSize must be ≥ 0');
    this.#capacity = bufferSize;
  }

  /**
   * Send a value. Resolves immediately when buffer has space or a receiver is
   * waiting. Blocks (returns a pending Promise) when the buffer is full.
   * Throws if the channel is closed.
   */
  send(value: T): Promise<void> {
    if (this.#closed) {
      return Promise.reject(new Error('Cannot send on a closed channel'));
    }

    // If there is a pending receiver, hand off directly.
    if (this.#pendingReceives.length > 0) {
      const receiver = this.#pendingReceives.shift()!;
      receiver.resolve(value);
      return Promise.resolve();
    }

    // If there is buffer space, enqueue.
    if (this.#buffer.length < this.#capacity) {
      this.#buffer.push(value);
      return Promise.resolve();
    }

    // Otherwise, block the sender.
    return new Promise<void>((resolve, reject) => {
      this.#pendingSends.push({ value, resolve, reject });
    });
  }

  /**
   * Receive a value. Resolves immediately when a value is available.
   * Blocks until a value arrives or the channel is closed.
   * When the channel is closed and empty, rejects with a closed-channel error.
   */
  receive(): Promise<T> {
    // Drain buffer first.
    if (this.#buffer.length > 0) {
      const value = this.#buffer.shift()!;
      // Unblock a pending sender if any.
      this.#unblockSender();
      return Promise.resolve(value);
    }

    // Pull from a pending sender.
    if (this.#pendingSends.length > 0) {
      const sender = this.#pendingSends.shift()!;
      sender.resolve();
      return Promise.resolve(sender.value);
    }

    if (this.#closed) {
      return Promise.reject(new Error('Channel is closed and empty'));
    }

    // Block until a value arrives.
    return new Promise<T>((resolve, reject) => {
      this.#pendingReceives.push({ resolve, reject });
    });
  }

  /**
   * Try to send without blocking.
   * Returns true if the value was enqueued/handed-off, false if full/closed.
   */
  trySend(value: T): boolean {
    if (this.#closed) return false;

    if (this.#pendingReceives.length > 0) {
      const receiver = this.#pendingReceives.shift()!;
      receiver.resolve(value);
      return true;
    }

    if (this.#buffer.length < this.#capacity) {
      this.#buffer.push(value);
      return true;
    }

    return false;
  }

  /**
   * Try to receive without blocking.
   * Returns the value, or undefined if the channel is empty.
   */
  tryReceive(): T | undefined {
    if (this.#buffer.length > 0) {
      const value = this.#buffer.shift()!;
      this.#unblockSender();
      return value;
    }

    if (this.#pendingSends.length > 0) {
      const sender = this.#pendingSends.shift()!;
      sender.resolve();
      return sender.value;
    }

    return undefined;
  }

  /**
   * Close the channel.
   * - Pending senders are rejected.
   * - Pending receivers are rejected (channel empty).
   * - Buffered values may still be received after close.
   */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;

    // Reject all pending senders.
    for (const sender of this.#pendingSends) {
      sender.reject(new Error('Channel closed while sender was waiting'));
    }
    this.#pendingSends = [];

    // Reject pending receivers only if buffer is already empty.
    if (this.#buffer.length === 0) {
      for (const receiver of this.#pendingReceives) {
        receiver.reject(new Error('Channel is closed and empty'));
      }
      this.#pendingReceives = [];
    }
  }

  /** Move one pending sender's value into the buffer (or hand off). */
  #unblockSender(): void {
    if (this.#pendingSends.length > 0 && this.#buffer.length < this.#capacity) {
      const sender = this.#pendingSends.shift()!;
      this.#buffer.push(sender.value);
      sender.resolve();
    }
  }

  /** Whether the channel has been closed. */
  get closed(): boolean {
    return this.#closed;
  }

  /** Number of values currently buffered. */
  get buffered(): number {
    return this.#buffer.length;
  }

  /** Buffer capacity (0 = unbuffered). */
  get capacity(): number {
    return this.#capacity;
  }
}

/**
 * Select from multiple channels: returns the first value that becomes
 * available, along with its channel index.
 *
 * @param channels - Channels to select from.
 * @param timeoutMs - Optional timeout in ms. Returns null on timeout.
 */
export async function select<T>(
  channels: Channel<T>[],
  timeoutMs?: number,
): Promise<{ value: T; index: number } | null> {
  if (channels.length === 0) return null;

  // Try non-blocking first.
  for (let i = 0; i < channels.length; i++) {
    const value = channels[i].tryReceive();
    if (value !== undefined) {
      return { value, index: i };
    }
  }

  // Nothing immediately available — race blocking receives.
  return new Promise<{ value: T; index: number } | null>((resolve, reject) => {
    let settled = false;

    const settle = (result: { value: T; index: number } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs !== undefined && timeoutMs >= 0) {
      timer = setTimeout(() => settle(null), timeoutMs);
    }

    for (let i = 0; i < channels.length; i++) {
      const idx = i;
      channels[idx].receive().then(
        (value) => settle({ value, index: idx }),
        (err) => {
          // If all channels are exhausted/closed, reject.
          // For simplicity, we only propagate the first non-settled error
          // when no other channel has resolved yet.
          if (!settled) reject(err);
        },
      );
    }
  });
}

/**
 * Pipe values from one channel to another until the source closes.
 */
export async function pipe<T>(from: Channel<T>, to: Channel<T>): Promise<void> {
  while (!from.closed || from.buffered > 0) {
    let value: T;
    try {
      value = await from.receive();
    } catch {
      // source channel closed and empty
      break;
    }
    await to.send(value);
  }
}

/**
 * Fan-out: read each value from source and send it to all destinations.
 */
export async function fanOut<T>(source: Channel<T>, ...destinations: Channel<T>[]): Promise<void> {
  while (!source.closed || source.buffered > 0) {
    let value: T;
    try {
      value = await source.receive();
    } catch {
      break;
    }
    await Promise.all(destinations.map(dest => dest.send(value)));
  }
}
