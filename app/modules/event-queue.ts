// @ts-check
// ─── Event Queue ─────────────────────────────────────────────────────────────
// Priority-ordered event queue with configurable size limits and clock.
// Higher priority values are dequeued first; ties are broken by insertion order
// (FIFO among equal-priority events).

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedEvent<T> {
  type: string;
  payload: T;
  priority?: number;
  timestamp: number;
}

export interface EventQueueOptions {
  /** Maximum number of events held in the queue (default: unlimited). */
  maxSize?: number;
  /** Custom clock function (default: `Date.now`). Useful for deterministic tests. */
  clock?: () => number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Resolved priority: events without an explicit priority default to 0. */
function effectivePriority<T>(event: QueuedEvent<T>): number {
  return event.priority ?? 0;
}

// ─── EventQueue ───────────────────────────────────────────────────────────────

/**
 * A priority queue for typed events.
 * Higher `priority` values are dequeued first.
 * Events with equal priority are dequeued in insertion (FIFO) order.
 *
 * @example
 *   const q = new EventQueue<string>();
 *   q.enqueue('low',  'payload-a', 0);
 *   q.enqueue('high', 'payload-b', 10);
 *   q.dequeue(); // → { type: 'high', … }
 */
export class EventQueue<T = unknown> {
  #events: QueuedEvent<T>[] = [];
  #maxSize: number;
  #clock: () => number;

  constructor(options?: EventQueueOptions) {
    this.#maxSize = options?.maxSize ?? Infinity;
    this.#clock = options?.clock ?? Date.now;
  }

  /**
   * Add an event to the queue.
   * If `maxSize` is set and the queue is full the oldest lowest-priority event
   * is silently dropped to make room.
   */
  enqueue(type: string, payload: T, priority?: number): void {
    const event: QueuedEvent<T> = {
      type,
      payload,
      priority,
      timestamp: this.#clock(),
    };

    this.#events.push(event);

    // Enforce size limit by dropping the tail (lowest-priority) entry after
    // a stable sort. Using splice(0, 1) on the sorted array drops the lowest.
    if (this.#events.length > this.#maxSize) {
      // Sort descending so index 0 = highest, last = lowest priority
      this.#stableSort();
      this.#events.pop(); // remove the lowest-priority (last after sort)
    }
  }

  /**
   * Remove and return the highest-priority event.
   * Ties in priority are broken by insertion order (earliest first).
   * Returns `null` when the queue is empty.
   */
  dequeue(): QueuedEvent<T> | null {
    if (this.#events.length === 0) return null;
    this.#stableSort();
    return this.#events.shift() ?? null;
  }

  /**
   * Inspect the next event to be dequeued without removing it.
   * Returns `null` when the queue is empty.
   */
  peek(): QueuedEvent<T> | null {
    if (this.#events.length === 0) return null;
    this.#stableSort();
    return this.#events[0];
  }

  /** Current number of queued events. */
  get size(): number {
    return this.#events.length;
  }

  /** `true` when no events are queued. */
  get isEmpty(): boolean {
    return this.#events.length === 0;
  }

  /** Remove all queued events. */
  clear(): void {
    this.#events = [];
  }

  /**
   * Remove and return all events in priority order (highest first).
   * The queue is empty after this call.
   */
  drainAll(): QueuedEvent<T>[] {
    this.#stableSort();
    const all = this.#events.slice();
    this.#events = [];
    return all;
  }

  /**
   * Return events matching `predicate` **without** removing them.
   * The returned array is in priority order.
   */
  filter(predicate: (event: QueuedEvent<T>) => boolean): QueuedEvent<T>[] {
    this.#stableSort();
    return this.#events.filter(predicate);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Sort `#events` in-place: descending priority, stable (preserving insertion
   * order among ties).  JavaScript's Array.prototype.sort is guaranteed stable
   * in modern engines (ECMAScript 2019+), so a single comparison is enough.
   */
  #stableSort(): void {
    this.#events.sort(
      (a, b) => effectivePriority(b) - effectivePriority(a),
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new {@link EventQueue}. */
export function createEventQueue<T>(options?: EventQueueOptions): EventQueue<T> {
  return new EventQueue<T>(options);
}
