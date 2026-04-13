// @ts-check
// ─── IndexedDB Wrapper ────────────────────────────────────────────────────────
// Type-safe IndexedDB wrapper with in-memory fallback for Node.js environments.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DBSchema {
  [storeName: string]: {
    key: string | number;
    value: unknown;
    indexes?: Record<string, string>;
  };
}

export interface IDBWrapperOptions {
  /** Database name. */
  name: string;
  /** Database version. Default: 1 */
  version?: number;
  /** Use in-memory Map-based fallback (always used when IndexedDB is unavailable). */
  inMemory?: boolean;
}

// ─── In-memory store ─────────────────────────────────────────────────────────

/**
 * A lightweight in-memory substitute for a single object store.
 * Keys are coerced to strings for consistent lookup.
 */
class InMemoryStore {
  #records: Map<string, unknown> = new Map();

  put(key: string | number, value: unknown): void {
    this.#records.set(String(key), value);
  }

  get(key: string | number): unknown | undefined {
    return this.#records.get(String(key));
  }

  delete(key: string | number): void {
    this.#records.delete(String(key));
  }

  getAll(): unknown[] {
    return Array.from(this.#records.values());
  }

  clear(): void {
    this.#records.clear();
  }

  count(): number {
    return this.#records.size;
  }
}

// ─── IDBWrapper ───────────────────────────────────────────────────────────────

export class IDBWrapper<Schema extends DBSchema> {
  #name: string;
  #version: number;
  #inMemory: boolean;
  #stores: Map<string, InMemoryStore> = new Map();
  #db: IDBDatabase | null = null;
  #opened = false;

  constructor(options: IDBWrapperOptions) {
    this.#name = options.name;
    this.#version = options.version ?? 1;
    // Force in-memory when explicitly requested OR when IndexedDB is unavailable
    this.#inMemory = options.inMemory === true || typeof indexedDB === 'undefined';
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  #getInMemoryStore(store: string): InMemoryStore {
    if (!this.#stores.has(store)) {
      this.#stores.set(store, new InMemoryStore());
    }
    return this.#stores.get(store)!;
  }

  #assertOpen(): void {
    if (!this.#opened) {
      throw new Error('IDBWrapper: call open() before using the database');
    }
  }

  // ─── IDB promise helpers ────────────────────────────────────────────────────

  #idbRequest<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  #idbTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    fn: (tx: IDBTransaction) => Promise<unknown>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = this.#db!.transaction(storeNames, mode);
      fn(tx).then(() => resolve()).catch(reject);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IDB transaction aborted'));
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Open the database. Must be called before any other method. */
  async open(): Promise<void> {
    if (this.#opened) return;

    if (this.#inMemory) {
      // Nothing to initialise for the in-memory path
      this.#opened = true;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(this.#name, this.#version);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create any stores present in the schema that don't exist yet.
        // We rely on the caller to use put() for writing; no keyPath is required.
        // Since we don't have the schema at runtime (it's a TS generic), we do
        // nothing here — callers are expected to pre-create stores if needed.
        void db;
      };

      req.onsuccess = (event) => {
        this.#db = (event.target as IDBOpenDBRequest).result;
        this.#opened = true;
        resolve();
      };

      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IDB open blocked'));
    });
  }

  /** Put (insert or replace) a record in the given store. */
  async put<S extends keyof Schema>(store: S, value: Schema[S]['value']): Promise<void> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      // In-memory: use a monotonically increasing key if value has no 'id'
      const s = this.#getInMemoryStore(storeName);
      const record = value as Record<string, unknown>;
      const key = record['id'] ?? record['key'] ?? s.count();
      s.put(key as string | number, value);
      return;
    }

    await this.#idbTransaction(storeName, 'readwrite', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      await this.#idbRequest(objectStore.put(value));
    });
  }

  /** Get a record by key. Returns undefined if not found. */
  async get<S extends keyof Schema>(
    store: S,
    key: Schema[S]['key'],
  ): Promise<Schema[S]['value'] | undefined> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      return this.#getInMemoryStore(storeName).get(key) as Schema[S]['value'] | undefined;
    }

    return this.#idbTransaction(storeName, 'readonly', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      return this.#idbRequest<Schema[S]['value']>(objectStore.get(key as IDBValidKey));
    }) as Promise<Schema[S]['value'] | undefined>;
  }

  /** Delete a record by key. */
  async delete<S extends keyof Schema>(store: S, key: Schema[S]['key']): Promise<void> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      this.#getInMemoryStore(storeName).delete(key);
      return;
    }

    await this.#idbTransaction(storeName, 'readwrite', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      await this.#idbRequest(objectStore.delete(key as IDBValidKey));
    });
  }

  /** Get all records in a store. */
  async getAll<S extends keyof Schema>(store: S): Promise<Schema[S]['value'][]> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      return this.#getInMemoryStore(storeName).getAll() as Schema[S]['value'][];
    }

    return this.#idbTransaction(storeName, 'readonly', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      return this.#idbRequest<Schema[S]['value'][]>(objectStore.getAll());
    }) as unknown as Promise<Schema[S]['value'][]>;
  }

  /** Clear all records in a store. */
  async clearStore<S extends keyof Schema>(store: S): Promise<void> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      this.#getInMemoryStore(storeName).clear();
      return;
    }

    await this.#idbTransaction(storeName, 'readwrite', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      await this.#idbRequest(objectStore.clear());
    });
  }

  /** Count records in a store. */
  async count<S extends keyof Schema>(store: S): Promise<number> {
    this.#assertOpen();
    const storeName = store as string;

    if (this.#inMemory) {
      return this.#getInMemoryStore(storeName).count();
    }

    return this.#idbTransaction(storeName, 'readonly', async (tx) => {
      const objectStore = tx.objectStore(storeName);
      return this.#idbRequest<number>(objectStore.count());
    }) as unknown as Promise<number>;
  }

  /** Close the database connection. */
  close(): void {
    if (this.#inMemory) {
      this.#opened = false;
      return;
    }
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
    this.#opened = false;
  }
}
