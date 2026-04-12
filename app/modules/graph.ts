// @ts-check
// ─── Graph Data Structure ─────────────────────────────────────────────────────
// Directed and undirected weighted graph with traversal, shortest path,
// cycle detection, topological sort, and connected-components algorithms.

// ─── Internal types ───────────────────────────────────────────────────────────

interface NodeEntry {
  id: string;
  data: Record<string, unknown>;
}

interface EdgeEntry {
  to: string;
  weight: number;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

/**
 * A weighted graph that can operate in directed or undirected mode.
 *
 * - Node ids are arbitrary non-empty strings.
 * - Edge weights default to 1.
 * - In undirected mode every `addEdge(u, v)` call creates two directed
 *   adjacency entries so that traversal works symmetrically.
 */
export class Graph {
  #directed: boolean;
  /** Map from node-id → node metadata */
  #nodes: Map<string, NodeEntry>;
  /** Adjacency list: node-id → list of {to, weight} */
  #adj: Map<string, EdgeEntry[]>;
  /** Total number of logical edges (each undirected edge counts as one). */
  #edgeCount: number;

  constructor(directed = false) {
    this.#directed = directed;
    this.#nodes = new Map();
    this.#adj = new Map();
    this.#edgeCount = 0;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get nodeCount(): number {
    return this.#nodes.size;
  }

  get edgeCount(): number {
    return this.#edgeCount;
  }

  get isDirected(): boolean {
    return this.#directed;
  }

  // ─── Node operations ────────────────────────────────────────────────────────

  /** Add a node with optional metadata. No-op if the node already exists. */
  addNode(id: string, data: Record<string, unknown> = {}): void {
    if (!this.#nodes.has(id)) {
      this.#nodes.set(id, { id, data });
      this.#adj.set(id, []);
    }
  }

  /**
   * Remove a node and all edges incident to it.
   * Returns `true` if the node existed, `false` otherwise.
   */
  removeNode(id: string): boolean {
    if (!this.#nodes.has(id)) return false;

    // Count outgoing edges being removed.
    const outgoing = this.#adj.get(id) ?? [];
    this.#edgeCount -= outgoing.length;

    // Remove all edges pointing TO this node from other nodes.
    for (const [otherId, edges] of this.#adj) {
      if (otherId === id) continue;
      const before = edges.length;
      const filtered = edges.filter((e) => e.to !== id);
      this.#adj.set(otherId, filtered);
      const removed = before - filtered.length;
      if (this.#directed) {
        // In directed mode, incoming edges to `id` are separate logical edges.
        this.#edgeCount -= removed;
      }
      // In undirected mode the reverse edges were already counted via outgoing.
    }

    this.#nodes.delete(id);
    this.#adj.delete(id);
    return true;
  }

  hasNode(id: string): boolean {
    return this.#nodes.has(id);
  }

  getNode(id: string): { id: string; data: Record<string, unknown> } | undefined {
    return this.#nodes.get(id);
  }

  /** Return all node ids in insertion order. */
  nodes(): string[] {
    return [...this.#nodes.keys()];
  }

  // ─── Edge operations ────────────────────────────────────────────────────────

  /**
   * Add an edge from `from` to `to` with an optional weight (default 1).
   * Both nodes are auto-created if they do not exist.
   * If the edge already exists its weight is updated (no duplicate).
   */
  addEdge(from: string, to: string, weight = 1): void {
    this.addNode(from);
    this.addNode(to);

    const fromEdges = this.#adj.get(from)!;
    const existingFwd = fromEdges.find((e) => e.to === to);
    if (existingFwd) {
      existingFwd.weight = weight;
    } else {
      fromEdges.push({ to, weight });
      this.#edgeCount++;
    }

    if (!this.#directed) {
      const toEdges = this.#adj.get(to)!;
      const existingRev = toEdges.find((e) => e.to === from);
      if (existingRev) {
        existingRev.weight = weight;
      } else {
        toEdges.push({ to: from, weight });
        // Do NOT increment edgeCount for the reverse direction.
      }
    }
  }

  /**
   * Remove the edge from `from` to `to`.
   * In undirected mode the reverse edge is also removed.
   * Returns `true` if the edge existed.
   */
  removeEdge(from: string, to: string): boolean {
    if (!this.#adj.has(from)) return false;
    const fromEdges = this.#adj.get(from)!;
    const idx = fromEdges.findIndex((e) => e.to === to);
    if (idx === -1) return false;

    fromEdges.splice(idx, 1);
    this.#edgeCount--;

    if (!this.#directed && this.#adj.has(to)) {
      const toEdges = this.#adj.get(to)!;
      const revIdx = toEdges.findIndex((e) => e.to === from);
      if (revIdx !== -1) toEdges.splice(revIdx, 1);
    }

    return true;
  }

  hasEdge(from: string, to: string): boolean {
    return (this.#adj.get(from)?.some((e) => e.to === to)) ?? false;
  }

  getEdgeWeight(from: string, to: string): number | undefined {
    return this.#adj.get(from)?.find((e) => e.to === to)?.weight;
  }

  /** Return the ids of all nodes adjacent to `id` (outgoing neighbours). */
  neighbors(id: string): string[] {
    return (this.#adj.get(id) ?? []).map((e) => e.to);
  }

  /** Return a snapshot of every logical edge in the graph. */
  edges(): Array<{ from: string; to: string; weight: number }> {
    const result: Array<{ from: string; to: string; weight: number }> = [];
    const seen = new Set<string>();

    for (const [from, edgeList] of this.#adj) {
      for (const { to, weight } of edgeList) {
        if (this.#directed) {
          result.push({ from, to, weight });
        } else {
          // Deduplicate: only emit (u,v) once, not (v,u) too.
          const key = from < to ? `${from}|${to}` : `${to}|${from}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ from, to, weight });
          }
        }
      }
    }

    return result;
  }

  // ─── Traversals ─────────────────────────────────────────────────────────────

  /**
   * Breadth-first traversal starting from `start`.
   * Returns visited node ids in BFS order.
   * Throws if `start` does not exist in the graph.
   */
  bfs(start: string): string[] {
    if (!this.#nodes.has(start)) {
      throw new Error(`bfs: node "${start}" not found`);
    }
    const visited = new Set<string>([start]);
    const queue: string[] = [start];
    const order: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const { to } of this.#adj.get(current) ?? []) {
        if (!visited.has(to)) {
          visited.add(to);
          queue.push(to);
        }
      }
    }

    return order;
  }

  /**
   * Iterative depth-first traversal starting from `start`.
   * Returns visited node ids in DFS pre-order (same as recursive DFS).
   * Throws if `start` does not exist in the graph.
   */
  dfs(start: string): string[] {
    if (!this.#nodes.has(start)) {
      throw new Error(`dfs: node "${start}" not found`);
    }
    const visited = new Set<string>();
    const order: string[] = [];
    const stack: string[] = [start];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      order.push(current);

      // Push neighbours in reverse order so we visit them in the natural order
      // (same result as recursive DFS).
      const neighbours = this.#adj.get(current) ?? [];
      for (let i = neighbours.length - 1; i >= 0; i--) {
        const { to } = neighbours[i];
        if (!visited.has(to)) {
          stack.push(to);
        }
      }
    }

    return order;
  }

  // ─── Shortest path ──────────────────────────────────────────────────────────

  /**
   * Dijkstra's algorithm from `start`.
   * Returns a Map of node-id → shortest distance from `start`.
   * Nodes unreachable from `start` have distance `Infinity`.
   * Throws if `start` does not exist in the graph.
   */
  dijkstra(start: string): Map<string, number> {
    if (!this.#nodes.has(start)) {
      throw new Error(`dijkstra: node "${start}" not found`);
    }

    const dist = new Map<string, number>();
    for (const id of this.#nodes.keys()) {
      dist.set(id, Infinity);
    }
    dist.set(start, 0);

    const unvisited = new Set<string>(this.#nodes.keys());

    while (unvisited.size > 0) {
      // Pick the unvisited node with smallest known distance.
      let current: string | null = null;
      let bestDist = Infinity;
      for (const id of unvisited) {
        const d = dist.get(id) ?? Infinity;
        if (d < bestDist) {
          bestDist = d;
          current = id;
        }
      }

      if (current === null || bestDist === Infinity) break; // remaining unreachable

      unvisited.delete(current);

      for (const { to, weight } of this.#adj.get(current) ?? []) {
        const alt = bestDist + weight;
        if (alt < (dist.get(to) ?? Infinity)) {
          dist.set(to, alt);
        }
      }
    }

    return dist;
  }

  // ─── Cycle detection ────────────────────────────────────────────────────────

  /**
   * Detect whether the graph contains at least one cycle.
   *
   * For directed graphs: uses DFS with a recursion stack (white/grey/black).
   * For undirected graphs: uses DFS parent-tracking.
   */
  hasCycle(): boolean {
    if (this.#directed) {
      return this.#hasCycleDirected();
    }
    return this.#hasCycleUndirected();
  }

  #hasCycleDirected(): boolean {
    // 0 = white (unvisited), 1 = grey (in stack), 2 = black (done)
    const color = new Map<string, number>();
    for (const id of this.#nodes.keys()) color.set(id, 0);

    const dfsVisit = (node: string): boolean => {
      color.set(node, 1); // grey
      for (const { to } of this.#adj.get(node) ?? []) {
        const c = color.get(to) ?? 0;
        if (c === 1) return true; // back edge → cycle
        if (c === 0 && dfsVisit(to)) return true;
      }
      color.set(node, 2); // black
      return false;
    };

    for (const id of this.#nodes.keys()) {
      if ((color.get(id) ?? 0) === 0) {
        if (dfsVisit(id)) return true;
      }
    }
    return false;
  }

  #hasCycleUndirected(): boolean {
    const visited = new Set<string>();

    const dfsVisit = (node: string, parent: string | null): boolean => {
      visited.add(node);
      for (const { to } of this.#adj.get(node) ?? []) {
        if (!visited.has(to)) {
          if (dfsVisit(to, node)) return true;
        } else if (to !== parent) {
          return true; // back edge to a non-parent → cycle
        }
      }
      return false;
    };

    for (const id of this.#nodes.keys()) {
      if (!visited.has(id)) {
        if (dfsVisit(id, null)) return true;
      }
    }
    return false;
  }

  // ─── Topological sort ───────────────────────────────────────────────────────

  /**
   * Kahn's algorithm topological sort for directed graphs.
   * Returns a valid topological ordering, or `null` if the graph has a cycle.
   * Returns `null` for undirected graphs that have any edges (cyclic by
   * definition when treated bidirectionally).
   */
  topologicalSort(): string[] | null {
    if (!this.#directed) {
      // Topological sort is only meaningful for directed graphs.
      if (this.#edgeCount > 0) return null;
      return [...this.#nodes.keys()];
    }

    // Compute in-degrees.
    const inDegree = new Map<string, number>();
    for (const id of this.#nodes.keys()) inDegree.set(id, 0);
    for (const edges of this.#adj.values()) {
      for (const { to } of edges) {
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const { to } of this.#adj.get(current) ?? []) {
        const newDeg = (inDegree.get(to) ?? 0) - 1;
        inDegree.set(to, newDeg);
        if (newDeg === 0) queue.push(to);
      }
    }

    return result.length === this.#nodes.size ? result : null;
  }

  // ─── Connected components ───────────────────────────────────────────────────

  /**
   * Return all weakly-connected components as arrays of node ids.
   *
   * For undirected graphs these are the standard connected components.
   * For directed graphs edges are treated as undirected (weakly connected).
   */
  connectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    // Build an undirected adjacency view for directed graphs.
    const undirAdj = new Map<string, Set<string>>();
    for (const id of this.#nodes.keys()) undirAdj.set(id, new Set());
    for (const [from, edges] of this.#adj) {
      for (const { to } of edges) {
        undirAdj.get(from)!.add(to);
        undirAdj.get(to)!.add(from);
      }
    }

    for (const id of this.#nodes.keys()) {
      if (visited.has(id)) continue;
      const component: string[] = [];
      const stack = [id];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node)) continue;
        visited.add(node);
        component.push(node);
        for (const neighbor of undirAdj.get(node) ?? []) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
      components.push(component);
    }

    return components;
  }
}

// ─── Factory functions ────────────────────────────────────────────────────────

/** Create a new graph. Pass `true` for a directed graph, or omit for undirected. */
export function createGraph(directed = false): Graph {
  return new Graph(directed);
}

/** Create a new directed graph. */
export function createDirectedGraph(): Graph {
  return new Graph(true);
}
