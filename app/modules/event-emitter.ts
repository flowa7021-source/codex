// ─── Typed Event Emitter ─────────────────────────────────────────────────────
// A typed event emitter supporting on, once, off, and emit.
// Generic over a TEvents map so callers get full argument type-checking.

// @ts-check

/**
 * A typed event emitter supporting 'on', 'once', 'off', 'emit'.
 *
 * @example
 *   type MyEvents = { data: [string, number]; done: [] };
 *   const emitter = new EventEmitter<MyEvents>();
 *   emitter.on('data', (msg, count) => console.log(msg, count));
 *   emitter.emit('data', 'hello', 42);
 */
export class EventEmitter<TEvents extends Record<string, any[]> = Record<string, any[]>> {
  private _listeners: Map<string, Array<(...args: any[]) => void>>;

  constructor() {
    this._listeners = new Map();
  }

  /**
   * Register a listener for an event. Returns `this` for chaining.
   */
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this {
    const key = event as string;
    let arr = this._listeners.get(key);
    if (!arr) {
      arr = [];
      this._listeners.set(key, arr);
    }
    arr.push(listener as (...args: any[]) => void);
    return this;
  }

  /**
   * Register a one-shot listener (auto-removed after first call). Returns `this`.
   */
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this {
    const wrapper = (...args: TEvents[K]) => {
      this.off(event, wrapper as (...args: TEvents[K]) => void);
      listener(...args);
    };
    return this.on(event, wrapper as (...args: TEvents[K]) => void);
  }

  /**
   * Remove a specific listener for an event.
   */
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this {
    const key = event as string;
    const arr = this._listeners.get(key);
    if (!arr) return this;

    const idx = arr.indexOf(listener as (...args: any[]) => void);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
    if (arr.length === 0) {
      this._listeners.delete(key);
    }
    return this;
  }

  /**
   * Emit an event with arguments. Returns true if any listeners were called.
   */
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean {
    const key = event as string;
    const arr = this._listeners.get(key);
    if (!arr || arr.length === 0) return false;

    // Snapshot to avoid mutation issues if a listener calls off()
    for (const listener of arr.slice()) {
      listener(...args);
    }
    return true;
  }

  /**
   * Remove all listeners for a specific event, or all events if no event given.
   */
  removeAllListeners(event?: keyof TEvents): this {
    if (event === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(event as string);
    }
    return this;
  }

  /**
   * Get the number of listeners for a specific event.
   */
  listenerCount(event: keyof TEvents): number {
    return this._listeners.get(event as string)?.length ?? 0;
  }

  /**
   * Get all event names that have listeners.
   */
  eventNames(): (keyof TEvents)[] {
    return Array.from(this._listeners.keys()) as (keyof TEvents)[];
  }
}

/**
 * Create a new EventEmitter instance.
 */
export function createEventEmitter<T extends Record<string, any[]>>(): EventEmitter<T> {
  return new EventEmitter<T>();
}
