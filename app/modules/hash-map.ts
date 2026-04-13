// @ts-check
// ─── Open-Addressing HashMap ────────────────────────────────────────────────
// Generic hash map using linear probing for collision resolution.
// Automatically resizes when the load factor exceeds 0.75.

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CAPACITY = 16;
const MAX_LOAD_FACTOR = 0.75;
const DELETED = Symbol('DELETED');

// ─── Types ──────────────────────────────────────────────────────────────────

export type HashFn<K> = (key: K) => number;

interface Slot<K, V> {
  key: K;
  value: V;
}

// ─── Default hash function ──────────────────────────────────────────────────

function defaultHash<K>(key: K): number {
  const str = String(key);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// ─── HashMap ────────────────────────────────────────────────────────────────

/**
 * Open-addressing hash map with linear probing.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const map = new HashMap<string, number>();
 *   map.set('x', 42);
 *   map.get('x'); // 42
 */
export class HashMap<K, V> {
  #slots: (Slot<K, V> | typeof DELETED | undefined)[];
  #capacity: number;
  #size: number;
  #hashFn: HashFn<K>;

  constructor(capacity?: number, hashFn?: HashFn<K>) {
    this.#capacity = capacity && capacity > 0 ? capacity : DEFAULT_CAPACITY;
    this.#slots = new Array(this.#capacity).fill(undefined);
    this.#size = 0;
    this.#hashFn = hashFn ?? defaultHash;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  get capacity(): number {
    return this.#capacity;
  }

  get loadFactor(): number {
    return this.#size / this.#capacity;
  }

  // ─── Core operations ────────────────────────────────────────────────────────

  set(key: K, value: V): void {
    if (this.loadFactor >= MAX_LOAD_FACTOR) {
      this.#resize(this.#capacity * 2);
    }
    const idx = this.#probe(key, true);
    const slot = this.#slots[idx];
    if (slot === undefined || slot === DELETED) {
      this.#size++;
    }
    this.#slots[idx] = { key, value };
  }

  get(key: K): V | undefined {
    const idx = this.#probe(key, false);
    if (idx === -1) return undefined;
    return (this.#slots[idx] as Slot<K, V>).value;
  }

  has(key: K): boolean {
    return this.#probe(key, false) !== -1;
  }

  delete(key: K): boolean {
    const idx = this.#probe(key, false);
    if (idx === -1) return false;
    this.#slots[idx] = DELETED;
    this.#size--;
    return true;
  }

  // ─── Iteration ──────────────────────────────────────────────────────────────

  keys(): K[] {
    const result: K[] = [];
    for (const slot of this.#slots) {
      if (slot !== undefined && slot !== DELETED) {
        result.push(slot.key);
      }
    }
    return result;
  }

  values(): V[] {
    const result: V[] = [];
    for (const slot of this.#slots) {
      if (slot !== undefined && slot !== DELETED) {
        result.push(slot.value);
      }
    }
    return result;
  }

  entries(): [K, V][] {
    const result: [K, V][] = [];
    for (const slot of this.#slots) {
      if (slot !== undefined && slot !== DELETED) {
        result.push([slot.key, slot.value]);
      }
    }
    return result;
  }

  clear(): void {
    this.#slots = new Array(this.#capacity).fill(undefined);
    this.#size = 0;
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    let idx = 0;
    const slots = this.#slots;
    return {
      next(): IteratorResult<[K, V]> {
        while (idx < slots.length) {
          const slot = slots[idx++];
          if (slot !== undefined && slot !== DELETED) {
            return { value: [slot.key, slot.value], done: false };
          }
        }
        return { value: undefined as unknown as [K, V], done: true };
      },
    };
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * Linear probe for a key.
   *
   * @param forInsert - If true, returns the first available slot (empty or
   *   deleted) or the existing slot with the same key. If false, returns the
   *   slot index of the matching key, or -1 if not found.
   */
  #probe(key: K, forInsert: boolean): number {
    const start = this.#hashFn(key) % this.#capacity;
    let firstDeleted = -1;

    for (let i = 0; i < this.#capacity; i++) {
      const idx = (start + i) % this.#capacity;
      const slot = this.#slots[idx];

      if (slot === undefined) {
        if (forInsert) return firstDeleted !== -1 ? firstDeleted : idx;
        return -1;
      }

      if (slot === DELETED) {
        if (forInsert && firstDeleted === -1) firstDeleted = idx;
        continue;
      }

      if (slot.key === key) return idx;
    }

    // Table is full (should not happen with resizing)
    if (forInsert) return firstDeleted !== -1 ? firstDeleted : -1;
    return -1;
  }

  #resize(newCapacity: number): void {
    const oldSlots = this.#slots;
    this.#capacity = newCapacity;
    this.#slots = new Array(this.#capacity).fill(undefined);
    this.#size = 0;
    for (const slot of oldSlots) {
      if (slot !== undefined && slot !== DELETED) {
        this.set(slot.key, slot.value);
      }
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createHashMap<K, V>(capacity?: number): HashMap<K, V> {
  return new HashMap<K, V>(capacity);
}
