// ─── Publish / Subscribe ─────────────────────────────────────────────────────
// Channel/topic-based publish-subscribe system.
// Decouples producers from consumers without direct references.

// @ts-check

/**
 * A channel/topic-based publish-subscribe system.
 *
 * @example
 *   const ps = new PubSub();
 *   const unsub = ps.subscribe<string>('greet', (msg) => console.log(msg));
 *   ps.publish('greet', 'hello'); // logs "hello"
 *   unsub();
 */
export class PubSub {
  private _handlers: Map<string, Set<(data: any) => void>>;

  constructor() {
    this._handlers = new Map();
  }

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   */
  subscribe<T = unknown>(topic: string, handler: (data: T) => void): () => void {
    let set = this._handlers.get(topic);
    if (!set) {
      set = new Set();
      this._handlers.set(topic, set);
    }
    set.add(handler as (data: any) => void);

    return () => {
      const s = this._handlers.get(topic);
      if (!s) return;
      s.delete(handler as (data: any) => void);
      if (s.size === 0) {
        this._handlers.delete(topic);
      }
    };
  }

  /**
   * Subscribe to a topic for a single message (auto-unsubscribes). Returns unsub.
   */
  subscribeOnce<T = unknown>(topic: string, handler: (data: T) => void): () => void {
    let unsub: (() => void) | undefined;
    const wrapper = (data: T) => {
      unsub?.();
      handler(data);
    };
    unsub = this.subscribe<T>(topic, wrapper);
    return unsub;
  }

  /**
   * Publish data to a topic. Returns the number of handlers called.
   */
  publish<T = unknown>(topic: string, data?: T): number {
    const set = this._handlers.get(topic);
    if (!set || set.size === 0) return 0;

    let count = 0;
    // Snapshot in case a handler unsubscribes during iteration
    for (const handler of Array.from(set)) {
      handler(data);
      count++;
    }
    return count;
  }

  /**
   * Unsubscribe all handlers from a topic.
   */
  clearTopic(topic: string): void {
    this._handlers.delete(topic);
  }

  /**
   * Get the number of subscribers for a topic.
   */
  subscriberCount(topic: string): number {
    return this._handlers.get(topic)?.size ?? 0;
  }

  /**
   * Get all active topic names.
   */
  topics(): string[] {
    return Array.from(this._handlers.keys());
  }
}

/**
 * A default global PubSub instance.
 */
export const pubSub: PubSub = new PubSub();

/**
 * Convenience: subscribe to the global pubSub. Returns unsubscribe.
 */
export function subscribe<T = unknown>(topic: string, handler: (data: T) => void): () => void {
  return pubSub.subscribe<T>(topic, handler);
}

/**
 * Convenience: publish to the global pubSub.
 */
export function publish<T = unknown>(topic: string, data?: T): number {
  return pubSub.publish<T>(topic, data);
}
