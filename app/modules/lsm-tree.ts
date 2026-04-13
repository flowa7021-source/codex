// @ts-check
// ─── LSM-Tree (Log-Structured Merge-Tree) ────────────────────────────────────
// An in-memory simulation of an LSM-Tree. Writes go to a sorted memtable.
// When the memtable reaches a configurable size threshold it is flushed to an
// immutable SSTable. SSTables are organised in levels; when a level overflows
// it is compacted (merged + sorted) into the next level.

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LSMOptions {
  /** Max entries in the memtable before an automatic flush. Default: 10. */
  memtableSize?: number;
  /** Max number of SSTables per level before compaction. Default: 4. */
  levelSize?: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** Sentinel value stored for deleted keys (tombstone). */
const TOMBSTONE = Symbol('TOMBSTONE');

/** A single entry in the memtable or an SSTable. */
interface Entry<V> {
  value: V | typeof TOMBSTONE;
}

/** An immutable SSTable: a sorted array of [key, entry] pairs. */
type SSTable<V> = Array<[string, Entry<V>]>;

// ─── LSMTree ─────────────────────────────────────────────────────────────────

/**
 * In-memory LSM-Tree simulation.
 *
 * Write path:
 *   1. Entries land in the memtable (a `Map` sorted on flush).
 *   2. When the memtable reaches `memtableSize`, it is flushed to a new
 *      SSTable at level 0.
 *   3. When level 0 accumulates `levelSize` SSTables, they are compacted
 *      (merged in key order, newest-write wins) into a single SSTable at
 *      level 1, and so on.
 *
 * Read path:
 *   1. Check memtable first (most recent writes).
 *   2. Walk SSTables from the most-recently-written (level 0, newest) to
 *      oldest, returning the first match.
 */
export class LSMTree<V = unknown> {
  readonly #maxMemtable: number;
  readonly #maxLevel: number;

  /** The active write buffer. */
  #memtable: Map<string, Entry<V>>;

  /**
   * Multi-level SSTable store.
   * `#levels[0]` is the newest level (L0); SSTables within a level are
   * ordered newest-first.
   */
  #levels: Array<SSTable<V>[]>;

  constructor(options: LSMOptions = {}) {
    this.#maxMemtable = options.memtableSize ?? 10;
    this.#maxLevel = options.levelSize ?? 4;
    this.#memtable = new Map();
    this.#levels = [[]]; // start with level 0
  }

  // ── Public accessors ────────────────────────────────────────────────────────

  /** Number of entries currently in the memtable (including tombstones). */
  get memtableSize(): number {
    return this.#memtable.size;
  }

  /** Total number of SSTables across all levels. */
  get sstableCount(): number {
    return this.#levels.reduce((sum, lvl) => sum + lvl.length, 0);
  }

  // ── Write operations ────────────────────────────────────────────────────────

  /** Write a key-value pair. */
  set(key: string, value: V): void {
    this.#memtable.set(key, { value });
    this.#maybeFlush();
  }

  /** Delete a key by writing a tombstone. */
  delete(key: string): void {
    this.#memtable.set(key, { value: TOMBSTONE });
    this.#maybeFlush();
  }

  /** Force-flush the memtable to an SSTable, even if below the size threshold. */
  flush(): void {
    if (this.#memtable.size === 0) return;
    this.#flushMemtable();
  }

  // ── Read operations ─────────────────────────────────────────────────────────

  /** Return the value for `key`, or `undefined` if absent/deleted. */
  get(key: string): V | undefined {
    // 1. Check memtable first.
    const mem = this.#memtable.get(key);
    if (mem !== undefined) {
      return mem.value === TOMBSTONE ? undefined : (mem.value as V);
    }

    // 2. Walk levels, newest first; within a level, newest SSTable first.
    for (const level of this.#levels) {
      for (let i = level.length - 1; i >= 0; i--) {
        const hit = sstSearch(level[i], key);
        if (hit !== undefined) {
          return hit.value === TOMBSTONE ? undefined : (hit.value as V);
        }
      }
    }

    return undefined;
  }

  /** Return `true` if the key exists and is not a tombstone. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** All live (non-deleted) keys in sorted order. */
  keys(): string[] {
    // Collect all key → newest-entry pairs.
    const seen = new Map<string, Entry<V>>();

    // Walk from oldest to newest so that newer writes win.
    // Levels: walk from highest (oldest) level down to 0 (newest).
    for (let lvlIdx = this.#levels.length - 1; lvlIdx >= 0; lvlIdx--) {
      const level = this.#levels[lvlIdx];
      // Within a level, walk from oldest SSTable (index 0) to newest.
      for (let i = 0; i < level.length; i++) {
        for (const [k, entry] of level[i]) {
          seen.set(k, entry);
        }
      }
    }

    // Memtable is the most recent.
    for (const [k, entry] of this.#memtable) {
      seen.set(k, entry);
    }

    return [...seen.entries()]
      .filter(([, entry]) => entry.value !== TOMBSTONE)
      .map(([k]) => k)
      .sort();
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  #maybeFlush(): void {
    if (this.#memtable.size >= this.#maxMemtable) {
      this.#flushMemtable();
    }
  }

  /** Sort the memtable into an SSTable and push it to level 0. */
  #flushMemtable(): void {
    const table: SSTable<V> = [...this.#memtable.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    this.#memtable = new Map();
    this.#levels[0].push(table);

    // Compact level 0 if it has too many SSTables.
    this.#maybeCompact(0);
  }

  /**
   * If `levelIdx` has too many SSTables, merge them all into one SSTable and
   * push the result to `levelIdx + 1`, then recursively check that level.
   */
  #maybeCompact(levelIdx: number): void {
    if (this.#levels[levelIdx].length <= this.#maxLevel) return;

    // Merge all SSTables at this level into a single sorted SSTable.
    const merged = this.#mergeTables(this.#levels[levelIdx]);
    this.#levels[levelIdx] = [];

    // Ensure the next level exists.
    const nextIdx = levelIdx + 1;
    if (this.#levels.length <= nextIdx) {
      this.#levels.push([]);
    }

    this.#levels[nextIdx].push(merged);
    this.#maybeCompact(nextIdx);
  }

  /**
   * Merge multiple SSTables (each sorted) into one sorted SSTable.
   * For duplicate keys, the entry from the *later* table in the array wins.
   */
  #mergeTables(tables: SSTable<V>[]): SSTable<V> {
    // Collect into a map: later tables overwrite earlier ones.
    const merged = new Map<string, Entry<V>>();
    for (const table of tables) {
      for (const [k, entry] of table) {
        merged.set(k, entry);
      }
    }
    return [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}

// ─── SSTable binary search ────────────────────────────────────────────────────

/**
 * Binary-search an SSTable (sorted array of [key, entry]) for `key`.
 * Returns the `Entry` if found, or `undefined`.
 */
function sstSearch<V>(table: SSTable<V>, key: string): Entry<V> | undefined {
  let lo = 0;
  let hi = table.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const [k] = table[mid];
    if (k === key) return table[mid][1];
    if (k < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}
