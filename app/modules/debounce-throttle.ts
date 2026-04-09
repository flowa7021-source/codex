// @ts-check
// ─── Debounce / Throttle Utilities ───────────────────────────────────────────
// Timing helpers: debounce, throttle, debouncedPromise, delay, onFrame.

// ─── debounce ────────────────────────────────────────────────────────────────

/**
 * Return a debounced version of fn that waits `wait` ms after the last call
 * before invoking fn. The returned function also exposes:
 *   .cancel() — cancel a pending invocation
 *   .flush()  — run fn immediately if a call is pending
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
): ((...args: Parameters<T>) => void) & { cancel(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  function debounced(...args: Parameters<T>): void {
    pendingArgs = args;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      const a = pendingArgs!;
      pendingArgs = null;
      fn(...a);
    }, wait);
  }

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  debounced.flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const a = pendingArgs!;
      pendingArgs = null;
      fn(...a);
    }
  };

  return debounced;
}

// ─── throttle ────────────────────────────────────────────────────────────────

/**
 * Return a throttled version of fn that runs at most once per `interval` ms.
 * The first call runs immediately. Subsequent calls within the interval are
 * dropped. The returned function also exposes:
 *   .cancel() — cancel any pending trailing invocation
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number,
): ((...args: Parameters<T>) => void) & { cancel(): void } {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    const remaining = interval - (now - lastRun);

    if (remaining <= 0) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      lastRun = now;
      fn(...args);
    } else {
      // schedule trailing call
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        lastRun = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }

  throttled.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastRun = 0;
  };

  return throttled;
}

// ─── debouncedPromise ─────────────────────────────────────────────────────────

/**
 * Like debounce but returns a Promise that resolves with the fn return value.
 * All callers within the wait window share the same Promise resolution.
 */
export function debouncedPromise<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;
  let resolve: ((value: ReturnType<T>) => void) | null = null;
  let reject: ((reason?: any) => void) | null = null;
  let promise: Promise<ReturnType<T>> | null = null;

  return function (...args: Parameters<T>): Promise<ReturnType<T>> {
    pendingArgs = args;

    if (timer !== null) {
      clearTimeout(timer);
    }

    if (promise === null) {
      promise = new Promise<ReturnType<T>>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    }

    timer = setTimeout(() => {
      timer = null;
      const a = pendingArgs!;
      const res = resolve!;
      const rej = reject!;
      pendingArgs = null;
      promise = null;
      resolve = null;
      reject = null;
      try {
        const result = fn(...a) as ReturnType<T>;
        res(result);
      } catch (err) {
        rej(err);
      }
    }, wait);

    return promise;
  };
}

// ─── delay ───────────────────────────────────────────────────────────────────

/**
 * Run fn once after a delay of `ms` milliseconds.
 * Returns a cancel function that prevents fn from running if called before the
 * timeout fires.
 */
export function delay(fn: () => void, ms: number): () => void {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
}

// ─── onFrame ─────────────────────────────────────────────────────────────────

/**
 * Run fn on every animation frame. Uses requestAnimationFrame when available,
 * otherwise falls back to a 16 ms setTimeout loop.
 * Returns a cancel function.
 */
export function onFrame(fn: (timestamp: number) => void): () => void {
  let cancelled = false;
  let handle: number | ReturnType<typeof setTimeout> | null = null;

  if (typeof requestAnimationFrame === 'function') {
    const loop = (ts: number): void => {
      if (cancelled) return;
      fn(ts);
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
  } else {
    const loop = (): void => {
      if (cancelled) return;
      fn(Date.now());
      handle = setTimeout(loop, 16);
    };
    handle = setTimeout(loop, 16);
  }

  return (): void => {
    cancelled = true;
    if (handle !== null) {
      if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') {
        cancelAnimationFrame(handle);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
      handle = null;
    }
  };
}
