// ─── Message Queue ───────────────────────────────────────────────────────────
// Priority message queue with dead-letter handling and concurrency control.

// ─── ID generation ───────────────────────────────────────────────────────────

let _msgCounter = 0;

function generateMsgId(): string {
  _msgCounter += 1;
  return `msg-${Date.now()}-${_msgCounter}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueueMessage<T> {
  id: string;
  payload: T;
  priority: number;
  timestamp: number;
  retries: number;
}

export interface MessageQueueOptions {
  maxSize?: number;
  processConcurrency?: number;
  maxRetries?: number;
}

// ─── MessageQueue ─────────────────────────────────────────────────────────────

/**
 * A priority message queue that processes messages highest-priority-first.
 *
 * @example
 *   const queue = createMessageQueue<string>({ maxSize: 100 });
 *   queue.enqueue('hello', 5);
 *   queue.enqueue('world', 10); // higher priority
 *   await queue.process(async (msg) => console.log(msg.payload)); // 'world', then 'hello'
 */
export class MessageQueue<T> {
  #queue: QueueMessage<T>[] = [];
  #maxSize: number;
  #processConcurrency: number;
  #maxRetries: number;
  #deadLetterHandler: ((msg: QueueMessage<T>, err: Error) => void) | undefined;

  constructor(options?: MessageQueueOptions) {
    this.#maxSize = options?.maxSize ?? Infinity;
    this.#processConcurrency = options?.processConcurrency ?? 1;
    this.#maxRetries = options?.maxRetries ?? 3;
  }

  /**
   * Enqueue a message with optional priority (higher number = higher priority).
   * @returns The generated message id.
   * @throws If the queue is at maximum capacity.
   */
  enqueue(payload: T, priority: number = 0): string {
    if (this.#queue.length >= this.#maxSize) {
      throw new Error(
        `Queue is full (maxSize=${this.#maxSize}). Cannot enqueue new message.`,
      );
    }

    const msg: QueueMessage<T> = {
      id: generateMsgId(),
      payload,
      priority,
      timestamp: Date.now(),
      retries: 0,
    };

    // Insert in priority order (highest priority first)
    let insertAt = this.#queue.length;
    for (let i = 0; i < this.#queue.length; i++) {
      if (priority > this.#queue[i].priority) {
        insertAt = i;
        break;
      }
    }
    this.#queue.splice(insertAt, 0, msg);

    return msg.id;
  }

  /**
   * Dequeue the highest-priority message (ties broken by insertion/FIFO order).
   * Returns undefined if the queue is empty.
   */
  dequeue(): QueueMessage<T> | undefined {
    return this.#queue.shift();
  }

  /**
   * Peek at the highest-priority message without removing it.
   * Returns undefined if the queue is empty.
   */
  peek(): QueueMessage<T> | undefined {
    return this.#queue[0];
  }

  /**
   * Process all messages currently in the queue using the provided handler.
   * Respects processConcurrency — up to N messages are processed simultaneously.
   * Failed messages are retried up to maxRetries times; after that they go to
   * the dead-letter handler (if registered).
   */
  async process(handler: (msg: QueueMessage<T>) => Promise<void>): Promise<void> {
    // Snapshot the current queue contents
    const toProcess = this.#queue.splice(0, this.#queue.length);

    const concurrency = Math.max(1, this.#processConcurrency);
    const pending = [...toProcess];

    const runOne = async (msg: QueueMessage<T>): Promise<void> => {
      try {
        await handler(msg);
      } catch (err) {
        msg.retries += 1;
        if (msg.retries <= this.#maxRetries) {
          // Re-insert for retry
          this.#queue.push(msg);
        } else if (this.#deadLetterHandler) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.#deadLetterHandler(msg, error);
        }
      }
    };

    // Process in concurrency-limited batches
    while (pending.length > 0) {
      const batch = pending.splice(0, concurrency);
      await Promise.all(batch.map(runOne));
    }
  }

  /**
   * Return the number of messages currently in the queue.
   */
  size(): number {
    return this.#queue.length;
  }

  /**
   * Remove all messages from the queue.
   */
  clear(): void {
    this.#queue = [];
  }

  /**
   * Register a dead-letter handler called when a message exceeds maxRetries.
   */
  onDeadLetter(handler: (msg: QueueMessage<T>, err: Error) => void): void {
    this.#deadLetterHandler = handler;
  }
}

/**
 * Create a new MessageQueue.
 */
export function createMessageQueue<T>(options?: MessageQueueOptions): MessageQueue<T> {
  return new MessageQueue<T>(options);
}
