// @ts-check
// ─── Actor Model ─────────────────────────────────────────────────────────────
// Simplified Actor model: actors communicate via messages, each actor has
// isolated state updated by a behavior function.

/** A string identifier for an actor. */
export type ActorRef = string;

/** A message sent between actors. */
export interface Message<T = unknown> {
  from: ActorRef;
  to: ActorRef;
  type: string;
  payload: T;
}

/** A pure (or async) function that maps (state, message) → next state. */
export type ActorBehavior<S> = (state: S, message: Message) => S | Promise<S>;

/** Internal actor record. */
interface ActorRecord<S> {
  state: S;
  behavior: ActorBehavior<S>;
  mailbox: Message[];
  processing: boolean;
}

/**
 * A lightweight in-process Actor System.
 *
 * @example
 *   const sys = createActorSystem();
 *   const counter = sys.spawn('counter', 0, (state, msg) => {
 *     if (msg.type === 'inc') return state + 1;
 *     return state;
 *   });
 *   sys.send(counter, 'inc');
 *   await sys.drain();
 *   console.log(sys.getState(counter)); // 1
 */
export class ActorSystem {
  #actors = new Map<ActorRef, ActorRecord<unknown>>();
  #pending = 0;
  #drainResolvers: Array<() => void> = [];

  /**
   * Spawn a new actor with initial state and behavior. Returns actor ref.
   */
  spawn<S>(name: string, initialState: S, behavior: ActorBehavior<S>): ActorRef {
    if (this.#actors.has(name)) {
      throw new Error(`Actor "${name}" already exists`);
    }
    const record: ActorRecord<S> = {
      state: initialState,
      behavior,
      mailbox: [],
      processing: false,
    };
    this.#actors.set(name, record as ActorRecord<unknown>);
    return name;
  }

  /**
   * Send a message to an actor (async, non-blocking).
   * The message is enqueued and processed asynchronously.
   */
  send(to: ActorRef, type: string, payload: unknown = undefined): void {
    const actor = this.#actors.get(to);
    if (!actor) return; // silently drop to stopped/unknown actors

    const msg: Message = { from: 'system', to, type, payload };
    actor.mailbox.push(msg);
    this.#pending++;
    if (!actor.processing) {
      this.#processMailbox(to);
    }
  }

  /** Process an actor's mailbox until empty. */
  #processMailbox(ref: ActorRef): void {
    const actor = this.#actors.get(ref);
    if (!actor || actor.processing) return;

    actor.processing = true;

    const step = () => {
      const actor = this.#actors.get(ref);
      // actor may have been stopped
      if (!actor || actor.mailbox.length === 0) {
        if (actor) actor.processing = false;
        return;
      }

      const msg = actor.mailbox.shift()!;
      const result = actor.behavior(actor.state, msg);

      const settle = (nextState: unknown) => {
        const current = this.#actors.get(ref);
        if (current) {
          current.state = nextState;
        }
        this.#pending--;
        this.#checkDrain();
        // schedule next step
        Promise.resolve().then(step);
      };

      if (result instanceof Promise) {
        result.then(settle, (err) => {
          // on error, keep current state, still consume the message
          console.error(`Actor "${ref}" behavior threw:`, err);
          settle(actor.state);
        });
      } else {
        Promise.resolve().then(() => settle(result));
      }
    };

    Promise.resolve().then(step);
  }

  /** Check if all pending messages have been processed and notify drainers. */
  #checkDrain(): void {
    if (this.#pending === 0 && this.#drainResolvers.length > 0) {
      const resolvers = this.#drainResolvers.splice(0);
      for (const resolve of resolvers) resolve();
    }
  }

  /**
   * Wait for all pending messages to be processed.
   */
  drain(): Promise<void> {
    if (this.#pending === 0) return Promise.resolve();
    return new Promise<void>(resolve => {
      this.#drainResolvers.push(resolve);
    });
  }

  /**
   * Get current state of an actor (for testing/inspection).
   */
  getState<S>(ref: ActorRef): S | undefined {
    const actor = this.#actors.get(ref);
    return actor ? (actor.state as S) : undefined;
  }

  /**
   * Stop an actor. Pending messages in its mailbox are discarded.
   */
  stop(ref: ActorRef): void {
    const actor = this.#actors.get(ref);
    if (!actor) return;
    // Drain pending count for discarded messages
    this.#pending -= actor.mailbox.length;
    this.#actors.delete(ref);
    this.#checkDrain();
  }

  /** Number of live actors in this system. */
  get actorCount(): number {
    return this.#actors.size;
  }
}

/**
 * Create a new ActorSystem.
 */
export function createActorSystem(): ActorSystem {
  return new ActorSystem();
}
