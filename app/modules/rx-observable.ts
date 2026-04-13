// @ts-check
// ─── RxObservable ─────────────────────────────────────────────────────────────
// Lightweight Observable implementation (RxJS-inspired, standalone).
// Supports map, filter, take, skip, merge, toArray, and factory helpers.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Observer<T> {
  next: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
}

export interface Subscription {
  unsubscribe(): void;
  readonly closed: boolean;
}

// ─── Internal SafeSubscriber ──────────────────────────────────────────────────

class SafeSubscriber<T> implements Observer<T>, Subscription {
  #closed = false;
  #cleanup: (() => void) | undefined = undefined;
  readonly #onNext: (value: T) => void;
  readonly #onError: (err: unknown) => void;
  readonly #onComplete: () => void;

  constructor(observer: Observer<T> | ((value: T) => void)) {
    if (typeof observer === 'function') {
      this.#onNext = observer;
      this.#onError = () => {};
      this.#onComplete = () => {};
    } else {
      this.#onNext = (v) => observer.next(v);
      this.#onError = observer.error ? (e) => observer.error!(e) : () => {};
      this.#onComplete = observer.complete ? () => observer.complete!() : () => {};
    }
  }

  setCleanup(cleanup: (() => void) | void): void {
    if (typeof cleanup === 'function') {
      this.#cleanup = cleanup;
    }
  }

  get closed(): boolean {
    return this.#closed;
  }

  next(value: T): void {
    if (this.#closed) return;
    try {
      this.#onNext(value);
    } catch (err) {
      this.error(err);
    }
  }

  error(err: unknown): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#onError(err);
    } finally {
      this._runCleanup();
    }
  }

  complete(): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#onComplete();
    } finally {
      this._runCleanup();
    }
  }

  unsubscribe(): void {
    if (this.#closed) return;
    this.#closed = true;
    this._runCleanup();
  }

  private _runCleanup(): void {
    const fn = this.#cleanup;
    if (fn) {
      this.#cleanup = undefined;
      fn();
    }
  }
}

// ─── Observable class ─────────────────────────────────────────────────────────

export class RxObservable<T> {
  readonly #subscriber: (observer: SafeSubscriber<T>) => (() => void) | void;

  constructor(subscriber: (observer: Observer<T>) => (() => void) | void) {
    this.#subscriber = subscriber as (observer: SafeSubscriber<T>) => (() => void) | void;
  }

  subscribe(observer: Observer<T> | ((value: T) => void)): Subscription {
    const safe = new SafeSubscriber<T>(observer);
    try {
      const cleanup = this.#subscriber(safe);
      if (!safe.closed) {
        safe.setCleanup(cleanup);
      } else if (typeof cleanup === 'function') {
        cleanup();
      }
    } catch (err) {
      safe.error(err);
    }
    return safe;
  }

  /** Transform each emitted value. */
  map<U>(fn: (value: T) => U): RxObservable<U> {
    return new RxObservable<U>((observer) => {
      const sub = this.subscribe({
        next: (value) => observer.next(fn(value)),
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Keep only values matching the predicate. */
  filter(fn: (value: T) => boolean): RxObservable<T> {
    return new RxObservable<T>((observer) => {
      const sub = this.subscribe({
        next: (value) => { if (fn(value)) observer.next(value); },
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Take the first n values, then complete. */
  take(n: number): RxObservable<T> {
    return new RxObservable<T>((observer) => {
      if (n <= 0) {
        observer.complete?.();
        return;
      }
      let count = 0;
      const sub = this.subscribe({
        next: (value) => {
          if ((observer as SafeSubscriber<T>).closed) return;
          count++;
          observer.next(value);
          if (count >= n) {
            observer.complete?.();
          }
        },
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Skip the first n values. */
  skip(n: number): RxObservable<T> {
    return new RxObservable<T>((observer) => {
      let skipped = 0;
      const sub = this.subscribe({
        next: (value) => {
          if (skipped < n) {
            skipped++;
          } else {
            observer.next(value);
          }
        },
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Merge this observable with another — interleave both streams. */
  merge(other: RxObservable<T>): RxObservable<T> {
    return new RxObservable<T>((observer) => {
      let completedCount = 0;
      const onComplete = () => {
        completedCount++;
        if (completedCount === 2) observer.complete?.();
      };
      const subA = this.subscribe({
        next: (value) => observer.next(value),
        error: (err) => observer.error?.(err),
        complete: onComplete,
      });
      const subB = other.subscribe({
        next: (value) => observer.next(value),
        error: (err) => observer.error?.(err),
        complete: onComplete,
      });
      return () => {
        subA.unsubscribe();
        subB.unsubscribe();
      };
    });
  }

  /** Collect all values into an array when the observable completes. */
  toArray(): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const values: T[] = [];
      this.subscribe({
        next: (value) => values.push(value),
        error: reject,
        complete: () => resolve(values),
      });
    });
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Create an observable that synchronously emits the given values then completes. */
export function of<T>(...values: T[]): RxObservable<T> {
  return new RxObservable<T>((observer) => {
    for (const value of values) {
      if ((observer as SafeSubscriber<T>).closed) return;
      observer.next(value);
    }
    observer.complete?.();
  });
}

/** Create an observable from any synchronous iterable. */
export function from<T>(iterable: Iterable<T>): RxObservable<T> {
  return new RxObservable<T>((observer) => {
    for (const value of iterable) {
      if ((observer as SafeSubscriber<T>).closed) return;
      observer.next(value);
    }
    observer.complete?.();
  });
}

/** Create an observable that emits incrementing integers at the given interval (ms). */
export function interval(ms: number): RxObservable<number> {
  return new RxObservable<number>((observer) => {
    let count = 0;
    const id = setInterval(() => {
      observer.next(count++);
    }, ms);
    return () => clearInterval(id);
  });
}

/** Wrap a Promise as a single-value Observable. */
export function fromPromise<T>(p: Promise<T>): RxObservable<T> {
  return new RxObservable<T>((observer) => {
    p.then(
      (value) => {
        observer.next(value);
        observer.complete?.();
      },
      (err) => observer.error?.(err),
    );
  });
}
