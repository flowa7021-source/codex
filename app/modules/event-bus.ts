// @ts-check
// ─── Event Bus ───────────────────────────────────────────────────────────────
// Typed publish/subscribe event bus. Provides a global singleton and a factory
// function for creating isolated bus instances.
//
// Also re-exports a backward-compatible functional API used by existing modules.

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventMap = Record<string, unknown>;

type Handler<T> = (payload: T) => void;

// ─── EventBus class ──────────────────────────────────────────────────────────

/**
 * Typed event bus supporting on/once/emit/off and listener introspection.
 *
 * @template T - Map of event name → payload type
 *
 * @example
 *   type MyEvents = { loaded: string; count: number };
 *   const bus = new EventBus<MyEvents>();
 *   const unsub = bus.on('loaded', (msg) => console.log(msg));
 *   bus.emit('loaded', 'hello');
 *   unsub();
 */
export class EventBus<T extends EventMap = EventMap> {
  #handlers = new Map<keyof T, Set<Handler<unknown>>>();

  // ─── on ──────────────────────────────────────────────────────────────────

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   *
   * @param event   - Event name
   * @param handler - Called with the emitted payload
   * @returns Unsubscribe function — call it to remove this handler
   */
  on<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set?.delete(handler as Handler<unknown>);
    };
  }

  // ─── once ────────────────────────────────────────────────────────────────

  /**
   * Subscribe once. Auto-unsubscribes after the first emission.
   *
   * @param event   - Event name
   * @param handler - Called at most once
   * @returns Unsubscribe function — call it to cancel before the first emission
   */
  once<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
    const wrapper = (payload: T[K]) => {
      unsub();
      handler(payload);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  // ─── emit ────────────────────────────────────────────────────────────────

  /**
   * Emit an event, calling all registered handlers synchronously.
   *
   * @param event   - Event name
   * @param payload - Value passed to every handler
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const set = this.#handlers.get(event);
    if (!set) return;
    // Snapshot to avoid mutation during iteration
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  // ─── off ─────────────────────────────────────────────────────────────────

  /**
   * Remove all handlers for a specific event, or all handlers if no event given.
   *
   * @param event - Event name (optional). Omit to remove all handlers everywhere.
   */
  off<K extends keyof T>(event?: K): void {
    if (event === undefined) {
      this.#handlers.clear();
    } else {
      this.#handlers.delete(event);
    }
  }

  // ─── listenerCount ───────────────────────────────────────────────────────

  /**
   * Number of handlers for a specific event, or total across all events.
   *
   * @param event - Event name (optional). Omit for total.
   */
  listenerCount<K extends keyof T>(event?: K): number {
    if (event === undefined) {
      let total = 0;
      for (const set of this.#handlers.values()) total += set.size;
      return total;
    }
    return this.#handlers.get(event)?.size ?? 0;
  }

  // ─── eventNames ──────────────────────────────────────────────────────────

  /**
   * Returns all event names that currently have at least one handler.
   */
  eventNames(): (keyof T)[] {
    return [...this.#handlers.keys()].filter(
      (k) => (this.#handlers.get(k)?.size ?? 0) > 0,
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a new EventBus instance.
 *
 * @example
 *   const bus = createEventBus<{ ping: void }>();
 */
export function createEventBus<T extends EventMap>(): EventBus<T> {
  return new EventBus<T>();
}

// ─── Global singleton ────────────────────────────────────────────────────────

/** Global default event bus instance shared across the application. */
export const globalBus: EventBus = new EventBus();

// ─── Backward-compatible functional API ──────────────────────────────────────
// These exports preserve the existing API used by app.js and other modules.

const _bus = new EventTarget();

let _listeners: Array<{ event: string; wrapper: EventListener }> = [];

/**
 * Emit a named event with optional detail payload.
 * @param event - Event name, e.g. 'ocr:page-done', 'file:opened'
 */
export function emit(event: string, detail?: unknown): void {
  _bus.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Subscribe to a named event.
 * @returns unsubscribe function
 */
export function on(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper);
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe to a named event, but only fire once.
 * @returns unsubscribe function
 */
export function once(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper, { once: true });
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe with tracking for bulk removal.
 * @returns unsubscribe
 */
export function subscribe(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper);
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Remove all tracked subscriptions.
 */
export function removeAllListeners(): void {
  const toRemove = [..._listeners];
  _listeners = [];
  for (const { event, wrapper } of toRemove) {
    _bus.removeEventListener(event, wrapper);
  }
}
