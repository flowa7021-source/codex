// @ts-check
// ─── CRDT Sets ───────────────────────────────────────────────────────────────
// Convergent replicated data types: GSet (grow-only) and ORSet
// (observed-remove) for distributed set operations without coordination.

// ─── GSet ────────────────────────────────────────────────────────────────────

/**
 * Grow-only set. Elements can be added but never removed.
 * Merge is a simple set union.
 */
export class GSet<T> {
  #items: Set<T>;

  constructor() {
    this.#items = new Set<T>();
  }

  /** Add an element to the set. */
  add(item: T): void {
    this.#items.add(item);
  }

  /** Check whether the set contains `item`. */
  has(item: T): boolean {
    return this.#items.has(item);
  }

  /** Return all elements as an array. */
  values(): T[] {
    return [...this.#items];
  }

  /** Number of elements in the set. */
  get size(): number {
    return this.#items.size;
  }

  /**
   * Merge with another GSet (set union).
   * Returns a **new** GSet.
   */
  merge(other: GSet<T>): GSet<T> {
    const merged = new GSet<T>();
    for (const item of this.#items) {
      merged.#items.add(item);
    }
    for (const item of other.#items) {
      merged.#items.add(item);
    }
    return merged;
  }
}

// ─── ORSet ───────────────────────────────────────────────────────────────────

interface TaggedEntry<T> {
  value: T;
  tag: string;
}

let _tagCounter = 0;

/**
 * Observed-Remove set.  Each `add` generates a unique tag;
 * `remove` only removes tags observed locally. Concurrent adds
 * of the same element survive a concurrent remove (add-wins semantics).
 */
export class ORSet<T> {
  #nodeId: string;
  /** Active entries: tag -> value */
  #entries: Map<string, T>;
  /** Tombstoned (removed) tags */
  #tombstones: Set<string>;

  constructor(nodeId: string) {
    this.#nodeId = nodeId;
    this.#entries = new Map<string, T>();
    this.#tombstones = new Set<string>();
  }

  /** Generate a globally unique tag for this node. */
  #newTag(): string {
    return `${this.#nodeId}:${++_tagCounter}`;
  }

  /** Add an element, generating a fresh unique tag. */
  add(item: T): void {
    const tag = this.#newTag();
    this.#entries.set(tag, item);
  }

  /**
   * Remove all **locally observed** tags for `item`.
   * Concurrent adds on other replicas will survive.
   */
  remove(item: T): void {
    for (const [tag, value] of this.#entries) {
      if (value === item) {
        this.#entries.delete(tag);
        this.#tombstones.add(tag);
      }
    }
  }

  /** Check whether the set currently contains `item`. */
  has(item: T): boolean {
    for (const value of this.#entries.values()) {
      if (value === item) return true;
    }
    return false;
  }

  /** Return all unique elements currently in the set. */
  values(): T[] {
    const unique = new Set<T>();
    for (const value of this.#entries.values()) {
      unique.add(value);
    }
    return [...unique];
  }

  /** Number of unique elements in the set. */
  get size(): number {
    const unique = new Set<T>();
    for (const value of this.#entries.values()) {
      unique.add(value);
    }
    return unique.size;
  }

  /**
   * Merge with another ORSet (add-wins).
   * An entry survives if it is in either replica's entries
   * and has **not** been tombstoned by the other.
   */
  merge(other: ORSet<T>): ORSet<T> {
    const merged = new ORSet<T>(this.#nodeId);

    // Collect all tags from both replicas
    const allTags = new Set<string>([
      ...this.#entries.keys(),
      ...other.#entries.keys(),
    ]);

    // Combined tombstones
    const allTombstones = new Set<string>([
      ...this.#tombstones,
      ...other.#tombstones,
    ]);

    for (const tag of allTags) {
      if (!allTombstones.has(tag)) {
        const value = this.#entries.get(tag) ?? other.#entries.get(tag);
        if (value !== undefined) {
          merged.#entries.set(tag, value);
        }
      }
    }

    // Carry forward all tombstones
    for (const t of allTombstones) {
      merged.#tombstones.add(t);
    }

    return merged;
  }
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** Create a new grow-only set. */
export function createGSet<T>(): GSet<T> {
  return new GSet<T>();
}

/** Create a new observed-remove set for the given node. */
export function createORSet<T>(nodeId: string): ORSet<T> {
  return new ORSet<T>(nodeId);
}
