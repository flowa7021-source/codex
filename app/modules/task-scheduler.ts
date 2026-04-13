// ─── Task Scheduler ─────────────────────────────────────────────────────────
// Priority-based task scheduling using the Scheduler API (scheduler.postTask).
// Fallback chain: scheduler.postTask → requestIdleCallback → setTimeout.

type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

interface PostTaskOptions {
  priority?: TaskPriority;
  delay?: number;
  signal?: AbortSignal;
}

/**
 * Check whether the Scheduler API (scheduler.postTask) is available.
 */
export function isSchedulerSupported(): boolean {
  return (
    typeof (globalThis as any).scheduler !== 'undefined' &&
    typeof (globalThis as any).scheduler.postTask === 'function'
  );
}

/**
 * Schedule a task with optional priority, delay, and abort signal.
 *
 * Uses the native Scheduler API when available, falls back to
 * requestIdleCallback for background tasks, and finally to setTimeout.
 */
export function postTask(callback: () => any, options?: PostTaskOptions): Promise<any> {
  const priority = options?.priority ?? 'user-visible';
  const delay = options?.delay ?? 0;
  const signal = options?.signal;

  // Native scheduler.postTask path
  if (isSchedulerSupported()) {
    return (globalThis as any).scheduler.postTask(callback, { priority, delay, signal });
  }

  // Fallback path
  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('The operation was aborted.'));
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | undefined;

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
 */
export function postUserBlockingTask(callback: () => any): Promise<any> {
  return postTask(callback, { priority: 'user-blocking' });
}

/**
 * Shorthand: schedule a background priority task.
 */
export function postBackgroundTask(callback: () => any): Promise<any> {
  return postTask(callback, { priority: 'background' });
}

/**
 * Yield to the main thread so the browser can handle pending work
 * (rendering, input events, etc.) before resuming.
 *
 * Uses `scheduler.yield()` when available, otherwise falls back to
 * `setTimeout(0)`.
 */
export function yieldToMain(): Promise<void> {
  if (
    typeof (globalThis as any).scheduler !== 'undefined' &&
    typeof ((globalThis as any).scheduler as any).yield === 'function'
  ) {
    return ((globalThis as any).scheduler as any).yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
