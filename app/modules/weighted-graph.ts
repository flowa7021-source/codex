// @ts-check
// ─── Weighted Graph ──────────────────────────────────────────────────────────
// Generic weighted graph data structure using adjacency list representation.
// Supports both directed and undirected graphs.

// ─── Types ───────────────────────────────────────────────────────────────────

interface EdgeEntry<T> {
  vertex: T;
  weight: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export class WeightedGraph<T = string> {
  private readonly _directed: boolean;
  private readonly _adjacency: Map<T, Map<T, number>> = new Map();

  constructor(directed: boolean = false) {
    this._directed = directed;
  }

  /** Whether this graph is directed. */
  get isDirected(): boolean {
    return this._directed;
  }

  /** Number of vertices in the graph. */
  get vertexCount(): number {
    return this._adjacency.size;
  }

  /** Number of edges in the graph. */
  get edgeCount(): number {
    let count = 0;
    for (const neighbors of this._adjacency.values()) {
      count += neighbors.size;
    }
    // For undirected graphs each edge is stored twice
    return this._directed ? count : count / 2;
  }

  /** Add a vertex. No-op if already present. */
  addVertex(vertex: T): void {
    if (!this._adjacency.has(vertex)) {
      this._adjacency.set(vertex, new Map());
    }
  }

  /** Add a weighted edge. Auto-adds vertices if missing. */
  addEdge(from: T, to: T, weight: number): void {
    this.addVertex(from);
    this.addVertex(to);
    this._adjacency.get(from)!.set(to, weight);
    if (!this._directed) {
      this._adjacency.get(to)!.set(from, weight);
    }
  }

  /** Remove a vertex and all its incident edges. Returns true if removed. */
  removeVertex(vertex: T): boolean {
    if (!this._adjacency.has(vertex)) return false;
    // Remove all edges pointing to this vertex
    for (const neighbors of this._adjacency.values()) {
      neighbors.delete(vertex);
    }
    this._adjacency.delete(vertex);
    return true;
  }

  /** Remove an edge. Returns true if removed. */
  removeEdge(from: T, to: T): boolean {
    const neighborsFrom = this._adjacency.get(from);
    if (!neighborsFrom || !neighborsFrom.has(to)) return false;
    neighborsFrom.delete(to);
    if (!this._directed) {
      this._adjacency.get(to)?.delete(from);
    }
    return true;
  }

  /** Check if vertex exists. */
  hasVertex(vertex: T): boolean {
    return this._adjacency.has(vertex);
  }

  /** Check if edge exists. */
  hasEdge(from: T, to: T): boolean {
    return this._adjacency.get(from)?.has(to) ?? false;
  }

  /** Get the weight of an edge, or undefined if no such edge. */
  getWeight(from: T, to: T): number | undefined {
    return this._adjacency.get(from)?.get(to);
  }

  /** Get neighbors of a vertex with their edge weights. */
  neighbors(vertex: T): EdgeEntry<T>[] {
    const map = this._adjacency.get(vertex);
    if (!map) return [];
    const result: EdgeEntry<T>[] = [];
    for (const [v, w] of map) {
      result.push({ vertex: v, weight: w });
    }
    return result;
  }

  /** Get all vertices. */
  vertices(): T[] {
    return [...this._adjacency.keys()];
  }

  /** Get all edges. */
  edges(): { from: T; to: T; weight: number }[] {
    const result: { from: T; to: T; weight: number }[] = [];
    const seen = new Set<string>();
    for (const [from, neighbors] of this._adjacency) {
      for (const [to, weight] of neighbors) {
        if (!this._directed) {
          // Deduplicate undirected edges using a canonical key
          const key = String(from) < String(to)
            ? `${String(from)}->${String(to)}`
            : `${String(to)}->${String(from)}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        result.push({ from, to, weight });
      }
    }
    return result;
  }
}

/** Factory function for creating a WeightedGraph. */
export function createWeightedGraph<T = string>(directed: boolean = false): WeightedGraph<T> {
  return new WeightedGraph<T>(directed);
}
