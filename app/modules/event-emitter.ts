// @ts-check
// ─── Event Emitter ───────────────────────────────────────────────────────────
// Typed publish-subscribe / event emitter library with full listener lifecycle
// management, once-semantics, max-listener warnings, and a factory helper.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Default map type: any string event → any argument array. */
type DefaultEvents = Record<string, unknown[]>;

// ─── EventEmitter ─────────────────────────────────────────────────────────────

/**
 * Strongly-typed publish-subscribe event emitter.
 *
 * @example
 *   interface MyEvents { data: [string, number]; done: [] }
 *   const emitter = new EventEmitter<MyEvents>();
 *   const off = emitter.on('data', (s, n) => console.log(s, n));
 *   emitter.emit('data', 'hello', 42);
 *   off(); // unsubscribe
 */
export class EventEmitter<Events extends Record<string, unknown[]> = DefaultEvents> {
  #listeners: Map<keyof Events, Array<(...args: unknown[]) => void>> = new Map();
  #maxListeners: number = 10;

  /**
   * Register a listener for the given event.
   * @returns An unsubscribe function that removes this specific listener.
   */
  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): () => void {
    let bucket = this.#listeners.get(event);
    if (bucket === undefined) {
      bucket = [];
      this.#listeners.set(event, bucket);
    }
    bucket.push(listener as (...args: unknown[]) => void);

    if (this.#maxListeners !== 0 && bucket.length > this.#maxListeners) {
      console.warn(
        `EventEmitter: possible memory leak — "${String(event)}" has ${bucket.length} listeners ` +
        `(max ${this.#maxListeners}). Use setMaxListeners() to raise the limit.`,
      );
    }

    return () => this.off(event, listener);
  }

  /**
   * Register a one-time listener. The listener is automatically removed after
   * the first time the event fires.
   * @returns An unsubscribe function that removes this listener early.
   */
  once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): () => void {
    let called = false;
    const wrapper = (...args: unknown[]): void => {
      if (called) return;
      called = true;
      this.off(event, wrapper as (...args: Events[K]) => void);
      (listener as (...args: unknown[]) => void)(...args);
    };
    return this.on(event, wrapper as (...args: Events[K]) => void);
  }

  /**
   * Remove a specific listener from an event.
   * No-op if the listener was not registered.
   */
  off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): void {
    const bucket = this.#listeners.get(event);
    if (bucket === undefined) return;

    const idx = bucket.indexOf(listener as (...args: unknown[]) => void);
    if (idx !== -1) {
      bucket.splice(idx, 1);
    }

    if (bucket.length === 0) {
      this.#listeners.delete(event);
    }
  }

  /**
   * Emit an event, calling all registered listeners synchronously.
   * @returns `true` if at least one listener was called, `false` otherwise.
   */
  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const bucket = this.#listeners.get(event);
    if (bucket === undefined || bucket.length === 0) return false;

    // Snapshot so that listeners removed during iteration are safe.
    const snapshot = bucket.slice();
    for (const listener of snapshot) {
      listener(...(args as unknown[]));
    }
    return true;
  }

  /**
   * Remove all listeners, or all listeners for a specific event.
   */
  removeAllListeners(event?: keyof Events): void {
    if (event === undefined) {
      this.#listeners.clear();
    } else {
      this.#listeners.delete(event);
    }
  }

  /**
   * Return the number of listeners registered for an event.
   */
  listenerCount(event: keyof Events): number {
    return this.#listeners.get(event)?.length ?? 0;
  }

  /**
   * Return all event names that currently have listeners.
   */
  eventNames(): (keyof Events)[] {
    return Array.from(this.#listeners.keys());
  }

  /**
   * Set the maximum number of listeners per event before a warning is emitted.
   * Default is 10. Set to 0 for unlimited (no warning).
   */
  setMaxListeners(n: number): void {
    this.#maxListeners = n;
  }

  /**
   * Return the current max-listeners threshold.
   */
  getMaxListeners(): number {
    return this.#maxListeners;
  }
}

// ─── SimpleEmitter ────────────────────────────────────────────────────────────

/**
 * A simpler emitter with plain string events and `unknown[]` payloads.
 * Convenient when full generic typing is unnecessary.
 *
 * @example
 *   const bus = new SimpleEmitter();
 *   bus.on('change', (value) => console.log(value));
 *   bus.emit('change', 42);
 */
export class SimpleEmitter {
  #inner: EventEmitter<Record<string, unknown[]>> = new EventEmitter();

  /** Register a listener. Returns an unsubscribe function. */
  on(event: string, listener: (...args: unknown[]) => void): () => void {
    return this.#inner.on(event, listener);
  }

  /** Register a one-time listener. Returns an unsubscribe function. */
  once(event: string, listener: (...args: unknown[]) => void): () => void {
    return this.#inner.once(event, listener);
  }

  /** Remove a specific listener. */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.#inner.off(event, listener);
  }

  /** Emit an event. Returns `true` if any listener was called. */
  emit(event: string, ...args: unknown[]): boolean {
    return this.#inner.emit(event, ...args);
  }

  /** Remove all listeners, or all for a specific event. */
  removeAllListeners(event?: string): void {
    this.#inner.removeAllListeners(event);
  }

  /** Number of listeners for an event. */
  listenerCount(event: string): number {
    return this.#inner.listenerCount(event);
  }

  /** All event names that have listeners. */
  eventNames(): string[] {
    return this.#inner.eventNames() as string[];
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new typed EventEmitter instance.
 *
 * @example
 *   const emitter = createEmitter<{ tick: [number] }>();
 *   emitter.on('tick', (n) => console.log(n));
 *   emitter.emit('tick', 1);
 */
export function createEmitter<Events extends Record<string, unknown[]>>(): EventEmitter<Events> {
  return new EventEmitter<Events>();
}
