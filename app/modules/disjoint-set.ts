// @ts-check
// ─── Disjoint Set (Union-Find) ──────────────────────────────────────────────
// Union-Find data structure with path compression and union by rank.
// Supports generic element types via a Map-based internal representation.

interface DSNode<T> {
  parent: T;
  rank: number;
  size: number;
}

/**
 * Disjoint Set (Union-Find) with path compression and union by rank.
 *
 * Maintains a collection of non-overlapping sets with near-O(1) amortised
 * `find`, `union`, and `connected` operations thanks to path compression
 * and union by rank.
 *
 * @template T - Element type
 *
 * @example
 *   const ds = createDisjointSet<number>();
 *   ds.makeSet(1);
 *   ds.makeSet(2);
 *   ds.union(1, 2);
 *   ds.connected(1, 2); // true
 */
export class DisjointSet<T> {
  #nodes: Map<T, DSNode<T>> = new Map();
  #setCount = 0;

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Create a new singleton set containing `item`.
   * If `item` already belongs to a set, this is a no-op.
   */
  makeSet(item: T): void {
    if (this.#nodes.has(item)) return;
    this.#nodes.set(item, { parent: item, rank: 0, size: 1 });
    this.#setCount++;
  }

  /**
   * Find the representative (root) of the set containing `item`.
   * Uses path compression so subsequent lookups are faster.
   *
   * @throws {Error} If `item` has not been added via `makeSet`.
   */
  find(item: T): T {
    const node = this.#nodes.get(item);
    if (!node) throw new Error(`Item not found in disjoint set`);
    if (node.parent !== item) {
      node.parent = this.find(node.parent);
    }
    return node.parent;
  }

  /**
   * Merge the sets containing `a` and `b`.
   *
   * @returns `true` if two distinct sets were merged, `false` if `a` and `b`
   *          were already in the same set.
   * @throws {Error} If either item has not been added via `makeSet`.
   */
  union(a: T, b: T): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    const nodeA = this.#nodes.get(rootA)!;
    const nodeB = this.#nodes.get(rootB)!;

    // Union by rank: attach the shorter tree under the taller one.
    if (nodeA.rank < nodeB.rank) {
      nodeA.parent = rootB;
      nodeB.size += nodeA.size;
    } else if (nodeA.rank > nodeB.rank) {
      nodeB.parent = rootA;
      nodeA.size += nodeB.size;
    } else {
      nodeB.parent = rootA;
      nodeA.size += nodeB.size;
      nodeA.rank++;
    }

    this.#setCount--;
    return true;
  }

  /**
   * Check whether `a` and `b` belong to the same set.
   *
   * @throws {Error} If either item has not been added via `makeSet`.
   */
  connected(a: T, b: T): boolean {
    return this.find(a) === this.find(b);
  }

  /** Total number of elements across all sets. */
  get size(): number {
    return this.#nodes.size;
  }

  /** Number of disjoint sets. */
  get setCount(): number {
    return this.#setCount;
  }

  /**
   * Return the number of elements in the set containing `item`.
   *
   * @throws {Error} If `item` has not been added via `makeSet`.
   */
  setSize(item: T): number {
    const root = this.find(item);
    return this.#nodes.get(root)!.size;
  }

  /**
   * Return all disjoint sets, each as an array of elements.
   * Order of sets and elements within each set is not guaranteed.
   */
  sets(): T[][] {
    const groups = new Map<T, T[]>();
    for (const item of this.#nodes.keys()) {
      const root = this.find(item);
      let group = groups.get(root);
      if (!group) {
        group = [];
        groups.set(root, group);
      }
      group.push(item);
    }
    return [...groups.values()];
  }
}

/**
 * Factory function for creating a new empty DisjointSet.
 */
export function createDisjointSet<T>(): DisjointSet<T> {
  return new DisjointSet<T>();
}
