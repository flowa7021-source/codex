// ─── PubSub Broker ───────────────────────────────────────────────────────────
// Generic publish/subscribe broker with typed topics and messages.

// ─── ID generation ───────────────────────────────────────────────────────────

let _subCounter = 0;

function generateSubId(): string {
  _subCounter += 1;
  return `sub-${Date.now()}-${_subCounter}`;
}

// ─── PubSubBroker ────────────────────────────────────────────────────────────

/**
 * A typed publish/subscribe broker.
 *
 * @example
 *   type Events = { 'user:login': { userId: string }; 'app:ready': void };
 *   const broker = createPubSub<Events>();
 *   const unsub = broker.subscribe('user:login', (msg) => console.log(msg.userId));
 *   broker.publish('user:login', { userId: '42' });
 *   unsub();
 */
export class PubSubBroker<Events extends Record<string, unknown>> {
  #handlers: Map<keyof Events, Map<string, (msg: unknown) => void>> = new Map();

  /**
   * Publish a message to all subscribers of a topic.
   * @returns Number of subscribers that received the message.
   */
  publish<K extends keyof Events>(topic: K, message: Events[K]): number {
    const topicHandlers = this.#handlers.get(topic);
    if (!topicHandlers || topicHandlers.size === 0) return 0;

    // Snapshot the handlers to avoid mutation issues during dispatch
    const handlers = Array.from(topicHandlers.values());
    for (const handler of handlers) {
      handler(message);
    }
    return handlers.length;
  }

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   */
  subscribe<K extends keyof Events>(
    topic: K,
    handler: (msg: Events[K]) => void,
  ): () => void {
    let topicHandlers = this.#handlers.get(topic);
    if (!topicHandlers) {
      topicHandlers = new Map();
      this.#handlers.set(topic, topicHandlers);
    }

    const id = generateSubId();
    topicHandlers.set(id, handler as (msg: unknown) => void);

    return () => {
      const map = this.#handlers.get(topic);
      if (map) {
        map.delete(id);
        if (map.size === 0) {
          this.#handlers.delete(topic);
        }
      }
    };
  }

  /**
   * Subscribe to a topic for a single message only. Returns an unsubscribe function
   * that can be called early to cancel the one-time subscription.
   */
  subscribeOnce<K extends keyof Events>(
    topic: K,
    handler: (msg: Events[K]) => void,
  ): () => void {
    let unsub: (() => void) | undefined;

    const wrapper = (msg: Events[K]) => {
      if (unsub) unsub();
      handler(msg);
    };

    unsub = this.subscribe(topic, wrapper);
    return unsub;
  }

  /**
   * Remove all subscribers. If a topic is specified, only that topic is cleared.
   */
  unsubscribeAll(topic?: keyof Events): void {
    if (topic !== undefined) {
      this.#handlers.delete(topic);
    } else {
      this.#handlers.clear();
    }
  }

  /**
   * Return the number of active subscribers for a topic.
   */
  subscriberCount(topic: keyof Events): number {
    return this.#handlers.get(topic)?.size ?? 0;
  }

  /**
   * Return all topics that currently have at least one subscriber.
   */
  topics(): Array<keyof Events> {
    return Array.from(this.#handlers.keys());
  }
}

/**
 * Create a new PubSubBroker.
 */
export function createPubSub<Events extends Record<string, unknown>>(): PubSubBroker<Events> {
  return new PubSubBroker<Events>();
}
