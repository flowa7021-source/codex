// @ts-check
// ─── Sync Queue ───────────────────────────────────────────────────────────────
// Offline-first sync queue for operations that need to be retried.

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncItem<T = unknown> {
  id: string;
  operation: string;
  payload: T;
  status: SyncStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface SyncQueueOptions {
  maxAttempts?: number;  // default 3
  retryDelayMs?: number; // default 1000
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `sync-${Date.now()}-${_counter}`;
}

// ─── SyncQueue ────────────────────────────────────────────────────────────────

export class SyncQueue<T = unknown> {
  #items: SyncItem<T>[] = [];
  #maxAttempts: number;
  #retryDelayMs: number;

  constructor(options?: SyncQueueOptions) {
    this.#maxAttempts = options?.maxAttempts ?? 3;
    this.#retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Add an item to the sync queue. Returns the newly created item. */
  enqueue(operation: string, payload: T): SyncItem<T> {
    const item: SyncItem<T> = {
      id: generateId(),
      operation,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.#maxAttempts,
      createdAt: Date.now(),
    };
    this.#items.push(item);
    return item;
  }

  /**
   * Process the queue with a sync function.
   * Runs the syncFn for each pending item (and failed items that still have
   * attempts remaining). Marks items as 'synced' on success or increments
   * attempts and marks as 'failed' when maxAttempts is exhausted.
   */
  async process(syncFn: (item: SyncItem<T>) => Promise<void>): Promise<void> {
    const candidates = this.#items.filter(
      (item) =>
        item.status === 'pending' ||
        (item.status === 'failed' && item.attempts < item.maxAttempts),
    );

    for (const item of candidates) {
      item.status = 'syncing';
      item.attempts++;
      item.lastAttemptAt = Date.now();

      try {
        await syncFn(item);
        item.status = 'synced';
        item.error = undefined;
      } catch (err) {
        item.error = err instanceof Error ? err.message : String(err);
        item.status = 'failed';
      }
    }
  }

  /** Get all items (all statuses). */
  getAll(): SyncItem<T>[] {
    return this.#items.slice();
  }

  /** Get items filtered by status. */
  getByStatus(status: SyncStatus): SyncItem<T>[] {
    return this.#items.filter((item) => item.status === status);
  }

  /** Remove all items with status 'synced'. */
  clearSynced(): void {
    this.#items = this.#items.filter((item) => item.status !== 'synced');
  }

  /** Remove all items from the queue. */
  clear(): void {
    this.#items = [];
  }

  /** Number of pending items. */
  get pendingCount(): number {
    return this.#items.filter((item) => item.status === 'pending').length;
  }

  /** Number of synced items. */
  get syncedCount(): number {
    return this.#items.filter((item) => item.status === 'synced').length;
  }

  /** Number of failed items. */
  get failedCount(): number {
    return this.#items.filter((item) => item.status === 'failed').length;
  }
}
