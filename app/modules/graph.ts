// @ts-check
// ─── Graph (Directed / Undirected Weighted Graph) ─────────────────────────────
// Supports adjacency-map representation, BFS/DFS traversal, cycle detection,
// connectivity checks, Dijkstra's shortest path, and topological sort.

// ─── Internal types ───────────────────────────────────────────────────────────

interface Vertex<T> {
  data: T | undefined;
  /** neighbour id → weight */
  edges: Map<string, number>;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export class Graph<T = unknown> {
  #directed: boolean;
  #vertices: Map<string, Vertex<T>>;
  #edgeCount: number;

  constructor(options?: { directed?: boolean }) {
    this.#directed = options?.directed ?? false;
    this.#vertices = new Map();
    this.#edgeCount = 0;
  }

  // ── Vertices ──────────────────────────────────────────────────────────────────

  /** Add a vertex with optional associated data. Silently ignored if already present. */
  addVertex(id: string, data?: T): void {
    if (!this.#vertices.has(id)) {
      this.#vertices.set(id, { data, edges: new Map() });
    }
  }

  /**
   * Remove a vertex and all edges incident to it.
   * @returns `true` if the vertex existed and was removed, `false` otherwise.
   */
  removeVertex(id: string): boolean {
    if (!this.#vertices.has(id)) return false;

    // Count outgoing edges being removed.
    const removed = this.#vertices.get(id)!;
    if (this.#directed) {
      this.#edgeCount -= removed.edges.size;
    } else {
      this.#edgeCount -= removed.edges.size;
    }

    // Remove all edges pointing TO this vertex from other vertices.
    for (const [otherId, vertex] of this.#vertices) {
      if (otherId !== id && vertex.edges.has(id)) {
        vertex.edges.delete(id);
        if (this.#directed) {
          this.#edgeCount--;
        }
        // In undirected mode the reverse edge was already counted above.
      }
    }

    this.#vertices.delete(id);
    return true;
  }

  /** @returns `true` if a vertex with this id exists. */
  hasVertex(id: string): boolean {
    return this.#vertices.has(id);
  }

  /** Number of vertices currently in the graph. */
  get vertexCount(): number {
    return this.#vertices.size;
  }

  /** Return all vertex IDs in insertion order. */
  vertices(): string[] {
    return [...this.#vertices.keys()];
  }

  // ── Edges ─────────────────────────────────────────────────────────────────────

  /**
   * Add an edge from `from` to `to` with an optional `weight` (default 1).
   * Missing vertices are created automatically.
   * If the edge already exists its weight is updated without changing edge count.
   */
  addEdge(from: string, to: string, weight: number = 1): void {
    this.addVertex(from);
    this.addVertex(to);

    const fromVertex = this.#vertices.get(from)!;
    const alreadyExists = fromVertex.edges.has(to);
    fromVertex.edges.set(to, weight);

    if (!this.#directed) {
      this.#vertices.get(to)!.edges.set(from, weight);
    }

    if (!alreadyExists) {
      this.#edgeCount++;
    }
  }

  /**
   * Remove the edge from `from` to `to`.
   * @returns `true` if the edge existed and was removed, `false` otherwise.
   */
  removeEdge(from: string, to: string): boolean {
    const fromVertex = this.#vertices.get(from);
    if (!fromVertex || !fromVertex.edges.has(to)) return false;

    fromVertex.edges.delete(to);
    if (!this.#directed) {
      this.#vertices.get(to)?.edges.delete(from);
    }
    this.#edgeCount--;
    return true;
  }

  /** @returns `true` if an edge from `from` to `to` exists. */
  hasEdge(from: string, to: string): boolean {
    return this.#vertices.get(from)?.edges.has(to) ?? false;
  }

  /** @returns The weight of the edge from `from` to `to`, or `undefined` if absent. */
  getWeight(from: string, to: string): number | undefined {
    return this.#vertices.get(from)?.edges.get(to);
  }

  /** Number of edges currently in the graph. */
  get edgeCount(): number {
    return this.#edgeCount;
  }

  /**
   * Return all edges as plain objects.
   * In undirected graphs each undirected edge is listed once.
   */
  edges(): Array<{ from: string; to: string; weight: number }> {
    const result: Array<{ from: string; to: string; weight: number }> = [];
    const seen = new Set<string>();

    for (const [fromId, vertex] of this.#vertices) {
      for (const [toId, weight] of vertex.edges) {
        if (!this.#directed) {
          const key = fromId < toId ? `${fromId}\0${toId}` : `${toId}\0${fromId}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        result.push({ from: fromId, to: toId, weight });
      }
    }
    return result;
  }

  /** Return neighbour IDs of `id` (vertices reachable by a single edge). */
  getNeighbors(id: string): string[] {
    const vertex = this.#vertices.get(id);
    if (!vertex) return [];
    return [...vertex.edges.keys()];
  }

  // ── Traversals ────────────────────────────────────────────────────────────────

  /**
   * Breadth-first traversal starting from `start`.
   * @returns Vertex IDs in BFS discovery order, or empty array if `start` is absent.
   */
  bfs(start: string): string[] {
    if (!this.#vertices.has(start)) return [];
    const visited = new Set<string>();
    const order: string[] = [];
    const queue: string[] = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      const neighbours = [...(this.#vertices.get(current)?.edges.keys() ?? [])].sort();
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    return order;
  }

  /**
   * Depth-first traversal starting from `start`.
   * @returns Vertex IDs in DFS discovery order, or empty array if `start` is absent.
   */
  dfs(start: string): string[] {
    if (!this.#vertices.has(start)) return [];
    const visited = new Set<string>();
    const order: string[] = [];
    this.#dfsVisit(start, visited, order);
    return order;
  }

  #dfsVisit(id: string, visited: Set<string>, order: string[]): void {
    visited.add(id);
    order.push(id);
    const neighbours = [...(this.#vertices.get(id)?.edges.keys() ?? [])].sort();
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        this.#dfsVisit(neighbour, visited, order);
      }
    }
  }

  // ── Graph Properties ──────────────────────────────────────────────────────────

  /**
   * Detect whether the graph contains at least one cycle.
   * Works for both directed and undirected graphs.
   */
  hasCycle(): boolean {
    if (this.#directed) {
      return this.#hasCycleDirected();
    }
    return this.#hasCycleUndirected();
  }

  #hasCycleDirected(): boolean {
    // 0 = unvisited, 1 = in current DFS path (grey), 2 = fully processed (black)
    const state = new Map<string, number>();
    for (const id of this.#vertices.keys()) state.set(id, 0);

    const dfs = (id: string): boolean => {
      state.set(id, 1);
      const neighbours = this.#vertices.get(id)?.edges.keys() ?? [].values();
      for (const neighbour of neighbours) {
        const s = state.get(neighbour) ?? 0;
        if (s === 1) return true; // back-edge → cycle
        if (s === 0 && dfs(neighbour)) return true;
      }
      state.set(id, 2);
      return false;
    };

    for (const id of this.#vertices.keys()) {
      if (state.get(id) === 0 && dfs(id)) return true;
    }
    return false;
  }

  #hasCycleUndirected(): boolean {
    const visited = new Set<string>();

    const dfs = (id: string, parent: string | null): boolean => {
      visited.add(id);
      const neighbours = this.#vertices.get(id)?.edges.keys() ?? [].values();
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) {
          if (dfs(neighbour, id)) return true;
        } else if (neighbour !== parent) {
          return true;
        }
      }
      return false;
    };

    for (const id of this.#vertices.keys()) {
      if (!visited.has(id) && dfs(id, null)) return true;
    }
    return false;
  }

  /**
   * Check whether all vertices are reachable from each other.
   * For directed graphs this checks weak connectivity (treats edges as undirected).
   * @returns `true` when the graph is connected (or empty).
   */
  isConnected(): boolean {
    if (this.#vertices.size === 0) return true;

    // Build an undirected adjacency view for the connectivity check.
    const adjacency = new Map<string, Set<string>>();
    for (const id of this.#vertices.keys()) adjacency.set(id, new Set());
    for (const [fromId, vertex] of this.#vertices) {
      for (const toId of vertex.edges.keys()) {
        adjacency.get(fromId)!.add(toId);
        adjacency.get(toId)!.add(fromId);
      }
    }

    const visited = new Set<string>();
    const startId = this.#vertices.keys().next().value as string;
    const queue = [startId];
    visited.add(startId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    return visited.size === this.#vertices.size;
  }

  // ── Shortest Path (Dijkstra's) ────────────────────────────────────────────────

  /**
   * Find the shortest path between `from` and `to` using Dijkstra's algorithm.
   * Assumes non-negative weights.
   * @returns An ordered array of vertex IDs forming the path, or `null` if unreachable.
   */
  shortestPath(from: string, to: string): string[] | null {
    if (!this.#vertices.has(from) || !this.#vertices.has(to)) return null;
    if (from === to) return [from];

    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const id of this.#vertices.keys()) {
      dist.set(id, Infinity);
      prev.set(id, null);
      unvisited.add(id);
    }
    dist.set(from, 0);

    while (unvisited.size > 0) {
      // Pick the unvisited vertex with smallest distance.
      let current: string | null = null;
      let smallest = Infinity;
      for (const id of unvisited) {
        const d = dist.get(id) ?? Infinity;
        if (d < smallest) {
          smallest = d;
          current = id;
        }
      }

      if (current === null || smallest === Infinity) break; // unreachable nodes remain
      if (current === to) break;

      unvisited.delete(current);

      const vertex = this.#vertices.get(current)!;
      for (const [neighbour, weight] of vertex.edges) {
        if (!unvisited.has(neighbour)) continue;
        const alt = (dist.get(current) ?? Infinity) + weight;
        if (alt < (dist.get(neighbour) ?? Infinity)) {
          dist.set(neighbour, alt);
          prev.set(neighbour, current);
        }
      }
    }

    if ((dist.get(to) ?? Infinity) === Infinity) return null;

    // Reconstruct path.
    const path: string[] = [];
    let step: string | null = to;
    while (step !== null) {
      path.unshift(step);
      step = prev.get(step) ?? null;
    }
    return path;
  }

  // ── Topological Sort ──────────────────────────────────────────────────────────

  /**
   * Compute a topological ordering of vertices (directed graphs only).
   * Uses DFS post-order.
   * @returns An array of vertex IDs in topological order, or `null` if the graph
   *          contains a cycle or is undirected.
   */
  topologicalSort(): string[] | null {
    if (!this.#directed) return null;
    if (this.hasCycle()) return null;

    const visited = new Set<string>();
    const result: string[] = [];

    const dfs = (id: string): void => {
      visited.add(id);
      const neighbours = [...(this.#vertices.get(id)?.edges.keys() ?? [])].sort();
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) dfs(neighbour);
      }
      result.unshift(id);
    };

    // Process in sorted order for deterministic output.
    for (const id of [...this.#vertices.keys()].sort()) {
      if (!visited.has(id)) dfs(id);
    }
    return result;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — returns a new `Graph<T>` with the given options.
 */
export function createGraph<T = unknown>(options?: { directed?: boolean }): Graph<T> {
  return new Graph<T>(options);
}
