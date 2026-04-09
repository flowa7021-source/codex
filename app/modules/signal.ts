// @ts-check
// ─── Signals ─────────────────────────────────────────────────────────────────
// Fine-grained reactive primitives: signal, computed, effect, and batch.

// ─── Internal tracking state ─────────────────────────────────────────────────

/** Currently executing effect (for automatic dependency tracking). */
let currentEffect: EffectNode | null = null;

/** Batch depth counter — when > 0, defer subscriber notifications. */
let batchDepth = 0;

/** Signals that changed during a batch run. */
const pendingSignals = new Set<SignalNode<unknown>>();

// ─── Internal node types ─────────────────────────────────────────────────────

interface EffectNode {
  run(): void;
  cleanup(): void;
  deps: Set<SignalNode<unknown>>;
}

class SignalNode<T> {
  #value: T;
  #subscribers = new Set<EffectNode>();

  constructor(initial: T) {
    this.#value = initial;
  }

  read(): T {
    // Track dependency if inside an effect
    if (currentEffect) {
      this.#subscribers.add(currentEffect);
      currentEffect.deps.add(this);
    }
    return this.#value;
  }

  write(value: T): void {
    if (Object.is(this.#value, value)) return;
    this.#value = value;
    if (batchDepth > 0) {
      pendingSignals.add(this as unknown as SignalNode<unknown>);
    } else {
      this.#notify();
    }
  }

  notify(): void {
    this.#notify();
  }

  #notify(): void {
    // Snapshot subscribers to handle mutations during iteration
    for (const effect of [...this.#subscribers]) {
      effect.run();
    }
  }

  addSubscriber(e: EffectNode): void {
    this.#subscribers.add(e);
  }

  removeSubscriber(e: EffectNode): void {
    this.#subscribers.delete(e);
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Signal<T> {
  /** Get current value. */
  (): T;
  /** Set new value. */
  set(value: T): void;
  /** Update value with a function. */
  update(fn: (current: T) => T): void;
  /** Subscribe to changes. Returns unsubscribe. */
  subscribe(fn: (value: T) => void): () => void;
  /** Current value (same as calling signal()). */
  readonly value: T;
}

// ─── signal() ────────────────────────────────────────────────────────────────

/**
 * Create a reactive signal with an initial value.
 *
 * @example
 *   const count = signal(0);
 *   count.set(1);
 *   console.log(count()); // 1
 */
export function signal<T>(initial: T): Signal<T> {
  const node = new SignalNode(initial);

  // The signal is callable — invoking it reads the current value
  function read(): T {
    return node.read();
  }

  read.set = (value: T): void => {
    node.write(value);
  };

  read.update = (fn: (current: T) => T): void => {
    node.write(fn(node.read()));
  };

  read.subscribe = (fn: (value: T) => void): () => void => {
    // Create a lightweight effect node for the subscriber
    const effectNode: EffectNode = {
      deps: new Set(),
      run() {
        fn(node.read());
      },
      cleanup() {
        node.removeSubscriber(this);
      },
    };
    node.addSubscriber(effectNode);
    // Call immediately with current value
    fn(node.read());
    return () => {
      node.removeSubscriber(effectNode);
    };
  };

  Object.defineProperty(read, 'value', {
    get(): T {
      return node.read();
    },
    enumerable: true,
    configurable: true,
  });

  return read as unknown as Signal<T>;
}

// ─── computed() ──────────────────────────────────────────────────────────────

/**
 * Create a computed (derived, read-only) signal from other signals.
 * Automatically re-evaluates when its dependencies change.
 *
 * @example
 *   const a = signal(2);
 *   const b = signal(3);
 *   const sum = computed(() => a() + b());
 *   console.log(sum()); // 5
 */
export function computed<T>(fn: () => T): Omit<Signal<T>, 'set' | 'update'> {
  // Computed is backed by a signal node
  const node = new SignalNode<T>(undefined as unknown as T);

  // The effect node that re-evaluates fn and writes to node
  let initialized = false;

  const effectNode: EffectNode = {
    deps: new Set(),
    run() {
      // Clear old deps
      for (const dep of this.deps) {
        dep.removeSubscriber(this);
      }
      this.deps.clear();

      const prev = currentEffect;
      currentEffect = this;
      try {
        const newValue = fn();
        node.write(newValue);
      } finally {
        currentEffect = prev;
      }
    },
    cleanup() {
      for (const dep of this.deps) {
        dep.removeSubscriber(this);
      }
      this.deps.clear();
    },
  };

  // Patch deps tracking so SignalNode.read() also adds to effectNode.deps
  // We override run to track deps by temporarily setting currentEffect
  if (!initialized) {
    initialized = true;
    effectNode.run();
  }

  function read(): T {
    return node.read();
  }

  read.subscribe = (callback: (value: T) => void): () => void => {
    const subEffect: EffectNode = {
      deps: new Set(),
      run() {
        callback(node.read());
      },
      cleanup() {
        node.removeSubscriber(this);
      },
    };
    node.addSubscriber(subEffect);
    callback(node.read());
    return () => {
      node.removeSubscriber(subEffect);
    };
  };

  Object.defineProperty(read, 'value', {
    get(): T {
      return node.read();
    },
    enumerable: true,
    configurable: true,
  });

  return read as unknown as Omit<Signal<T>, 'set' | 'update'>;
}

// ─── effect() ────────────────────────────────────────────────────────────────

/**
 * Run a side-effect whenever its signal dependencies change.
 * The effect runs immediately on creation.
 *
 * The function may return a cleanup function that is called before each re-run
 * and when the effect is disposed.
 *
 * @example
 *   const name = signal('Alice');
 *   const stop = effect(() => {
 *     console.log('Hello', name());
 *   });
 *   name.set('Bob'); // logs 'Hello Bob'
 *   stop();          // disposes the effect
 */
export function effect(fn: () => void | (() => void)): () => void {
  let userCleanup: void | (() => void);

  const effectNode: EffectNode = {
    deps: new Set(),
    run() {
      // Call user cleanup from previous run
      if (typeof userCleanup === 'function') {
        userCleanup();
        userCleanup = undefined;
      }

      // Clear stale deps
      for (const dep of this.deps) {
        dep.removeSubscriber(this);
      }
      this.deps.clear();

      // Execute the effect with dependency tracking
      const prev = currentEffect;
      currentEffect = this;
      try {
        userCleanup = fn() as void | (() => void);
      } finally {
        currentEffect = prev;
      }
    },
    cleanup() {
      if (typeof userCleanup === 'function') {
        userCleanup();
        userCleanup = undefined;
      }
      for (const dep of this.deps) {
        dep.removeSubscriber(this);
      }
      this.deps.clear();
    },
  };

  // Run immediately to track initial dependencies
  effectNode.run();

  // Return dispose function
  return () => {
    effectNode.cleanup();
  };
}

// ─── batch() ─────────────────────────────────────────────────────────────────

/**
 * Batch multiple signal updates so that subscribers are only notified once
 * after all updates complete.
 *
 * @example
 *   const x = signal(0);
 *   const y = signal(0);
 *   batch(() => {
 *     x.set(1);
 *     y.set(2);
 *   });
 *   // subscribers notified once, not twice
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      // Flush pending signals — snapshot to avoid re-entrancy issues
      const toFlush = [...pendingSignals];
      pendingSignals.clear();
      for (const node of toFlush) {
        node.notify();
      }
    }
  }
}
