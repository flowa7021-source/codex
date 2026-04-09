// @ts-check
// ─── Timer Utilities ─────────────────────────────────────────────────────────
// Timer management: registry, sleep, timeout, measurement, debounce, throttle.
// No browser APIs — pure Node.js / universal JS.

// ─── Types ───────────────────────────────────────────────────────────────────

/** Controllable timer for testing. */
export interface Timer {
  id: number;
  type: 'timeout' | 'interval';
  delay: number;
  callback: () => void;
  scheduledAt: number;
  nextTick?: number;
}

// ─── TimerRegistry ───────────────────────────────────────────────────────────

/**
 * A timer registry that tracks and can cancel all timers.
 * Wraps the global setTimeout / setInterval and keeps a live map of
 * every timer that has been registered so they can be cleared in bulk.
 */
export class TimerRegistry {
  #map = new Map<number, Timer>();
  #nextId = 1;

  /** Set a timeout. Returns timer id. */
  setTimeout(callback: () => void, delay: number): number {
    const id = this.#nextId++;
    const scheduledAt = Date.now();

    const wrappedCallback = () => {
      this.#map.delete(id);
      callback();
    };

    // Use the real global timer (not overridable) so the registry works in all
    // environments, including ones that stub globalThis.setTimeout.
    const nativeId = globalThis.setTimeout(wrappedCallback, delay);

    this.#map.set(id, {
      id,
      type: 'timeout',
      delay,
      callback,
      scheduledAt,
      nextTick: scheduledAt + delay,
    });

    // Store native id on the Timer object for cancellation (we need it
    // internally but do not expose it in the public interface).
    (this.#map.get(id) as Timer & { _nativeId: ReturnType<typeof globalThis.setTimeout> })._nativeId = nativeId;

    return id;
  }

  /** Set an interval. Returns timer id. */
  setInterval(callback: () => void, delay: number): number {
    const id = this.#nextId++;
    const scheduledAt = Date.now();

    const nativeId = globalThis.setInterval(callback, delay);

    this.#map.set(id, {
      id,
      type: 'interval',
      delay,
      callback,
      scheduledAt,
      nextTick: scheduledAt + delay,
    });

    (this.#map.get(id) as Timer & { _nativeId: ReturnType<typeof globalThis.setInterval> })._nativeId = nativeId;

    return id;
  }

  /** Clear a specific timer. */
  clear(id: number): void {
    const timer = this.#map.get(id) as (Timer & { _nativeId: ReturnType<typeof globalThis.setTimeout> }) | undefined;
    if (!timer) return;
    if (timer.type === 'timeout') {
      globalThis.clearTimeout(timer._nativeId);
    } else {
      globalThis.clearInterval(timer._nativeId);
    }
    this.#map.delete(id);
  }

  /** Clear all registered timers. */
  clearAll(): void {
    for (const id of this.#map.keys()) {
      this.clear(id);
    }
  }

  /** Get all active timers. */
  getAll(): Timer[] {
    return [...this.#map.values()];
  }

  /** Get active timer count. */
  get count(): number {
    return this.#map.size;
  }
}

// ─── sleep ───────────────────────────────────────────────────────────────────

/** Sleep for N milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

// ─── withTimeout ─────────────────────────────────────────────────────────────

/** Execute a function with a timeout. Throws if timeout exceeded. */
export function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = globalThis.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);

    fn().then(
      (value) => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timer);
          resolve(value);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timer);
          reject(err);
        }
      },
    );
  });
}

// ─── measureTime ─────────────────────────────────────────────────────────────

/** Measure execution time of a function. Returns [result, durationMs]. */
export function measureTime<T>(fn: () => T): [T, number] {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  return [result, duration];
}

/** Measure async execution time. */
export async function measureTimeAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return [result, duration];
}

// ─── debounce ────────────────────────────────────────────────────────────────

/**
 * Create a debounced function (delays execution until N ms after last call).
 * Trailing-edge debounce: the function runs after the last call in a burst.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

  return function (...args: Parameters<T>): void {
    if (timer !== undefined) {
      globalThis.clearTimeout(timer);
    }
    timer = globalThis.setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delay);
  };
}

// ─── throttle ────────────────────────────────────────────────────────────────

/**
 * Create a throttled function (max once per N ms).
 * Leading-edge throttle: the first call in a burst fires immediately, then
 * subsequent calls within the window are ignored.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = -Infinity;

  return function (...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}
