// @ts-check
// ─── Reactive Signals ────────────────────────────────────────────────────────
// Solid.js / Vue-ref style reactive primitives: signal, computed, effect,
// batch, isSignal, fromPromise, combine.

// ─── Internal tracking state ─────────────────────────────────────────────────

/** Currently executing effect node (for automatic dependency tracking). */
let currentEffect: EffectNode | null = null;

/** Batch depth counter — when > 0, defer subscriber notifications. */
let batchDepth = 0;

/** Signals that changed during a batch run, awaiting flush. */
const pendingSignals = new Set<SignalNode<unknown>>();

// ─── EffectNode ───────────────────────────────────────────────────────────────

/** Internal node tracking a running effect or computed function. */
class EffectNode {
  #fn: () => void;
  #deps = new Set<SignalNode<unknown>>();
  #disposed = false;

  constructor(fn: () => void) {
    this.#fn = fn;
  }

  run(): void {
    if (this.#disposed) return;
    // Unsubscribe from all previous deps so we rebuild them fresh.
    for (const dep of this.#deps) {
      dep._removeEffect(this);
    }
    this.#deps.clear();

    const prev = currentEffect;
    currentEffect = this;
    try {
      this.#fn();
    } finally {
      currentEffect = prev;
    }
  }

  /** Called by SignalNode.read() when this node is the current tracker. */
  _addDep(node: SignalNode<unknown>): void {
    this.#deps.add(node);
  }

  dispose(): void {
    this.#disposed = true;
    for (const dep of this.#deps) {
      dep._removeEffect(this);
    }
    this.#deps.clear();
  }
}

// ─── SignalNode ───────────────────────────────────────────────────────────────

/** Internal reactive node that holds a value and notifies subscribers. */
class SignalNode<T> {
  #value: T;
  #effectSubscribers = new Set<EffectNode>();
  #valueSubscribers = new Set<(value: T) => void>();

  constructor(initial: T) {
    this.#value = initial;
  }

  /** Read value, registering dependency if inside an effect. */
  read(): T {
    if (currentEffect !== null) {
      this.#effectSubscribers.add(currentEffect);
      currentEffect._addDep(this as unknown as SignalNode<unknown>);
    }
    return this.#value;
  }

  /** Read value without registering any dependency. */
  peek(): T {
    return this.#value;
  }

  /** Write a new value, notifying subscribers (or deferring during batch). */
  write(value: T): void {
    if (Object.is(this.#value, value)) return;
    this.#value = value;
    if (batchDepth > 0) {
      pendingSignals.add(this as unknown as SignalNode<unknown>);
    } else {
      this.#notify();
    }
  }

  /** Flush deferred notification (called after batch ends). */
  _flush(): void {
    this.#notify();
  }

  #notify(): void {
    // Snapshot to handle mutations during iteration.
    const effects = [...this.#effectSubscribers];
    for (const e of effects) {
      e.run();
    }
    const val = this.#value;
    for (const fn of [...this.#valueSubscribers]) {
      fn(val);
    }
  }

  /** Register a raw value subscriber. Returns unsubscribe. */
  _addValueSubscriber(fn: (value: T) => void): () => void {
    this.#valueSubscribers.add(fn);
    fn(this.#value); // fire immediately
    return () => {
      this.#valueSubscribers.delete(fn);
    };
  }

  _removeEffect(e: EffectNode): void {
    this.#effectSubscribers.delete(e);
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** A readable reactive signal. */
export interface Signal<T> {
  (): T;
  subscribe(fn: (value: T) => void): () => void;
  /** Read value without registering a tracking dependency. */
  peek(): T;
}

/** A writable reactive signal. */
export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

// ─── signal() ────────────────────────────────────────────────────────────────

/**
 * Create a writable reactive signal.
 *
 * @example
 *   const count = signal(0);
 *   count.set(1);
 *   count.update(n => n + 1);
 *   console.log(count()); // 2
 */
export function signal<T>(initialValue: T): WritableSignal<T> {
  const node = new SignalNode<T>(initialValue);

  const get = function (): T {
    return node.read();
  };

  const writable = get as WritableSignal<T>;

  writable.peek = () => node.peek();

  writable.set = (value: T): void => {
    node.write(value);
  };

  writable.update = (fn: (current: T) => T): void => {
    node.write(fn(node.peek()));
  };

  writable.subscribe = (fn: (value: T) => void): (() => void) =>
    node._addValueSubscriber(fn);

  Object.defineProperty(writable, '__isSignal', { value: true });

  return writable;
}

// ─── computed() ──────────────────────────────────────────────────────────────

/**
 * Create a derived (read-only) signal whose value is automatically
 * recomputed whenever its signal dependencies change.
 *
 * @example
 *   const a = signal(1);
 *   const double = computed(() => a() * 2);
 *   console.log(double()); // 2
 */
export function computed<T>(fn: () => T): Signal<T> {
  const node = new SignalNode<T>(undefined as unknown as T);

  const effectNode = new EffectNode(() => {
    const newVal = fn();
    node.write(newVal);
  });

  // Evaluate immediately to seed value and capture deps.
  effectNode.run();

  const get = function (): T {
    return node.read();
  };

  const readable = get as Signal<T>;
  readable.peek = () => node.peek();
  readable.subscribe = (cb: (value: T) => void): (() => void) =>
    node._addValueSubscriber(cb);

  Object.defineProperty(readable, '__isSignal', { value: true });

  return readable;
}

// ─── effect() ────────────────────────────────────────────────────────────────

/**
 * Run `fn` immediately and re-run it whenever any signal it reads changes.
 * Returns a cleanup / unsubscribe function.
 *
 * @example
 *   const count = signal(0);
 *   const stop = effect(() => console.log(count()));
 *   count.set(1); // logs 1
 *   stop();       // no more logs
 */
export function effect(fn: () => void): () => void {
  const node = new EffectNode(fn);
  node.run();
  return () => node.dispose();
}

// ─── batch() ─────────────────────────────────────────────────────────────────

/**
 * Group multiple signal writes so subscribers are notified only once after
 * all writes complete.
 *
 * @example
 *   batch(() => {
 *     firstName.set('Jane');
 *     lastName.set('Doe');
 *   });
 *   // derivations and effects run once
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const toFlush = [...pendingSignals];
      pendingSignals.clear();
      for (const s of toFlush) {
        s._flush();
      }
    }
  }
}

// ─── isSignal() ──────────────────────────────────────────────────────────────

/**
 * Returns `true` if `value` is a signal created by this module.
 */
export function isSignal(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    (value as { __isSignal?: boolean }).__isSignal === true
  );
}

// ─── fromPromise() ───────────────────────────────────────────────────────────

/**
 * Wrap a Promise in a Signal. The signal starts with `initial` and updates
 * when the promise resolves.
 *
 * @example
 *   const data = fromPromise(fetchUser(), null);
 *   effect(() => console.log(data())); // logs null, then the user
 */
export function fromPromise<T>(promise: Promise<T>, initial: T): Signal<T> {
  const s = signal<T>(initial);
  promise.then((value) => s.set(value)).catch(() => {
    // Silently ignore rejections — state stays at the last value.
  });

  const readable = (function () {
    return s();
  }) as Signal<T>;
  readable.peek = () => s.peek();
  readable.subscribe = (fn: (value: T) => void): (() => void) =>
    s.subscribe(fn);
  Object.defineProperty(readable, '__isSignal', { value: true });
  return readable;
}

// ─── combine() ───────────────────────────────────────────────────────────────

/**
 * Combine a record of signals into a single signal whose value is an object
 * containing the current values of all input signals.
 *
 * @example
 *   const x = signal(1);
 *   const y = signal(2);
 *   const pos = combine({ x, y });
 *   console.log(pos()); // { x: 1, y: 2 }
 */
export function combine<T extends Record<string, Signal<unknown>>>(
  signals: T,
): Signal<{ [K in keyof T]: T[K] extends Signal<infer V> ? V : never }> {
  type Combined = { [K in keyof T]: T[K] extends Signal<infer V> ? V : never };

  return computed(() => {
    const result = {} as Combined;
    for (const key of Object.keys(signals) as Array<keyof T & string>) {
      (result as Record<string, unknown>)[key] = signals[key]();
    }
    return result;
  });
}
