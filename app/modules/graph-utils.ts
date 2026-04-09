// @ts-check
// ─── Graph Utilities ──────────────────────────────────────────────────────────
// Directed graph data structure with traversal and analysis algorithms.

// ─── Public API ───────────────────────────────────────────────────────────────

export class Graph<T = string> {
  private readonly _nodes: Set<T> = new Set();
  private readonly _edges: Map<T, Set<T>> = new Map();

  /** Add a node. */
  addNode(node: T): void {
    if (!this._nodes.has(node)) {
      this._nodes.add(node);
      this._edges.set(node, new Set());
    }
  }

  /** Add a directed edge from → to. Auto-adds nodes. */
  addEdge(from: T, to: T): void {
    this.addNode(from);
    this.addNode(to);
    this._edges.get(from)!.add(to);
  }

  /** Remove a node and all its edges. */
  removeNode(node: T): void {
    this._nodes.delete(node);
    this._edges.delete(node);
    // Remove any edges pointing to this node
    for (const neighbors of this._edges.values()) {
      neighbors.delete(node);
    }
  }

  /** Remove a specific directed edge. */
  removeEdge(from: T, to: T): void {
    this._edges.get(from)?.delete(to);
  }

  /** Get neighbors (outgoing). */
  neighbors(node: T): T[] {
    return [...(this._edges.get(node) ?? [])];
  }

  /** Check if edge exists. */
  hasEdge(from: T, to: T): boolean {
    return this._edges.get(from)?.has(to) ?? false;
  }

  /** Check if node exists. */
  hasNode(node: T): boolean {
    return this._nodes.has(node);
  }

  /** Get all nodes. */
  nodes(): T[] {
    return [...this._nodes];
  }

  /** BFS traversal from start. Returns visited nodes in order. */
  bfs(start: T): T[] {
    if (!this._nodes.has(start)) return [];
    const visited = new Set<T>();
    const queue: T[] = [start];
    const result: T[] = [];
    visited.add(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of this._edges.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return result;
  }

  /** DFS traversal from start. Returns visited nodes in order. */
  dfs(start: T): T[] {
    if (!this._nodes.has(start)) return [];
    const visited = new Set<T>();
    const result: T[] = [];
    const visit = (node: T): void => {
      if (visited.has(node)) return;
      visited.add(node);
      result.push(node);
      for (const neighbor of this._edges.get(node) ?? []) {
        visit(neighbor);
      }
    };
    visit(start);
    return result;
  }

  /** Topological sort. Returns null if cycle detected. */
  topologicalSort(): T[] | null {
    const inDegree = new Map<T, number>();
    for (const node of this._nodes) {
      inDegree.set(node, 0);
    }
    for (const neighbors of this._edges.values()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
      }
    }

    const queue: T[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    const result: T[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of this._edges.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result.length === this._nodes.size ? result : null;
  }

  /** Find shortest path (BFS). Returns null if no path. */
  shortestPath(from: T, to: T): T[] | null {
    if (!this._nodes.has(from) || !this._nodes.has(to)) return null;
    if (from === to) return [from];

    const visited = new Set<T>();
    const prev = new Map<T, T>();
    const queue: T[] = [from];
    visited.add(from);

    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const neighbor of this._edges.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          prev.set(neighbor, node);
          if (neighbor === to) {
            // Reconstruct path
            const path: T[] = [];
            let current: T = to;
            while (current !== from) {
              path.unshift(current);
              current = prev.get(current)!;
            }
            path.unshift(from);
            return path;
          }
          queue.push(neighbor);
        }
      }
    }

    return null;
  }

  /** Detect if graph has a cycle. */
  hasCycle(): boolean {
    const WHITE = 0; // unvisited
    const GRAY = 1;  // in current DFS path
    const BLACK = 2; // fully processed

    const color = new Map<T, number>();
    for (const node of this._nodes) {
      color.set(node, WHITE);
    }

    const dfsVisit = (node: T): boolean => {
      color.set(node, GRAY);
      for (const neighbor of this._edges.get(node) ?? []) {
        const neighborColor = color.get(neighbor) ?? WHITE;
        if (neighborColor === GRAY) return true; // back edge → cycle
        if (neighborColor === WHITE && dfsVisit(neighbor)) return true;
      }
      color.set(node, BLACK);
      return false;
    };

    for (const node of this._nodes) {
      if ((color.get(node) ?? WHITE) === WHITE) {
        if (dfsVisit(node)) return true;
      }
    }

    return false;
  }
}
