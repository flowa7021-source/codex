// @ts-check
// ─── Consistent Hashing ────────────────────────────────────────────────────
// Consistent hashing implementation for distributed systems. Maps keys to
// nodes using a virtual-node ring, minimising key reassignment when nodes
// are added or removed.

// ─── Default Hash ──────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash — fast, well-distributed, no crypto dependency. */
function fnv1a(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

// ─── ConsistentHash ────────────────────────────────────────────────────────

/**
 * A consistent-hash ring that maps arbitrary string keys to nodes of type `N`.
 *
 * Each physical node is placed on the ring at `replicas` virtual positions so
 * that keys are distributed evenly and only ~1/n keys move when a node is
 * added or removed.
 */
export class ConsistentHash<N> {
  readonly #replicas: number;
  readonly #hashFn: (key: string) => number;

  /** Sorted array of virtual-node positions on the ring. */
  #ring: number[] = [];
  /** Maps a ring position to the owning physical node. */
  #ringMap: Map<number, N> = new Map();
  /** Set of physical nodes (for deduplication and listing). */
  #nodes: Set<N> = new Set();

  constructor(replicas: number = 150, hashFn: (key: string) => number = fnv1a) {
    this.#replicas = replicas;
    this.#hashFn = hashFn;
  }

  // ── Mutators ───────────────────────────────────────────────────────────

  /** Add a physical node to the ring. No-op if already present. */
  addNode(node: N): void {
    if (this.#nodes.has(node)) return;
    this.#nodes.add(node);

    for (let i = 0; i < this.#replicas; i++) {
      const hash = this.#hashFn(`${String(node)}:${i}`);
      this.#ring.push(hash);
      this.#ringMap.set(hash, node);
    }

    this.#ring.sort((a, b) => a - b);
  }

  /** Remove a physical node and all its virtual positions. */
  removeNode(node: N): void {
    if (!this.#nodes.has(node)) return;
    this.#nodes.delete(node);

    const toRemove = new Set<number>();
    for (let i = 0; i < this.#replicas; i++) {
      const hash = this.#hashFn(`${String(node)}:${i}`);
      toRemove.add(hash);
      this.#ringMap.delete(hash);
    }

    this.#ring = this.#ring.filter((h) => !toRemove.has(h));
  }

  // ── Lookups ────────────────────────────────────────────────────────────

  /** Return the node responsible for `key`, or `undefined` if the ring is empty. */
  getNode(key: string): N | undefined {
    if (this.#ring.length === 0) return undefined;

    const hash = this.#hashFn(key);
    let idx = this.#bisectRight(hash);
    if (idx >= this.#ring.length) idx = 0;

    return this.#ringMap.get(this.#ring[idx]);
  }

  /**
   * Return up to `count` unique physical nodes for `key` by walking the ring
   * clockwise from the key's position.
   */
  getNodes(key: string, count: number): N[] {
    if (this.#ring.length === 0) return [];

    const result: N[] = [];
    const seen = new Set<N>();

    const hash = this.#hashFn(key);
    let idx = this.#bisectRight(hash);

    for (let i = 0; i < this.#ring.length && result.length < count; i++) {
      const pos = (idx + i) % this.#ring.length;
      const node = this.#ringMap.get(this.#ring[pos])!;
      if (!seen.has(node)) {
        seen.add(node);
        result.push(node);
      }
    }

    return result;
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  /** Number of physical nodes on the ring. */
  get nodeCount(): number {
    return this.#nodes.size;
  }

  /** Return a snapshot array of all physical nodes. */
  nodes(): N[] {
    return [...this.#nodes];
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /** Binary search: index of first element > value. */
  #bisectRight(value: number): number {
    let lo = 0;
    let hi = this.#ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.#ring[mid] <= value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

/** Create a new `ConsistentHash` ring with the given replica count. */
export function createConsistentHash<N>(replicas?: number): ConsistentHash<N> {
  return new ConsistentHash<N>(replicas);
}
