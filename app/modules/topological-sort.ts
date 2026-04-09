// @ts-check
// ─── Topological Sort ───────────────────────────────────────────────────────
// Topological sorting for directed acyclic graphs (DAGs) using Kahn's
// algorithm. Provides cycle detection, dependency queries, and parallel-layer
// extraction.

/**
 * Topological sorter for directed acyclic graphs.
 *
 * Nodes and directed edges are added incrementally. The `sort()` method
 * returns a valid topological ordering using Kahn's algorithm, or throws
 * if the graph contains a cycle.
 *
 * @template T - Node type
 *
 * @example
 *   const ts = createTopologicalSort<string>();
 *   ts.addNode('a');
 *   ts.addNode('b');
 *   ts.addEdge('a', 'b');
 *   ts.sort(); // ['a', 'b']
 */
export class TopologicalSort<T> {
  /** from -> Set<to>  (adjacency list for outgoing edges) */
  #adj: Map<T, Set<T>> = new Map();
  /** to -> Set<from>  (reverse adjacency for incoming edges) */
  #reverseAdj: Map<T, Set<T>> = new Map();
  #edgeCount = 0;

  // ─── Graph construction ───────────────────────────────────────────────────

  /**
   * Add a node to the graph. If the node already exists, this is a no-op.
   */
  addNode(node: T): void {
    if (!this.#adj.has(node)) {
      this.#adj.set(node, new Set());
      this.#reverseAdj.set(node, new Set());
    }
  }

  /**
   * Add a directed edge from `from` to `to`.
   * Both nodes are auto-created if they don't already exist.
   *
   * @throws {Error} If adding a self-loop.
   */
  addEdge(from: T, to: T): void {
    if (from === to) throw new Error('Self-loops are not allowed');
    this.addNode(from);
    this.addNode(to);

    const outgoing = this.#adj.get(from)!;
    if (outgoing.has(to)) return; // duplicate edge — no-op
    outgoing.add(to);
    this.#reverseAdj.get(to)!.add(from);
    this.#edgeCount++;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  /** Number of nodes in the graph. */
  get nodeCount(): number {
    return this.#adj.size;
  }

  /** Number of directed edges in the graph. */
  get edgeCount(): number {
    return this.#edgeCount;
  }

  /**
   * Return the direct dependencies (predecessors) of `node` — i.e. nodes
   * with an edge **to** `node`.
   *
   * @throws {Error} If `node` has not been added.
   */
  dependenciesOf(node: T): T[] {
    const incoming = this.#reverseAdj.get(node);
    if (!incoming) throw new Error('Node not found in graph');
    return [...incoming];
  }

  /**
   * Return the direct dependents (successors) of `node` — i.e. nodes that
   * `node` has an edge **to**.
   *
   * @throws {Error} If `node` has not been added.
   */
  dependentsOf(node: T): T[] {
    const outgoing = this.#adj.get(node);
    if (!outgoing) throw new Error('Node not found in graph');
    return [...outgoing];
  }

  // ─── Algorithms ───────────────────────────────────────────────────────────

  /**
   * Return a topological ordering of all nodes using Kahn's algorithm.
   *
   * @throws {Error} If the graph contains a cycle.
   */
  sort(): T[] {
    const inDegree = new Map<T, number>();
    for (const node of this.#adj.keys()) {
      inDegree.set(node, 0);
    }
    for (const [, targets] of this.#adj) {
      for (const t of targets) {
        inDegree.set(t, inDegree.get(t)! + 1);
      }
    }

    const queue: T[] = [];
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node);
    }

    const result: T[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const neighbor of this.#adj.get(current)!) {
        const newDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (result.length !== this.#adj.size) {
      throw new Error('Graph contains a cycle');
    }
    return result;
  }

  /**
   * Check whether the graph contains a cycle.
   */
  hasCycle(): boolean {
    try {
      this.sort();
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Return nodes grouped into parallel layers (levels). Each layer contains
   * nodes whose dependencies have all been satisfied by previous layers.
   *
   * @throws {Error} If the graph contains a cycle.
   */
  layers(): T[][] {
    const inDegree = new Map<T, number>();
    for (const node of this.#adj.keys()) {
      inDegree.set(node, 0);
    }
    for (const [, targets] of this.#adj) {
      for (const t of targets) {
        inDegree.set(t, inDegree.get(t)! + 1);
      }
    }

    let currentLayer: T[] = [];
    for (const [node, deg] of inDegree) {
      if (deg === 0) currentLayer.push(node);
    }

    const result: T[][] = [];
    let processed = 0;

    while (currentLayer.length > 0) {
      result.push(currentLayer);
      processed += currentLayer.length;
      const nextLayer: T[] = [];
      for (const node of currentLayer) {
        for (const neighbor of this.#adj.get(node)!) {
          const newDeg = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, newDeg);
          if (newDeg === 0) nextLayer.push(neighbor);
        }
      }
      currentLayer = nextLayer;
    }

    if (processed !== this.#adj.size) {
      throw new Error('Graph contains a cycle');
    }
    return result;
  }
}

/**
 * Factory function for creating a new empty TopologicalSort instance.
 */
export function createTopologicalSort<T>(): TopologicalSort<T> {
  return new TopologicalSort<T>();
}
