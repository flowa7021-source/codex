// @ts-check
// ─── Signal Handler ──────────────────────────────────────────────────────────
// Typed signal/slot pattern for decoupled event-driven communication.
// Distinct from reactive signals — these are imperative pub/sub connectors.

// ─── TypedSignal ─────────────────────────────────────────────────────────────

/**
 * A typed signal that can emit values to connected slots.
 *
 * @example
 *   const onResize = new TypedSignal<{ width: number; height: number }>();
 *   const disconnect = onResize.connect(({ width }) => console.log(width));
 *   onResize.emit({ width: 800, height: 600 });
 *   disconnect();
 */
export class TypedSignal<T> {
  #slots: Set<(value: T) => void> = new Set();

  /**
   * Emit a value to all currently connected slots.
   * Slots are called in connection order; a slot added during emission is not
   * called for the current emission.
   */
  emit(value: T): void {
    // Snapshot to avoid mutation-during-iteration problems
    for (const slot of [...this.#slots]) {
      slot(value);
    }
  }

  /**
   * Connect a slot to this signal.
   * @returns A disconnect function that removes this slot when called.
   */
  connect(slot: (value: T) => void): () => void {
    this.#slots.add(slot);
    return () => this.disconnect(slot);
  }

  /** Disconnect a specific slot. No-op if the slot is not connected. */
  disconnect(slot: (value: T) => void): void {
    this.#slots.delete(slot);
  }

  /** Disconnect all slots. */
  disconnectAll(): void {
    this.#slots.clear();
  }

  /** Number of currently connected slots. */
  get connectionCount(): number {
    return this.#slots.size;
  }

  /**
   * Connect a slot for a single emission only.
   * The slot is automatically disconnected after the first call.
   * @returns A disconnect function (calling it before emission prevents firing).
   */
  once(slot: (value: T) => void): () => void {
    const wrapper = (value: T): void => {
      this.#slots.delete(wrapper);
      slot(value);
    };
    this.#slots.add(wrapper);
    return () => this.#slots.delete(wrapper);
  }

  /**
   * Forward all emissions from this signal into `other`.
   * @returns A disconnect function that stops forwarding.
   */
  pipe(other: TypedSignal<T>): () => void {
    return this.connect((value) => other.emit(value));
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new {@link TypedSignal}. */
export function createSignal<T>(): TypedSignal<T> {
  return new TypedSignal<T>();
}

// ─── SignalGroup ──────────────────────────────────────────────────────────────

/**
 * Collects multiple signals so they can all be disconnected at once.
 * Useful for component teardown where many signals need cleanup.
 *
 * @example
 *   const group = new SignalGroup();
 *   group.add(onResize).connect(handler);
 *   // … later …
 *   group.disconnectAll();
 */
export class SignalGroup {
  #signals: TypedSignal<unknown>[] = [];

  /**
   * Track `signal` in this group and return it for chaining.
   * The signal's slots will be disconnected when `disconnectAll` is called.
   */
  add<T>(signal: TypedSignal<T>): TypedSignal<T> {
    this.#signals.push(signal as unknown as TypedSignal<unknown>);
    return signal;
  }

  /** Call `disconnectAll` on every tracked signal. */
  disconnectAll(): void {
    for (const signal of this.#signals) {
      signal.disconnectAll();
    }
  }
}
