// @ts-check
// ─── Observer / Subject pattern ──────────────────────────────────────────────
// Implements the Observer design pattern with Subject, BehaviorSubject, and
// ReplaySubject, inspired by RxJS but with zero dependencies.

// ---------------------------------------------------------------------------
// Observer interface
// ---------------------------------------------------------------------------

/**
 * An observer that can receive values, errors, and completion notifications.
 */
export interface Observer<T> {
  update(value: T): void;
  error?(err: Error): void;
  complete?(): void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalise a raw function or Observer object into a full Observer record. */
function toObserver<T>(observer: Observer<T> | ((value: T) => void)): Observer<T> {
  if (typeof observer === 'function') {
    return { update: observer };
  }
  return observer;
}

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

/**
 * A Subject holds a set of observers and broadcasts values, errors, and
 * completion to all of them.
 *
 * @example
 *   const s = createSubject<number>();
 *   const unsub = s.subscribe(v => console.log(v));
 *   s.next(1); // logs 1
 *   unsub();
 */
export class Subject<T> {
  #observers: Set<Observer<T>> = new Set();
  #completed = false;
  #errored = false;

  /**
   * Subscribe to values.  Accepts either an Observer object or a plain
   * function.  Returns an unsubscribe function.
   */
  subscribe(observer: Observer<T> | ((value: T) => void)): () => void {
    if (this.#completed || this.#errored) {
      // Already terminal — do not register
      return () => { /* no-op */ };
    }
    const obs = toObserver(observer);
    this.#observers.add(obs);
    return () => this.#observers.delete(obs);
  }

  /** Remove a previously registered observer. */
  unsubscribe(observer: Observer<T> | ((value: T) => void)): void {
    // For function-based subscriptions we cannot do an identity lookup here
    // (the wrapper created in subscribe is distinct), so we look up by
    // reference directly.  For object observers we can delete by reference.
    const obs = typeof observer === 'function' ? { update: observer } : observer;
    this.#observers.delete(obs);
  }

  /** Emit a value to all current observers. */
  next(value: T): void {
    if (this.#completed || this.#errored) return;
    for (const obs of [...this.#observers]) {
      obs.update(value);
    }
  }

  /** Emit an error to all observers, then remove all subscriptions. */
  error(err: Error): void {
    if (this.#completed || this.#errored) return;
    this.#errored = true;
    for (const obs of [...this.#observers]) {
      obs.error?.(err);
    }
    this.#observers.clear();
  }

  /** Emit completion to all observers, then remove all subscriptions. */
  complete(): void {
    if (this.#completed || this.#errored) return;
    this.#completed = true;
    for (const obs of [...this.#observers]) {
      obs.complete?.();
    }
    this.#observers.clear();
  }

  /** Number of active subscriptions. */
  get observerCount(): number {
    return this.#observers.size;
  }

  /** Whether complete() has been called. */
  get isCompleted(): boolean {
    return this.#completed;
  }

  /** Whether error() has been called. */
  get hasError(): boolean {
    return this.#errored;
  }
}

// ---------------------------------------------------------------------------
// BehaviorSubject
// ---------------------------------------------------------------------------

/**
 * A Subject that remembers its current value and immediately emits it to new
 * subscribers.
 *
 * @example
 *   const bs = createBehaviorSubject(0);
 *   bs.subscribe(v => console.log(v)); // immediately logs 0
 *   bs.next(1);                        // logs 1
 */
export class BehaviorSubject<T> extends Subject<T> {
  #value: T;

  constructor(initialValue: T) {
    super();
    this.#value = initialValue;
  }

  /** Subscribe and immediately receive the current value. */
  override subscribe(observer: Observer<T> | ((value: T) => void)): () => void {
    const unsub = super.subscribe(observer);
    // Emit current value synchronously to the new subscriber only.
    if (!this.isCompleted && !this.hasError) {
      const obs = toObserver(observer);
      obs.update(this.#value);
    }
    return unsub;
  }

  /** Emit a new value and update the stored current value. */
  override next(value: T): void {
    this.#value = value;
    super.next(value);
  }

  /** The most recently emitted value. */
  get value(): T {
    return this.#value;
  }
}

// ---------------------------------------------------------------------------
// ReplaySubject
// ---------------------------------------------------------------------------

/**
 * A Subject that records the last `bufferSize` values and replays them to any
 * new subscriber.
 *
 * @example
 *   const rs = createReplaySubject<number>(3);
 *   rs.next(1); rs.next(2); rs.next(3); rs.next(4);
 *   rs.subscribe(v => console.log(v)); // logs 2, 3, 4
 */
export class ReplaySubject<T> {
  #bufferSize: number;
  #buffer: T[] = [];
  #observers: Set<Observer<T>> = new Set();
  #completed = false;
  #errored = false;

  constructor(bufferSize = 1) {
    this.#bufferSize = bufferSize < 1 ? 1 : bufferSize;
  }

  /** Subscribe and receive replayed + future values. */
  subscribe(observer: Observer<T> | ((value: T) => void)): () => void {
    const obs = toObserver(observer);
    if (!this.#completed && !this.#errored) {
      this.#observers.add(obs);
    }
    // Replay buffered values synchronously
    for (const v of this.#buffer) {
      obs.update(v);
    }
    if (this.#completed) obs.complete?.();
    return () => this.#observers.delete(obs);
  }

  /** Emit a value, updating the buffer and notifying all observers. */
  next(value: T): void {
    if (this.#completed || this.#errored) return;
    this.#buffer.push(value);
    if (this.#buffer.length > this.#bufferSize) {
      this.#buffer.shift();
    }
    for (const obs of [...this.#observers]) {
      obs.update(value);
    }
  }

  /** Complete this subject; notifies and clears all observers. */
  complete(): void {
    if (this.#completed || this.#errored) return;
    this.#completed = true;
    for (const obs of [...this.#observers]) {
      obs.complete?.();
    }
    this.#observers.clear();
  }

  /** Emit an error; notifies and clears all observers. */
  error(err: Error): void {
    if (this.#completed || this.#errored) return;
    this.#errored = true;
    for (const obs of [...this.#observers]) {
      obs.error?.(err);
    }
    this.#observers.clear();
  }

  /** Number of active subscriptions. */
  get observerCount(): number {
    return this.#observers.size;
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** Create a new Subject. */
export function createSubject<T>(): Subject<T> {
  return new Subject<T>();
}

/** Create a new BehaviorSubject with an initial value. */
export function createBehaviorSubject<T>(initial: T): BehaviorSubject<T> {
  return new BehaviorSubject<T>(initial);
}

/** Create a new ReplaySubject with an optional buffer size (default 1). */
export function createReplaySubject<T>(bufferSize?: number): ReplaySubject<T> {
  return new ReplaySubject<T>(bufferSize);
}
