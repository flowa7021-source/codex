// @ts-check
// ─── Message Bus ──────────────────────────────────────────────────────────────
// Pub/sub message bus with topics, channels, and request-reply pattern.
// No browser APIs used — safe for Node.js and worker environments.

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface Message<T = unknown> {
  /** Unique message identifier. */
  id: string;
  /** Topic this message was published to. */
  topic: string;
  /** Message payload. */
  payload: T;
  /** Unix-millisecond timestamp of publication. */
  timestamp: number;
  /** For request-reply: topic to publish the reply on. */
  replyTo?: string;
}

export interface Subscription {
  /** Unique subscription identifier. */
  id: string;
  /** Topic being subscribed to. */
  topic: string;
  /** Cancel the subscription. */
  unsubscribe(): void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

let _idCounter = 0;

function nextId(): string {
  return `msg_${++_idCounter}_${Date.now()}`;
}

function subId(): string {
  return `sub_${++_idCounter}_${Date.now()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pub/sub message bus supporting topics, once-subscriptions, and
 * request-reply.
 *
 * @example
 *   const bus = new MessageBus();
 *   bus.subscribe('user.created', (msg) => console.log(msg.payload));
 *   bus.publish('user.created', { id: 1, name: 'Alice' });
 */
export class MessageBus {
  #handlers: Map<string, Map<string, (message: Message<unknown>) => void>> = new Map();

  // ─── publish ──────────────────────────────────────────────────────────────

  /** Publish a message to a topic. Returns the created Message object. */
  publish<T>(topic: string, payload: T): Message<T>;
  /** @internal — overload used by reply() to attach replyTo */
  publish<T>(topic: string, payload: T, replyTo?: string): Message<T>;
  publish<T>(topic: string, payload: T, replyTo?: string): Message<T> {
    const message: Message<T> = {
      id: nextId(),
      topic,
      payload,
      timestamp: Date.now(),
      ...(replyTo !== undefined ? { replyTo } : {}),
    };

    const topicHandlers = this.#handlers.get(topic);
    if (topicHandlers) {
      // Snapshot so unsubscribe inside a handler is safe
      for (const handler of Array.from(topicHandlers.values())) {
        handler(message as Message<unknown>);
      }
    }
    return message;
  }

  // ─── subscribe ────────────────────────────────────────────────────────────

  /** Subscribe to a topic. Returns a Subscription with an unsubscribe method. */
  subscribe<T>(topic: string, handler: (message: Message<T>) => void): Subscription {
    let topicHandlers = this.#handlers.get(topic);
    if (!topicHandlers) {
      topicHandlers = new Map();
      this.#handlers.set(topic, topicHandlers);
    }

    const id = subId();
    topicHandlers.set(id, handler as (message: Message<unknown>) => void);

    const unsubscribe = () => {
      const map = this.#handlers.get(topic);
      if (map) {
        map.delete(id);
        if (map.size === 0) this.#handlers.delete(topic);
      }
    };

    return { id, topic, unsubscribe };
  }

  // ─── subscribeOnce ────────────────────────────────────────────────────────

  /** Subscribe to the first message on a topic, then auto-unsubscribe. */
  subscribeOnce<T>(topic: string, handler: (message: Message<T>) => void): Subscription {
    let sub: Subscription;
    const wrapper = (message: Message<T>) => {
      sub.unsubscribe();
      handler(message);
    };
    sub = this.subscribe<T>(topic, wrapper);
    return sub;
  }

  // ─── unsubscribeAll ───────────────────────────────────────────────────────

  /** Remove all subscriptions for a topic. */
  unsubscribeAll(topic: string): void {
    this.#handlers.delete(topic);
  }

  // ─── request / reply ──────────────────────────────────────────────────────

  /**
   * Publish a message and wait for a reply.
   * The replier must call `bus.reply(originalMessage, payload)`.
   * Rejects with an Error if no reply arrives within `timeoutMs` (default 5000).
   */
  request<TReq, TRes>(topic: string, payload: TReq, timeoutMs = 5000): Promise<TRes> {
    return new Promise<TRes>((resolve, reject) => {
      // Unique reply-to topic for this specific request
      const replyTopic = `__reply__${nextId()}`;

      const sub = this.subscribeOnce<TRes>(replyTopic, (msg) => {
        clearTimeout(timer);
        resolve(msg.payload);
      });

      const timer = setTimeout(() => {
        sub.unsubscribe();
        reject(new Error(`MessageBus.request timed out after ${timeoutMs}ms on topic "${topic}"`));
      }, timeoutMs);

      // Publish the request with replyTo set
      this.publish<TReq>(topic, payload, replyTopic);
    });
  }

  /**
   * Reply to a request message.
   * `originalMessage.replyTo` must be set (i.e. it must have come from `request()`).
   */
  reply<T>(originalMessage: Message<unknown>, payload: T): void {
    if (!originalMessage.replyTo) {
      throw new Error('MessageBus.reply: originalMessage has no replyTo field');
    }
    this.publish<T>(originalMessage.replyTo, payload);
  }

  // ─── introspection ────────────────────────────────────────────────────────

  /** Return the number of active subscribers for a topic. */
  subscriberCount(topic: string): number {
    return this.#handlers.get(topic)?.size ?? 0;
  }

  /** Return all topics that have at least one active subscriber. */
  topics(): string[] {
    return Array.from(this.#handlers.keys());
  }

  /** Remove all subscriptions and clear all topics. */
  clear(): void {
    this.#handlers.clear();
  }
}
