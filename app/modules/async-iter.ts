// @ts-check
// ─── Async Iterator Utilities ─────────────────────────────────────────────────
// Helpers for working with async iterables and generators.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Create an async iterable from an array. */
export async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/** Map over an async iterable, applying `fn` to each item. */
export async function* mapAsync<T, U>(
  iter: AsyncIterable<T>,
  fn: (item: T) => T | U | Promise<T | U>,
): AsyncGenerator<U> {
  for await (const item of iter) {
    yield (await fn(item)) as U;
  }
}

/** Filter an async iterable, yielding only items for which `fn` returns true. */
export async function* filterAsync<T>(
  iter: AsyncIterable<T>,
  fn: (item: T) => boolean | Promise<boolean>,
): AsyncGenerator<T> {
  for await (const item of iter) {
    if (await fn(item)) {
      yield item;
    }
  }
}

/** Take the first `n` items from an async iterable. */
export async function* takeAsync<T>(iter: AsyncIterable<T>, n: number): AsyncGenerator<T> {
  if (n <= 0) return;
  let count = 0;
  for await (const item of iter) {
    yield item;
    count++;
    if (count >= n) break;
  }
}

/** Collect all items from an async iterable into an array. */
export async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

/**
 * Merge multiple async iterables, interleaving their values as they become
 * available. All iterables are consumed concurrently.
 */
export async function* mergeAsync<T>(...iters: AsyncIterable<T>[]): AsyncGenerator<T> {
  if (iters.length === 0) return;

  // Use a shared queue + promise chaining approach
  type QueueItem = { done: false; value: T } | { done: true };
  const queue: QueueItem[] = [];
  let waiting: (() => void) | null = null;
  let activeCount = iters.length;

  function enqueue(item: QueueItem): void {
    queue.push(item);
    if (waiting) {
      const wake = waiting;
      waiting = null;
      wake();
    }
  }

  for (const iter of iters) {
    (async () => {
      try {
        for await (const value of iter) {
          enqueue({ done: false, value });
        }
      } finally {
        activeCount--;
        enqueue({ done: true });
      }
    })();
  }

  let completedCount = 0;
  while (completedCount < iters.length) {
    while (queue.length === 0) {
      await new Promise<void>((resolve) => {
        waiting = resolve;
      });
    }

    const item = queue.shift()!;
    if (item.done) {
      completedCount++;
    } else {
      yield item.value;
    }
  }
}

/** Batch items from an async iterable into chunks of `size`. */
export async function* batchAsync<T>(iter: AsyncIterable<T>, size: number): AsyncGenerator<T[]> {
  if (size <= 0) return;
  let batch: T[] = [];
  for await (const item of iter) {
    batch.push(item);
    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Create an async iterable that emits incrementing numbers (0, 1, 2, …) at
 * regular `ms` millisecond intervals.  If `count` is provided the generator
 * stops after emitting `count` values.
 */
export async function* interval(ms: number, count?: number): AsyncGenerator<number> {
  let i = 0;
  while (count === undefined || i < count) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    yield i++;
  }
}
