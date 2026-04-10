// @ts-check
// ─── LRU Cache ───────────────────────────────────────────────────────────────
// Least Recently Used cache backed by a doubly-linked list + Map for O(1)
// get/set/delete. The list head holds the least recently used entry; the tail
// holds the most recently used entry.

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

/**
 * Least Recently Used (LRU) cache with a fixed capacity.
 *
 * Uses a doubly-linked list + Map for O(1) get, set, and delete.
 * The node at the head of the list is the least recently used entry and is
 * evicted first when the cache is at capacity.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const cache = new LRUCache<string, ArrayBuffer>(50);
 *   cache.set('page:1', buffer);
 *   const buf = cache.get('page:1'); // promotes to MRU position
 */
export class LRUCache<K, V> {
  readonly #capacity: number;
  #map: Map<K, LRUNode<K, V>>;
  // Sentinel head (LRU end) and tail (MRU end) — never stored in the map.
  #head: LRUNode<K, V>;
  #tail: LRUNode<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('LRUCache capacity must be >= 1');
    this.#capacity = capacity;
    this.#map = new Map();
    // Sentinels simplify edge-case handling (empty list, single item, etc.).
    this.#head = { key: undefined as unknown as K, value: undefined as unknown as V, prev: null, next: null };
    this.#tail = { key: undefined as unknown as K, value: undefined as unknown as V, prev: null, next: null };
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Detach a node from the list without deleting it. */
  #detach(node: LRUNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  /** Insert a node immediately before the tail (MRU position). */
  #insertBeforeTail(node: LRUNode<K, V>): void {
    node.prev = this.#tail.prev;
    node.next = this.#tail;
    this.#tail.prev!.next = node;
    this.#tail.prev = node;
  }

  /** Move an existing node to the MRU position. */
  #touch(node: LRUNode<K, V>): void {
    this.#detach(node);
    this.#insertBeforeTail(node);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Get a cached value. Returns `undefined` if not present.
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
    if (this.#map.size >= this.#capacity) {
      // Evict LRU: the node right after the head sentinel.
      const lru = this.#head.next!;
      this.#detach(lru);
      this.#map.delete(lru.key);
    }
    const node: LRUNode<K, V> = { key, value, prev: null, next: null };
    this.#insertBeforeTail(node);
    this.#map.set(key, node);
  }

  /**
   * Check whether a key exists in the cache (does not update access order).
   */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /**
   * Delete a key. Returns `true` if the key was present.
   */
  delete(key: K): boolean {
    const node = this.#map.get(key);
    if (node === undefined) return false;
    this.#detach(node);
    this.#map.delete(key);
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;
  }

  /** Current number of cached entries. */
  get size(): number {
    return this.#map.size;
  }

  /** Maximum number of entries. */
  get capacity(): number {
    return this.#capacity;
  }

  /**
   * Keys in LRU order (least recently used first).
   */
  keys(): K[] {
    const result: K[] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push(node.key);
      node = node.next!;
    }
    return result;
  }

  /**
   * Values in LRU order (least recently used first).
   */
  values(): V[] {
    const result: V[] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push(node.value);
      node = node.next!;
    }
    return result;
  }

  /**
   * Entries in LRU order (least recently used first).
   */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    let node = this.#head.next!;
    while (node !== this.#tail) {
      result.push([node.key, node.value]);
      node = node.next!;
    }
    return result;
  }
}

// ─── LFUCache ────────────────────────────────────────────────────────────────

interface LFUNode<K, V> {
  key: K;
  value: V;
  freq: number;
  prev: LFUNode<K, V> | null;
  next: LFUNode<K, V> | null;
}

interface FreqList<K, V> {
  head: LFUNode<K, V>; // sentinel MRU end
  tail: LFUNode<K, V>; // sentinel LRU end
  size: number;
}

function createFreqList<K, V>(): FreqList<K, V> {
  const head: LFUNode<K, V> = { key: undefined as unknown as K, value: undefined as unknown as V, freq: 0, prev: null, next: null };
  const tail: LFUNode<K, V> = { key: undefined as unknown as K, value: undefined as unknown as V, freq: 0, prev: null, next: null };
  head.next = tail;
  tail.prev = head;
  return { head, tail, size: 0 };
}

function freqListPrepend<K, V>(list: FreqList<K, V>, node: LFUNode<K, V>): void {
  node.prev = list.head;
  node.next = list.head.next;
  list.head.next!.prev = node;
  list.head.next = node;
  list.size++;
}

function freqListRemove<K, V>(list: FreqList<K, V>, node: LFUNode<K, V>): void {
  node.prev!.next = node.next;
  node.next!.prev = node.prev;
  node.prev = null;
  node.next = null;
  list.size--;
}

function freqListEvictLRU<K, V>(list: FreqList<K, V>): LFUNode<K, V> | null {
  const last = list.tail.prev!;
  if (last === list.head) return null;
  freqListRemove(list, last);
  return last;
}

/**
 * Least-Frequently-Used cache with a fixed capacity.
 *
 * Uses frequency buckets backed by doubly-linked lists for O(1) get, set,
 * and delete. Ties in frequency are broken by LRU order.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const cache = new LFUCache<string, number>(2);
 *   cache.set('a', 1);  // freq(a) = 1
 *   cache.set('b', 2);  // freq(b) = 1
 *   cache.get('a');     // freq(a) = 2
 *   cache.set('c', 3);  // evicts 'b' (freq 1, LRU)
 */
export class LFUCache<K, V> {
  readonly #capacity: number;
  #map: Map<K, LFUNode<K, V>>;
  #freqMap: Map<number, FreqList<K, V>>;
  #minFreq: number;
  #size: number;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('LFUCache capacity must be >= 1');
    this.#capacity = capacity;
    this.#map = new Map();
    this.#freqMap = new Map();
    this.#minFreq = 0;
    this.#size = 0;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #getOrCreateList(freq: number): FreqList<K, V> {
    let list = this.#freqMap.get(freq);
    if (list === undefined) {
      list = createFreqList<K, V>();
      this.#freqMap.set(freq, list);
    }
    return list;
  }

  #promoteNode(node: LFUNode<K, V>): void {
    const oldFreq = node.freq;
    const oldList = this.#freqMap.get(oldFreq)!;
    freqListRemove(oldList, node);
    if (oldList.size === 0 && oldFreq === this.#minFreq) {
      this.#minFreq++;
    }
    node.freq++;
    freqListPrepend(this.#getOrCreateList(node.freq), node);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Get a cached value. Returns `undefined` if not present.
   * Increments the frequency of the accessed entry.
   */
  get(key: K): V | undefined {
    const node = this.#map.get(key);
    if (node === undefined) return undefined;
    this.#promoteNode(node);
    return node.value;
  }

  /**
   * Store a value. If the key already exists, update it and increment frequency.
   * If at capacity, evict the least-frequently-used (LRU on tie) entry first.
   */
  set(key: K, value: V): void {
    const existing = this.#map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      this.#promoteNode(existing);
      return;
    }

    if (this.#size >= this.#capacity) {
      const minList = this.#freqMap.get(this.#minFreq);
      if (minList !== undefined) {
        const evicted = freqListEvictLRU(minList);
        if (evicted !== null) {
          this.#map.delete(evicted.key);
          this.#size--;
        }
      }
    }

    const node: LFUNode<K, V> = { key, value, freq: 1, prev: null, next: null };
    this.#map.set(key, node);
    freqListPrepend(this.#getOrCreateList(1), node);
    this.#minFreq = 1;
    this.#size++;
  }

  /**
   * Check whether a key exists in the cache (does not update frequency).
   */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /**
   * Delete a key. Returns `true` if the key was present.
   */
  delete(key: K): boolean {
    const node = this.#map.get(key);
    if (node === undefined) return false;
    const list = this.#freqMap.get(node.freq)!;
    freqListRemove(list, node);
    this.#map.delete(key);
    this.#size--;
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
    this.#freqMap.clear();
    this.#minFreq = 0;
    this.#size = 0;
  }

  /** Current number of cached entries. */
  get size(): number {
    return this.#size;
  }

  /** Maximum number of entries. */
  get capacity(): number {
    return this.#capacity;
  }

  /**
   * Keys ordered by frequency descending, then MRU first within each tier.
   */
  keys(): K[] {
    const result: K[] = [];
    const freqs = Array.from(this.#freqMap.keys()).sort((a, b) => b - a);
    for (const freq of freqs) {
      const list = this.#freqMap.get(freq)!;
      let node = list.head.next!;
      while (node !== list.tail) {
        result.push(node.key);
        node = node.next!;
      }
    }
    return result;
  }
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Create a new LRU cache with the given capacity. */
export function createLRUCache<K, V>(capacity: number): LRUCache<K, V> {
  return new LRUCache<K, V>(capacity);
}

/** Create a new LFU cache with the given capacity. */
export function createLFUCache<K, V>(capacity: number): LFUCache<K, V> {
  return new LFUCache<K, V>(capacity);
}
