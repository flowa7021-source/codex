// @ts-check
// ─── SimpleDB ────────────────────────────────────────────────────────────────
// In-memory key-value store with querying, transactions, and events.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryOptions<T> {
  where?: Partial<T> | ((item: T) => boolean);
  orderBy?: keyof T;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export type CollectionEvent = 'insert' | 'update' | 'delete';

export interface Collection<T extends { id: string | number }> {
  insert(item: T): T;
  insertMany(items: T[]): T[];
  findById(id: string | number): T | undefined;
  find(options?: QueryOptions<T>): T[];
  findOne(options?: QueryOptions<T>): T | undefined;
  update(id: string | number, changes: Partial<T>): T | undefined;
  upsert(item: T): T;
  delete(id: string | number): boolean;
  deleteWhere(predicate: (item: T) => boolean): number;
  count(predicate?: (item: T) => boolean): number;
  batch(fn: (col: Collection<T>) => void): void;
  on(event: CollectionEvent, listener: (item: T) => void): () => void;
  toArray(): T[];
  clear(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deep-clone an item using JSON round-trip (fast, sufficient for plain data). */
function clone<T>(item: T): T {
  return JSON.parse(JSON.stringify(item));
}

/** Apply a `where` predicate from QueryOptions. */
function matchesWhere<T>(item: T, where: Partial<T> | ((item: T) => boolean)): boolean {
  if (typeof where === 'function') {
    return where(item);
  }
  for (const key of Object.keys(where) as Array<keyof T>) {
    if (item[key] !== where[key]) return false;
  }
  return true;
}

/** Apply full query options to an array of items (mutates a working copy). */
function applyQuery<T extends { id: string | number }>(
  items: T[],
  options: QueryOptions<T> = {},
): T[] {
  let result = items.slice();

  // filter
  if (options.where !== undefined) {
    const where = options.where;
    result = result.filter((item) => matchesWhere(item, where));
  }

  // sort
  if (options.orderBy !== undefined) {
    const field = options.orderBy;
    const dir = options.order === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * dir;
    });
  }

  // offset
  if (options.offset !== undefined && options.offset > 0) {
    result = result.slice(options.offset);
  }

  // limit
  if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result;
}

// ─── CollectionImpl ───────────────────────────────────────────────────────────

class CollectionImpl<T extends { id: string | number }> implements Collection<T> {
  #store: Map<string | number, T> = new Map();
  #listeners: Map<CollectionEvent, Set<(item: T) => void>> = new Map([
    ['insert', new Set()],
    ['update', new Set()],
    ['delete', new Set()],
  ]);

  // ── internal helpers ────────────────────────────────────────────────────────

  #emit(event: CollectionEvent, item: T): void {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      for (const fn of listeners) fn(item);
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  insert(item: T): T {
    if (this.#store.has(item.id)) {
      throw new Error(`Item with id "${item.id}" already exists`);
    }
    const stored = clone(item);
    this.#store.set(item.id, stored);
    this.#emit('insert', clone(stored));
    return clone(stored);
  }

  insertMany(items: T[]): T[] {
    return items.map((item) => this.insert(item));
  }

  findById(id: string | number): T | undefined {
    const item = this.#store.get(id);
    return item !== undefined ? clone(item) : undefined;
  }

  find(options: QueryOptions<T> = {}): T[] {
    const all = Array.from(this.#store.values()).map(clone);
    return applyQuery(all, options);
  }

  findOne(options: QueryOptions<T> = {}): T | undefined {
    const results = this.find({ ...options, limit: 1 });
    return results[0];
  }

  update(id: string | number, changes: Partial<T>): T | undefined {
    const existing = this.#store.get(id);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...changes, id } as T;
    this.#store.set(id, updated);
    this.#emit('update', clone(updated));
    return clone(updated);
  }

  upsert(item: T): T {
    if (this.#store.has(item.id)) {
      return this.update(item.id, item) as T;
    }
    return this.insert(item);
  }

  delete(id: string | number): boolean {
    const existing = this.#store.get(id);
    if (existing === undefined) return false;
    this.#store.delete(id);
    this.#emit('delete', clone(existing));
    return true;
  }

  deleteWhere(predicate: (item: T) => boolean): number {
    let count = 0;
    for (const [id, item] of this.#store) {
      if (predicate(item)) {
        this.#store.delete(id);
        this.#emit('delete', clone(item));
        count++;
      }
    }
    return count;
  }

  count(predicate?: (item: T) => boolean): number {
    if (predicate === undefined) return this.#store.size;
    let n = 0;
    for (const item of this.#store.values()) {
      if (predicate(item)) n++;
    }
    return n;
  }

  // ── Transactions (batch) ────────────────────────────────────────────────────

  batch(fn: (col: Collection<T>) => void): void {
    // Snapshot current state for rollback.
    const snapshot = new Map(
      Array.from(this.#store.entries()).map(([k, v]) => [k, clone(v)]),
    );
    try {
      fn(this);
    } catch (err) {
      // Rollback: restore snapshot, suppress any further events for the roll-back
      this.#store = snapshot;
      throw err;
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  on(event: CollectionEvent, listener: (item: T) => void): () => void {
    const listeners = this.#listeners.get(event);
    if (!listeners) throw new Error(`Unknown event: ${event}`);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // ── Export / Import ─────────────────────────────────────────────────────────

  toArray(): T[] {
    return Array.from(this.#store.values()).map(clone);
  }

  clear(): void {
    this.#store.clear();
  }
}

// ─── SimpleDB ─────────────────────────────────────────────────────────────────

export class SimpleDB {
  #collections: Map<string, CollectionImpl<{ id: string | number }>> = new Map();

  collection<T extends { id: string | number }>(name: string): Collection<T> {
    if (!this.#collections.has(name)) {
      this.#collections.set(name, new CollectionImpl<T>() as unknown as CollectionImpl<{ id: string | number }>);
    }
    return this.#collections.get(name) as unknown as Collection<T>;
  }

  dropCollection(name: string): boolean {
    return this.#collections.delete(name);
  }

  get collectionNames(): string[] {
    return Array.from(this.#collections.keys());
  }
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * Create a new SimpleDB instance.
 *
 * @example
 *   const db = createDB();
 *   const users = db.collection('users');
 *   users.insert({ id: 1, name: 'Alice' });
 */
export function createDB(): SimpleDB {
  return new SimpleDB();
}

/**
 * Create a standalone Collection (without a parent DB).
 * Optionally pre-populate with items.
 *
 * @example
 *   const col = createCollection([{ id: 1, name: 'Alice' }]);
 *   col.find(); // [{ id: 1, name: 'Alice' }]
 */
export function createCollection<T extends { id: string | number }>(items?: T[]): Collection<T> {
  const col = new CollectionImpl<T>();
  if (items) {
    for (const item of items) {
      col.insert(item);
    }
  }
  return col;
}
