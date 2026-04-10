// @ts-check
// ─── Weighted Directed / Undirected Graph ───────────────────────────────────
// Adjacency-list representation supporting directed and undirected graphs.
// Provides traversal (BFS, DFS), topological sort, cycle detection, and
// connected-components discovery.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Edge<T = string> {
  to: T;
  weight: number;
}

// ─── Graph Class ─────────────────────────────────────────────────────────────

/**
 * Weighted directed or undirected graph backed by an adjacency list.
 *
 * @example
 *   const g = new Graph<string>(true); // directed
 *   g.addEdge('A', 'B', 2);
 *   g.bfs('A'); // ['A', 'B']
 */
export class Graph<T = string> {
  readonly #directed: boolean;
  /** adjacency list: vertex → outgoing edges */
  readonly #adj: Map<T, Edge<T>[]>;

  constructor(directed = false) {
    this.#directed = directed;
    this.#adj = new Map<T, Edge<T>[]>();
  }

  // ─── Mutation ──────────────────────────────────────────────────────────────

  /** Add a vertex (no-op if already present). */
  addVertex(v: T): void {
    if (!this.#adj.has(v)) {
      this.#adj.set(v, []);
    }
  }

  /**
   * Add a weighted edge from `from` to `to`.
   * For undirected graphs the reverse edge is also added.
   * Both vertices are implicitly created if absent.
   * Default weight is 1.
   */
  addEdge(from: T, to: T, weight = 1): void {
    this.addVertex(from);
    this.addVertex(to);
    this.#adj.get(from)!.push({ to, weight });
    if (!this.#directed && from !== to) {
      this.#adj.get(to)!.push({ to: from, weight });
    }
  }

  /** Remove a vertex and all edges incident to it. */
  removeVertex(v: T): void {
    this.#adj.delete(v);
    for (const [, edges] of this.#adj) {
      const keep: Edge<T>[] = [];
      for (const e of edges) {
        if (e.to !== v) keep.push(e);
      }
      edges.length = 0;
      for (const e of keep) edges.push(e);
    }
  }

  /**
   * Remove the edge from `from` to `to`.
   * For undirected graphs the reverse edge is also removed.
   */
  removeEdge(from: T, to: T): void {
    const removeOne = (src: T, dst: T): void => {
      const edges = this.#adj.get(src);
      if (!edges) return;
      const idx = edges.findIndex((e) => e.to === dst);
      if (idx !== -1) edges.splice(idx, 1);
    };
    removeOne(from, to);
    if (!this.#directed) removeOne(to, from);
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  /** Returns `true` if the vertex is present. */
  hasVertex(v: T): boolean {
    return this.#adj.has(v);
  }

  /** Returns `true` if there is an edge from `from` to `to`. */
  hasEdge(from: T, to: T): boolean {
    return (this.#adj.get(from) ?? []).some((e) => e.to === to);
  }

  /** Outgoing edges of `v`. Returns `[]` if vertex is absent. */
  neighbors(v: T): Edge<T>[] {
    return this.#adj.get(v) ?? [];
  }

  /** All vertices in insertion order. */
  vertices(): T[] {
    return [...this.#adj.keys()];
  }

  /** All edges as `{ from, to, weight }` triples. */
  edges(): Array<{ from: T; to: T; weight: number }> {
    const result: Array<{ from: T; to: T; weight: number }> = [];
    for (const [from, edges] of this.#adj) {
      for (const { to, weight } of edges) {
        result.push({ from, to, weight });
      }
    }
    return result;
  }

  /** Number of vertices. */
  get vertexCount(): number {
    return this.#adj.size;
  }

  /**
   * Number of edges.
   * For undirected graphs each logical edge is counted once.
   */
  get edgeCount(): number {
    let total = 0;
    for (const [, edges] of this.#adj) {
      total += edges.length;
    }
    return this.#directed ? total : total / 2;
  }

  // ─── Traversal ─────────────────────────────────────────────────────────────

  /**
   * Breadth-first search from `start`.
   * Returns vertices in visited order.
   */
  bfs(start: T): T[] {
    if (!this.#adj.has(start)) return [];
    const visited = new Set<T>([start]);
    const queue: T[] = [start];
    const order: T[] = [];

    while (queue.length > 0) {
      const v = queue.shift()!;
      order.push(v);
      for (const { to } of this.#adj.get(v) ?? []) {
        if (!visited.has(to)) {
          visited.add(to);
          queue.push(to);
        }
      }
    }
    return order;
  }

  /**
   * Depth-first search from `start`.
   * Returns vertices in visited order.
   */
  dfs(start: T): T[] {
    if (!this.#adj.has(start)) return [];
    const visited = new Set<T>();
    const order: T[] = [];

    const visit = (v: T): void => {
      if (visited.has(v)) return;
      visited.add(v);
      order.push(v);
      for (const { to } of this.#adj.get(v) ?? []) {
        visit(to);
      }
    };

    visit(start);
    return order;
  }

  // ─── Topology ──────────────────────────────────────────────────────────────

  /**
   * Topological sort using Kahn's algorithm (directed graphs only).
   * Returns the sorted order, or `null` if a cycle is detected.
   */
  topologicalSort(): T[] | null {
    // Compute in-degree for every vertex
    const inDegree = new Map<T, number>();
    for (const v of this.#adj.keys()) {
      inDegree.set(v, 0);
    }
    for (const [, edges] of this.#adj) {
      for (const { to } of edges) {
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      }
    }

    // Start with zero in-degree vertices
    const queue: T[] = [];
    for (const [v, deg] of inDegree) {
      if (deg === 0) queue.push(v);
    }

    const result: T[] = [];
    while (queue.length > 0) {
      const v = queue.shift()!;
      result.push(v);
      for (const { to } of this.#adj.get(v) ?? []) {
        const newDeg = (inDegree.get(to) ?? 0) - 1;
        inDegree.set(to, newDeg);
        if (newDeg === 0) queue.push(to);
      }
    }

    return result.length === this.#adj.size ? result : null;
  }

  /**
   * Detect a cycle.
   * For directed graphs uses DFS with a recursion-stack colour mark.
   * For undirected graphs uses DFS parent tracking.
   */
  hasCycle(): boolean {
    return this.#directed ? this.#hasCycleDirected() : this.#hasCycleUndirected();
  }

  #hasCycleDirected(): boolean {
    // Colours: 0 = unvisited, 1 = in-stack, 2 = done
    const colour = new Map<T, number>();
    for (const v of this.#adj.keys()) colour.set(v, 0);

    const dfs = (v: T): boolean => {
      colour.set(v, 1);
      for (const { to } of this.#adj.get(v) ?? []) {
        const c = colour.get(to) ?? 0;
        if (c === 1) return true; // back edge → cycle
        if (c === 0 && dfs(to)) return true;
      }
      colour.set(v, 2);
      return false;
    };

    for (const v of this.#adj.keys()) {
      if ((colour.get(v) ?? 0) === 0 && dfs(v)) return true;
    }
    return false;
  }

  #hasCycleUndirected(): boolean {
    const visited = new Set<T>();

    const dfs = (v: T, parent: T | null): boolean => {
      visited.add(v);
      for (const { to } of this.#adj.get(v) ?? []) {
        if (!visited.has(to)) {
          if (dfs(to, v)) return true;
        } else if (to !== parent) {
          return true; // back edge → cycle
        }
      }
      return false;
    };

    for (const v of this.#adj.keys()) {
      if (!visited.has(v) && dfs(v, null)) return true;
    }
    return false;
  }

  /**
   * Connected components (undirected graphs).
   * Each component is returned as an array of vertices.
   */
  components(): T[][] {
    const visited = new Set<T>();
    const result: T[][] = [];

    for (const v of this.#adj.keys()) {
      if (!visited.has(v)) {
        const component: T[] = [];
        const stack: T[] = [v];
        visited.add(v);
        while (stack.length > 0) {
          const curr = stack.pop()!;
          component.push(curr);
          for (const { to } of this.#adj.get(curr) ?? []) {
            if (!visited.has(to)) {
              visited.add(to);
              stack.push(to);
            }
          }
        }
        result.push(component);
      }
    }
    return result;
  }
}
