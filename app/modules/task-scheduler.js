// @ts-check
// ─── Task Scheduler ─────────────────────────────────────────────────────────
// Priority-based task scheduling using the Scheduler API (scheduler.postTask).
// Fallback chain: scheduler.postTask → requestIdleCallback → setTimeout.

/**
 * @typedef {'user-blocking' | 'user-visible' | 'background'} TaskPriority
 */

/**
 * @typedef {Object} PostTaskOptions
 * @property {TaskPriority} [priority='user-visible']
 * @property {number} [delay]
 * @property {AbortSignal} [signal]
 */

/**
 * Check whether the Scheduler API (scheduler.postTask) is available.
 * @returns {boolean}
 */
export function isSchedulerSupported() {
  return (
    typeof globalThis.scheduler !== 'undefined' &&
    typeof globalThis.scheduler.postTask === 'function'
  );
}

/**
 * Schedule a task with optional priority, delay, and abort signal.
 *
 * Uses the native Scheduler API when available, falls back to
 * requestIdleCallback for background tasks, and finally to setTimeout.
 *
 * @param {() => any} callback
 * @param {PostTaskOptions} [options]
 * @returns {Promise<any>} resolves with the callback's return value
 */
export function postTask(callback, options) {
  const priority = options?.priority ?? 'user-visible';
  const delay = options?.delay ?? 0;
  const signal = options?.signal;

  // Native scheduler.postTask path
  if (isSchedulerSupported()) {
    return globalThis.scheduler.postTask(callback, { priority, delay, signal });
  }

  // Fallback path
  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('The operation was aborted.'));
      return;
    }

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timerId;

    const onAbort = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      reject(signal?.reason ?? new Error('The operation was aborted.'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const run = () => {
      if (signal?.aborted) {
        reject(signal.reason ?? new Error('The operation was aborted.'));
        return;
      }
      try {
        resolve(callback());
      } catch (err) {
        reject(err);
      } finally {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      }
    };

    if (delay > 0) {
      // When a delay is specified, use setTimeout regardless of priority
      timerId = setTimeout(run, delay);
    } else if (
      priority === 'background' &&
      typeof globalThis.requestIdleCallback === 'function'
    ) {
      // Background tasks use requestIdleCallback when available
      globalThis.requestIdleCallback(run);
    } else {
      // user-blocking / user-visible: run ASAP via setTimeout(0)
      // background without requestIdleCallback: setTimeout(1)
      const ms = priority === 'background' ? 1 : 0;
      timerId = setTimeout(run, ms);
    }
  });
}

/**
 * Shorthand: schedule a user-blocking priority task.
 * @param {() => any} callback
 * @returns {Promise<any>}
 */
export function postUserBlockingTask(callback) {
  return postTask(callback, { priority: 'user-blocking' });
}

/**
 * Shorthand: schedule a background priority task.
 * @param {() => any} callback
 * @returns {Promise<any>}
 */
export function postBackgroundTask(callback) {
  return postTask(callback, { priority: 'background' });
}

/**
 * Yield to the main thread so the browser can handle pending work
 * (rendering, input events, etc.) before resuming.
 *
 * Uses `scheduler.yield()` when available, otherwise falls back to
 * `setTimeout(0)`.
 *
 * @returns {Promise<void>}
 */
export function yieldToMain() {
  if (
    typeof globalThis.scheduler !== 'undefined' &&
    typeof globalThis.scheduler.yield === 'function'
  ) {
    return globalThis.scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
