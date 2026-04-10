// @ts-check
// ─── RxSubject ────────────────────────────────────────────────────────────────
// Subject variants: multicast observable that is also an Observer.
// Includes ReplaySubject, BehaviorSubject, and AsyncSubject.

import { RxObservable, type Observer, type Subscription } from './rx-observable.js';

// ─── Internal subscriber record ───────────────────────────────────────────────

interface SubRecord<T> {
  observer: Observer<T>;
  sub: Subscription;
}

// ─── Subject ──────────────────────────────────────────────────────────────────

/**
 * A Subject is both an Observable and an Observer.
 * It multicasts to all current subscribers.
 */
export class RxSubject<T> extends RxObservable<T> {
  protected _observers: Array<SubRecord<T>> = [];
  protected _closed = false;
  protected _error: unknown = undefined;
  protected _hasError = false;
  protected _completed = false;

  constructor() {
    super((observer) => {
      // If already errored, replay error signal immediately
      if (this._hasError) {
        observer.error?.(this._error);
        return;
      }
      if (this._completed) {
        // For ReplaySubject/BehaviorSubject: replay buffered values first, then complete.
        // _onSubscribe returns true if it already sent complete (e.g. AsyncSubject).
        const handledComplete = this._onSubscribe(observer);
        if (!handledComplete) observer.complete?.();
        return;
      }
      // Register the observer so future nexts reach it
      const record: SubRecord<T> = {
        observer,
        sub: {
          get closed() { return record._closed ?? false; },
          unsubscribe: () => {
            (record as unknown as { _closed: boolean })._closed = true;
            const idx = this._observers.indexOf(record);
            if (idx !== -1) this._observers.splice(idx, 1);
          },
        },
      };
      this._observers.push(record);
      // Allow subclasses (ReplaySubject, BehaviorSubject) to replay buffered values
      this._onSubscribe(observer);  // return value ignored for live subscriptions
      return () => record.sub.unsubscribe();
    });
  }

  /**
   * Called when a new subscriber arrives.
   * Subclasses override to replay buffered values.
   * Return `true` if complete was already sent (to avoid double-complete).
   */
  protected _onSubscribe(_observer: Observer<T>): boolean {
    // base Subject does nothing; complete not handled
    return false;
  }

  /** Emit a value to all current subscribers. */
  next(value: T): void {
    if (this._closed) return;
    this._notifyNext(value);
  }

  /** Propagate a value to all observers (can be overridden for buffer tracking). */
  protected _notifyNext(value: T): void {
    for (const record of [...this._observers]) {
      record.observer.next(value);
    }
  }

  /** Emit an error to all subscribers and close. */
  error(err: unknown): void {
    if (this._closed) return;
    this._closed = true;
    this._hasError = true;
    this._error = err;
    for (const record of [...this._observers]) {
      record.observer.error?.(err);
    }
    this._observers = [];
  }

  /** Complete the subject and notify all subscribers. */
  complete(): void {
    if (this._closed) return;
    this._closed = true;
    this._completed = true;
    this._onBeforeComplete();
    for (const record of [...this._observers]) {
      record.observer.complete?.();
    }
    this._observers = [];
  }

  /** Hook for AsyncSubject to emit its last value before completing. */
  protected _onBeforeComplete(): void {}

  /** Whether the subject has been closed (errored or completed). */
  get closed(): boolean {
    return this._closed;
  }

  /** Number of active observers. */
  get observerCount(): number {
    return this._observers.length;
  }
}

// ─── ReplaySubject ────────────────────────────────────────────────────────────

/**
 * Replays the last `bufferSize` emitted values to new subscribers.
 */
export class ReplaySubject<T> extends RxSubject<T> {
  readonly #bufferSize: number;
  #buffer: T[] = [];

  constructor(bufferSize = Infinity) {
    super();
    this.#bufferSize = bufferSize > 0 ? bufferSize : 0;
  }

  protected override _notifyNext(value: T): void {
    // Add to buffer, trim to max size
    this.#buffer.push(value);
    if (this.#buffer.length > this.#bufferSize) {
      this.#buffer.shift();
    }
    super._notifyNext(value);
  }

  protected override _onSubscribe(observer: Observer<T>): boolean {
    // Replay buffered values immediately
    for (const value of this.#buffer) {
      observer.next(value);
    }
    return false; // complete not handled; parent sends it
  }

  /** Read-only snapshot of the replay buffer. */
  get buffer(): T[] {
    return [...this.#buffer];
  }
}

// ─── BehaviorSubject ──────────────────────────────────────────────────────────

/**
 * Emits the current value immediately to any new subscriber.
 * Always holds the latest value.
 */
export class BehaviorSubject<T> extends RxSubject<T> {
  #value: T;

  constructor(initialValue: T) {
    super();
    this.#value = initialValue;
  }

  protected override _notifyNext(value: T): void {
    this.#value = value;
    super._notifyNext(value);
  }

  protected override _onSubscribe(observer: Observer<T>): boolean {
    // Emit current value to the new subscriber immediately
    observer.next(this.#value);
    return false; // complete not handled; parent sends it
  }

  /** The latest value held by the subject. */
  get value(): T {
    return this.#value;
  }
}

// ─── AsyncSubject ─────────────────────────────────────────────────────────────

/**
 * Only emits the last value (and completes) when `complete()` is called.
 * New subscribers after completion receive the last value + complete.
 */
export class AsyncSubject<T> extends RxSubject<T> {
  #lastValue: T | undefined = undefined;
  #hasValue = false;

  protected override _notifyNext(value: T): void {
    // Buffer the value but don't emit yet
    this.#lastValue = value;
    this.#hasValue = true;
    // Do NOT forward to observers — wait for complete()
  }

  protected override _onBeforeComplete(): void {
    // Emit the last value to all current subscribers before completing
    if (this.#hasValue) {
      for (const record of this._observers) {
        record.observer.next(this.#lastValue as T);
      }
    }
  }

  protected override _onSubscribe(observer: Observer<T>): boolean {
    // If already completed, immediately replay last value + complete
    if (this._completed && this.#hasValue) {
      observer.next(this.#lastValue as T);
      observer.complete?.();
      return true; // complete was already sent
    }
    return false;
  }
}
