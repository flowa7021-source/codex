// ─── Vector Clock ────────────────────────────────────────────────────────────
// Vector clocks for tracking distributed causality.
// Each node maintains a map of logical timestamps per participant.

// @ts-check

/**
 * Immutable vector clock for distributed causality tracking.
 *
 * @example
 *   const a = createVectorClock('A').increment();
 *   const b = createVectorClock('B').increment();
 *   console.log(a.isConcurrent(b)); // true
 */
export class VectorClock {
  private readonly _nodeId: string;
  private readonly _clocks: Map<string, number>;

  constructor(nodeId: string, clocks?: Map<string, number>) {
    this._nodeId = nodeId;
    this._clocks = clocks ? new Map(clocks) : new Map();
  }

  /** The owning node identifier. */
  get nodeId(): string {
    return this._nodeId;
  }

  /**
   * Return the logical time for a given node (0 if unseen).
   */
  get(nodeId: string): number {
    return this._clocks.get(nodeId) ?? 0;
  }

  /**
   * Increment this node's own counter and return a new VectorClock.
   */
  increment(): VectorClock {
    const next = new Map(this._clocks);
    next.set(this._nodeId, (next.get(this._nodeId) ?? 0) + 1);
    return new VectorClock(this._nodeId, next);
  }

  /**
   * Merge with another VectorClock by taking the component-wise max.
   * Returns a new VectorClock (does NOT auto-increment).
   */
  merge(other: VectorClock): VectorClock {
    const merged = new Map(this._clocks);
    for (const [id, time] of other._clocks) {
      merged.set(id, Math.max(merged.get(id) ?? 0, time));
    }
    return new VectorClock(this._nodeId, merged);
  }

  /**
   * True if every component of `this` is <= the corresponding component of
   * `other` AND at least one component is strictly less.
   */
  happensBefore(other: VectorClock): boolean {
    return compareClocks(this, other) === 'before';
  }

  /**
   * True if `other` happens-before `this`.
   */
  happensAfter(other: VectorClock): boolean {
    return compareClocks(this, other) === 'after';
  }

  /**
   * True if neither clock happens-before the other (and they are not equal).
   */
  isConcurrent(other: VectorClock): boolean {
    return compareClocks(this, other) === 'concurrent';
  }

  /**
   * Serialize the clock entries.
   */
  toJSON(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [id, time] of this._clocks) {
      obj[id] = time;
    }
    return obj;
  }

  /**
   * Create a deep copy preserving nodeId.
   */
  clone(): VectorClock {
    return new VectorClock(this._nodeId, new Map(this._clocks));
  }
}

/**
 * Compare two vector clocks.
 *
 * Returns:
 * - `'before'` if `a` happens-before `b`
 * - `'after'`  if `a` happens-after `b`
 * - `'concurrent'` if neither causally precedes the other
 * - `'equal'`  if they are identical
 */
export function compareClocks(
  a: VectorClock,
  b: VectorClock,
): 'before' | 'after' | 'concurrent' | 'equal' {
  // Collect the union of all node ids
  const allIds = new Set<string>();
  const aJSON = a.toJSON();
  const bJSON = b.toJSON();
  for (const id of Object.keys(aJSON)) allIds.add(id);
  for (const id of Object.keys(bJSON)) allIds.add(id);

  let aHasSmaller = false;
  let bHasSmaller = false;

  for (const id of allIds) {
    const aVal = a.get(id);
    const bVal = b.get(id);
    if (aVal < bVal) aHasSmaller = true;
    if (bVal < aVal) bHasSmaller = true;
    // Early exit when we know it is concurrent
    if (aHasSmaller && bHasSmaller) return 'concurrent';
  }

  if (aHasSmaller && !bHasSmaller) return 'before';
  if (bHasSmaller && !aHasSmaller) return 'after';
  return 'equal';
}

/**
 * Factory: create a fresh VectorClock for a given nodeId.
 */
export function createVectorClock(nodeId: string): VectorClock {
  return new VectorClock(nodeId);
}
