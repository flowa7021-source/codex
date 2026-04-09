// @ts-check
// ─── Rendezvous (HRW) Hashing ──────────────────────────────────────────────
// Highest Random Weight hashing implementation. For every key each node is
// scored; the node with the highest score wins. This yields minimal key
// movement when nodes are added or removed, with O(n) lookup per key.

// ─── Default Hash ──────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash of a combined node+key string. */
function fnv1a(node: string, key: string): number {
  const combined = `${node}:${key}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

// ─── RendezvousHash ────────────────────────────────────────────────────────

/**
 * Rendezvous (highest random weight) hashing.
 *
 * For every lookup the hash of every node combined with the key is computed;
 * the node producing the highest value is selected. This guarantees that when
 * a node is removed only its keys are redistributed, while all other mappings
 * remain stable.
 */
export class RendezvousHash<N> {
  readonly #hashFn: (node: string, key: string) => number;
  readonly #nodes: Set<N> = new Set();

  constructor(hashFn: (node: string, key: string) => number = fnv1a) {
    this.#hashFn = hashFn;
  }

  // ── Mutators ───────────────────────────────────────────────────────────

  /** Add a node. No-op if already present. */
  addNode(node: N): void {
    this.#nodes.add(node);
  }

  /** Remove a node. No-op if not present. */
  removeNode(node: N): void {
    this.#nodes.delete(node);
  }

  // ── Lookups ────────────────────────────────────────────────────────────

  /** Return the highest-weight node for `key`, or `undefined` if empty. */
  getNode(key: string): N | undefined {
    let best: N | undefined;
    let bestHash = -1;

    for (const node of this.#nodes) {
      const h = this.#hashFn(String(node), key);
      if (h > bestHash) {
        bestHash = h;
        best = node;
      }
    }

    return best;
  }

  /**
   * Return up to `count` nodes for `key`, ordered by descending weight.
   */
  getNodes(key: string, count: number): N[] {
    const scored: { node: N; score: number }[] = [];

    for (const node of this.#nodes) {
      scored.push({ node, score: this.#hashFn(String(node), key) });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map((s) => s.node);
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  /** Number of registered nodes. */
  get nodeCount(): number {
    return this.#nodes.size;
  }

  /** Return a snapshot array of all registered nodes. */
  nodes(): N[] {
    return [...this.#nodes];
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

/** Create a new `RendezvousHash` instance. */
export function createRendezvousHash<N>(): RendezvousHash<N> {
  return new RendezvousHash<N>();
}
