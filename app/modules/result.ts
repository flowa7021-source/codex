// @ts-check
// ─── Result / Option Monads ──────────────────────────────────────────────────
// Rust-inspired Result<T, E> and Option<T> types for explicit error handling.

// ─── Option ──────────────────────────────────────────────────────────────────

export type Option<T> = Some<T> | None<T>;

export class Some<T> {
  readonly some = true as const;
  readonly value: T;

  constructor(value: T) { this.value = value; }

  map<U>(fn: (val: T) => U): Option<U> {
    return new Some(fn(this.value));
  }

  flatMap<U>(fn: (val: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultVal: T): T {
    return this.value;
  }

  filter(fn: (val: T) => boolean): Option<T> {
    return fn(this.value) ? this : (none as unknown as None<T>);
  }

  match<U>(onSome: (val: T) => U, _onNone: () => U): U {
    return onSome(this.value);
  }

  toResult<E>(_err: E): Result<T, E> {
    return new Ok(this.value);
  }
}

export class None<T = never> {
  readonly some = false as const;

  map<U>(_fn: (val: T) => U): Option<U> {
    return this as unknown as None<U>;
  }

  flatMap<U>(_fn: (val: T) => Option<U>): Option<U> {
    return this as unknown as None<U>;
  }

  unwrap(): never {
    throw new Error('Called unwrap() on None');
  }

  unwrapOr(defaultVal: T): T {
    return defaultVal;
  }

  filter(_fn: (val: T) => boolean): Option<T> {
    return this;
  }

  match<U>(_onSome: (val: T) => U, onNone: () => U): U {
    return onNone();
  }

  toResult<E>(err: E): Result<T, E> {
    return new Err(err);
  }
}

/** Singleton None instance. */
export const none: None = new None();

// ─── Result ───────────────────────────────────────────────────────────────────

export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E = Error> {
  readonly ok = true as const;
  readonly value: T;

  constructor(value: T) { this.value = value; }

  map<U>(fn: (val: T) => U): Result<U, E> {
    return new Ok<U, E>(fn(this.value));
  }

  flatMap<U>(fn: (val: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  mapErr<F>(_fn: (err: E) => F): Result<T, F> {
    return new Ok<T, F>(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultVal: T): T {
    return this.value;
  }

  unwrapOrElse(_fn: (err: E) => T): T {
    return this.value;
  }

  match<U>(onOk: (val: T) => U, _onErr: (err: E) => U): U {
    return onOk(this.value);
  }

  toOption(): Option<T> {
    return new Some(this.value);
  }
}

export class Err<T, E = Error> {
  readonly ok = false as const;
  readonly error: E;

  constructor(error: E) { this.error = error; }

  map<U>(_fn: (val: T) => U): Result<U, E> {
    return new Err<U, E>(this.error);
  }

  flatMap<U>(_fn: (val: T) => Result<U, E>): Result<U, E> {
    return new Err<U, E>(this.error);
  }

  mapErr<F>(fn: (err: E) => F): Result<T, F> {
    return new Err<T, F>(fn(this.error));
  }

  unwrap(): never {
    const msg =
      this.error instanceof Error
        ? this.error.message
        : String(this.error);
    throw new Error(`Called unwrap() on Err: ${msg}`);
  }

  unwrapOr(defaultVal: T): T {
    return defaultVal;
  }

  unwrapOrElse(fn: (err: E) => T): T {
    return fn(this.error);
  }

  match<U>(_onOk: (val: T) => U, onErr: (err: E) => U): U {
    return onErr(this.error);
  }

  toOption(): Option<T> {
    return none as unknown as None<T>;
  }
}

// ─── Constructors ────────────────────────────────────────────────────────────

export function ok<T, E = Error>(value: T): Ok<T, E> {
  return new Ok<T, E>(value);
}

export function err<T, E = Error>(error: E): Err<T, E> {
  return new Err<T, E>(error);
}

export function some<T>(value: T): Some<T> {
  return new Some(value);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Call `fn` synchronously.  Returns `Ok(value)` on success or `Err(error)` if
 * `fn` throws.
 */
export function fromThrowable<T>(fn: () => T): Result<T, Error> {
  try {
    return new Ok(fn());
  } catch (thrown) {
    return new Err(thrown instanceof Error ? thrown : new Error(String(thrown)));
  }
}

/**
 * Await `p`.  Returns `Ok(value)` on resolution or `Err(error)` on rejection.
 */
export async function fromPromise<T>(p: Promise<T>): Promise<Result<T, Error>> {
  try {
    return new Ok(await p);
  } catch (thrown) {
    return new Err(thrown instanceof Error ? thrown : new Error(String(thrown)));
  }
}
