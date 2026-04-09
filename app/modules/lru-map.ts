// @ts-check
// ─── LRU Map ────────────────────────────────────────────────────────────────
// Least Recently Used eviction map backed by a doubly-linked list + Map for
// O(1) get/set/delete. The list head holds the least recently used entry; the
// tail holds the most recently used entry.
//
// Differs from LRUCache by exposing peek(), oldest(), newest(), resize(), and
// a maxSize getter (vs. capacity).

interface LRUMapNode<K, V> {
  key: K;
  value: V;
  prev: LRUMapNode<K, V> | null;
  next: LRUMapNode<K, V> | null;
}

/**
 * Least Recently Used (LRU) eviction map with a configurable maximum size.
 *
 * Uses a doubly-linked list + Map for O(1) get, set, peek, and delete.
 * The node at the head of the list is the least recently used entry and is
 * evicted first when the map exceeds `maxSize`.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const map = new LRUMap<string, number>(3);
 *   map.set('a', 1);
 *   map.set('b', 2);
 *   map.peek('a');       // 1 — does NOT update recency
 *   map.get('a');        // 1 — promotes to MRU position
 *   map.oldest();        // ['b', 2]
 */
export class LRUMap<K, V> {
  #maxSize: number;
  #map: Map<K, LRUMapNode<K, V>>;
  // Sentinel head (LRU end) and tail (MRU end) — never stored in the map.
  #head: LRUMapNode<K, V>;
  #tail: LRUMapNode<K, V>;

  constructor(maxSize: number) {
    if (maxSize < 1) throw new RangeError('LRUMap maxSize must be >= 1');
    this.#maxSize = maxSize;
    this.#map = new Map();
    this.#head = { key: undefined as unknown as K, value: undefined as unknown as V, prev: null, next: null };
    this.#tail = { key: undefined as unknown as K, value: undefined as unknown as V, prev: null, next: null };
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Detach a node from the list without deleting it. */
  #detach(node: LRUMapNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  /** Insert a node immediately before the tail (MRU position). */
  #insertBeforeTail(node: LRUMapNode<K, V>): void {
    node.prev = this.#tail.prev;
    node.next = this.#tail;
    this.#tail.prev!.next = node;
    this.#tail.prev = node;
  }

  /** Move an existing node to the MRU position. */
  #touch(node: LRUMapNode<K, V>): void {
    this.#detach(node);
    this.#insertBeforeTail(node);
  }

  /** Evict LRU entries until the map size is at most `limit`. */
  #evictTo(limit: number): void {
    while (this.#map.size > limit) {
      const lru = this.#head.next!;
      this.#detach(lru);
      this.#map.delete(lru.key);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Get a value. Returns `undefined` if not present.
   * Promotes the entry to the most-recently-used position.
   */
  get(key: K): V | undefined {
    const node = this.#map.get(key);
    if (node === undefined) return undefined;
    this.#touch(node);
    return node.value;
  }

  /**
   * Store a value. If the key already exists, update it and promote to MRU.
   * If at capacity, evict the least-recently-used entry first.
   */
  set(key: K, value: V): void {
    const existing = this.#map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      this.#touch(existing);
      return;
    }
    if (this.#map.size >= this.#maxSize) {
      const lru = this.#head.next!;
      this.#detach(lru);
      this.#map.delete(lru.key);
    }
    const node: LRUMapNode<K, V> = { key, value, prev: null, next: null };
    this.#insertBeforeTail(node);
    this.#map.set(key, node);
  }

  /**
   * Read a value **without** updating its recency.
   * Returns `undefined` if the key is not present.
   */
  peek(key: K): V | undefined {
    const node = this.#map.get(key);
    return node === undefined ? undefined : node.value;
  }

  /** Check whether a key exists (does not update access order). */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /** Delete a key. Returns `true` if the key was present. */
  delete(key: K): boolean {
    const node = this.#map.get(key);
    if (node === undefined) return false;
    this.#detach(node);
    this.#map.delete(key);
    return true;
  }

  /** Current number of entries. */
  get size(): number {
    return this.#map.size;
  }

  /** Maximum number of entries before eviction. */
  get maxSize(): number {
    return this.#maxSize;
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;
  }

  /** Keys in LRU order (oldest first, newest last). */
  keys(): K[] {
    const result: K[] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push(node.key);
      node = node.next!;
    }
    return result;
  }

  /** Values in LRU order (oldest first, newest last). */
  values(): V[] {
    const result: V[] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push(node.value);
      node = node.next!;
    }
    return result;
  }

  /** Entries in LRU order (oldest first, newest last). */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push([node.key, node.value]);
      node = node.next!;
    }
    return result;
  }

  /** Return the oldest (LRU) entry, or `undefined` if empty. */
  oldest(): [K, V] | undefined {
    const node = this.#head.next!;
    if (node === this.#tail) return undefined;
    return [node.key, node.value];
  }

  /** Return the newest (MRU) entry, or `undefined` if empty. */
  newest(): [K, V] | undefined {
    const node = this.#tail.prev!;
    if (node === this.#head) return undefined;
    return [node.key, node.value];
  }

  /**
   * Resize the map. If `newMax` is smaller than the current size, the oldest
   * entries are evicted until the map fits within the new limit.
   */
  resize(newMax: number): void {
    if (newMax < 1) throw new RangeError('LRUMap maxSize must be >= 1');
    this.#maxSize = newMax;
    this.#evictTo(newMax);
  }
}

/**
 * Factory that creates a new {@link LRUMap} instance.
 *
 * @template K - Key type
 * @template V - Value type
 */
export function createLRUMap<K, V>(maxSize: number): LRUMap<K, V> {
  return new LRUMap<K, V>(maxSize);
}
