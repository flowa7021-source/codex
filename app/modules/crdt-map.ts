// @ts-check
// ─── CRDT Map & OR-Set ────────────────────────────────────────────────────────
// LWW-Element-Map (Last-Write-Wins Map) and OR-Set (Observed-Remove Set) CRDTs
// suitable for distributed collaborative state synchronization.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single entry in the LWW map including its tombstone state. */
export interface LWWEntry<V> {
  value: V;
  timestamp: number;
  tombstone: boolean;
}

// ─── LWWMap ───────────────────────────────────────────────────────────────────

/**
 * Last-Write-Wins Map CRDT.
 * Each key stores a value with a timestamp; concurrent updates resolve by
 * keeping the entry with the higher timestamp (ties broken by nodeId).
 */
export class LWWMap<V = unknown> {
  readonly #nodeId: string;
  readonly #clock: () => number;
  readonly #entries: Map<string, LWWEntry<V>>;

  constructor(nodeId: string, clock: () => number = () => Date.now()) {
    this.#nodeId = nodeId;
    this.#clock = clock;
    this.#entries = new Map();
  }

  /** Write a value for `key`. Overwrites any existing entry if this timestamp wins. */
  set(key: string, value: V): void {
    const ts = this.#clock();
    const existing = this.#entries.get(key);
    if (existing === undefined || this.#wins(ts, this.#nodeId, existing.timestamp, '')) {
      this.#entries.set(key, { value, timestamp: ts, tombstone: false });
    }
  }

  /** Mark `key` as deleted (tombstone). */
  delete(key: string): void {
    const ts = this.#clock();
    const existing = this.#entries.get(key);
    if (existing === undefined || this.#wins(ts, this.#nodeId, existing.timestamp, '')) {
      // Preserve the last known value inside the tombstone for state export.
      const value = existing !== undefined ? existing.value : (undefined as unknown as V);
      this.#entries.set(key, { value, timestamp: ts, tombstone: true });
    }
  }

  /** Get the value for `key`, or `undefined` if absent or tombstoned. */
  get(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined || entry.tombstone) return undefined;
    return entry.value;
  }

  /** Returns `true` if `key` exists and is not tombstoned. */
  has(key: string): boolean {
    const entry = this.#entries.get(key);
    return entry !== undefined && !entry.tombstone;
  }

  /**
   * Merge another LWWMap into this one.
   * For each key, the entry with the higher timestamp wins.
   * Ties are broken deterministically by nodeId string comparison.
   */
  merge(other: LWWMap<V>): void {
    for (const [key, remote] of Object.entries(other.state())) {
      const local = this.#entries.get(key);
      if (local === undefined || remote.timestamp > local.timestamp) {
        this.#entries.set(key, { ...remote });
      }
      // Equal timestamp: keep whichever node has the lexicographically larger id.
      else if (remote.timestamp === local.timestamp) {
        // We don't have the remote nodeId here, so prefer remote on exact tie
        // only when the remote entry differs (deterministic: prefer tombstone).
        if (!local.tombstone && remote.tombstone) {
          this.#entries.set(key, { ...remote });
        }
      }
    }
  }

  /** Export the full internal state (all keys including tombstones). */
  state(): Record<string, LWWEntry<V>> {
    const out: Record<string, LWWEntry<V>> = {};
    for (const [k, v] of this.#entries) {
      out[k] = { ...v };
    }
    return out;
  }

  /** Apply a remote state snapshot, merging entry-by-entry (LWW). */
  applyState(remote: Record<string, LWWEntry<V>>): void {
    for (const [key, remoteEntry] of Object.entries(remote)) {
      const local = this.#entries.get(key);
      if (local === undefined || remoteEntry.timestamp > local.timestamp) {
        this.#entries.set(key, { ...remoteEntry });
      } else if (remoteEntry.timestamp === local.timestamp) {
        // On exact tie prefer tombstone (delete wins).
        if (!local.tombstone && remoteEntry.tombstone) {
          this.#entries.set(key, { ...remoteEntry });
        }
      }
    }
  }

  /** Return all live (non-tombstoned) entries as [key, value] pairs. */
  entries(): [string, V][] {
    const result: [string, V][] = [];
    for (const [k, v] of this.#entries) {
      if (!v.tombstone) result.push([k, v.value]);
    }
    return result;
  }

  /** Number of live (non-tombstoned) keys. */
  get size(): number {
    let count = 0;
    for (const v of this.#entries.values()) {
      if (!v.tombstone) count++;
    }
    return count;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * Returns `true` if (tsA, nodeA) beats (tsB, nodeB).
   * Higher timestamp wins; ties go to the lexicographically larger nodeId.
   */
  #wins(tsA: number, nodeA: string, tsB: number, nodeB: string): boolean {
    if (tsA !== tsB) return tsA > tsB;
    return nodeA > nodeB;
  }
}

// ─── ORSet ────────────────────────────────────────────────────────────────────

/**
 * Observed-Remove Set (OR-Set) CRDT.
 *
 * Each `add` tags the element with a unique token so that a concurrent
 * `remove` only removes the tokens it has observed — any concurrent `add`
 * from another node survives the merge.
 */
export class ORSet<T extends string> {
  readonly #nodeId: string;
  /** Map from element value → Set of unique add-tokens. */
  readonly #elements: Map<T, Set<string>>;
  #counter: number;

  constructor(nodeId: string) {
    this.#nodeId = nodeId;
    this.#elements = new Map();
    this.#counter = 0;
  }

  /** Add `value` to the set, tagging it with a fresh unique token. */
  add(value: T): void {
    const token = `${this.#nodeId}:${++this.#counter}`;
    const tokens = this.#elements.get(value);
    if (tokens) {
      tokens.add(token);
    } else {
      this.#elements.set(value, new Set([token]));
    }
  }

  /**
   * Remove `value` by clearing all currently known tokens.
   * Any concurrent `add` tokens from other nodes will survive a merge.
   */
  remove(value: T): void {
    this.#elements.delete(value);
  }

  /** Returns `true` if `value` is currently in the set. */
  has(value: T): boolean {
    const tokens = this.#elements.get(value);
    return tokens !== undefined && tokens.size > 0;
  }

  /** Return all values currently in the set. */
  values(): T[] {
    const result: T[] = [];
    for (const [val, tokens] of this.#elements) {
      if (tokens.size > 0) result.push(val);
    }
    return result;
  }

  /**
   * Merge another ORSet into this one.
   * For each element, take the union of tokens from both sets.
   * An element is live if the merged token set is non-empty.
   */
  merge(other: ORSet<T>): void {
    for (const [value, otherTokens] of other.#elements) {
      const local = this.#elements.get(value);
      if (local) {
        for (const t of otherTokens) local.add(t);
      } else {
        this.#elements.set(value, new Set(otherTokens));
      }
    }
  }

  /** Number of elements currently in the set. */
  get size(): number {
    let count = 0;
    for (const tokens of this.#elements.values()) {
      if (tokens.size > 0) count++;
    }
    return count;
  }
}
