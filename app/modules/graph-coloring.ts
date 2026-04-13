// @ts-check
// ─── Graph Coloring ──────────────────────────────────────────────────────────
// Graph coloring algorithms: greedy coloring, chromatic number upper bound,
// and coloring validation.

// ─── ColoringGraph ───────────────────────────────────────────────────────────

export class ColoringGraph {
  #adjacency: Map<string, Set<string>> = new Map();
  #edgeCount = 0;

  /** Add a vertex to the graph. Ignored if already present. */
  addVertex(v: string): void {
    if (!this.#adjacency.has(v)) {
      this.#adjacency.set(v, new Set());
    }
  }

  /** Add an undirected edge between u and v. Both vertices are created if absent. */
  addEdge(u: string, v: string): void {
    this.addVertex(u);
    this.addVertex(v);
    if (u === v) return; // no self-loops
    const uNeighbors = this.#adjacency.get(u)!;
    const vNeighbors = this.#adjacency.get(v)!;
    if (!uNeighbors.has(v)) {
      uNeighbors.add(v);
      vNeighbors.add(u);
      this.#edgeCount++;
    }
  }

  /** Return all vertices in insertion order. */
  vertices(): string[] {
    return [...this.#adjacency.keys()];
  }

  /** Return the neighbors of vertex v. */
  neighbors(v: string): string[] {
    const set = this.#adjacency.get(v);
    return set ? [...set] : [];
  }

  /** Number of vertices. */
  get vertexCount(): number {
    return this.#adjacency.size;
  }

  /** Number of edges. */
  get edgeCount(): number {
    return this.#edgeCount;
  }
}

// ─── Greedy Coloring ─────────────────────────────────────────────────────────

/**
 * Greedy graph coloring. Assigns each vertex the smallest color (0-indexed)
 * not used by any of its already-colored neighbors.
 * Returns a Map from vertex name to color number.
 */
export function greedyColoring(graph: ColoringGraph): Map<string, number> {
  const coloring = new Map<string, number>();
  for (const v of graph.vertices()) {
    const usedColors = new Set<number>();
    for (const neighbor of graph.neighbors(v)) {
      if (coloring.has(neighbor)) {
        usedColors.add(coloring.get(neighbor)!);
      }
    }
    // find the smallest non-negative integer not in usedColors
    let color = 0;
    while (usedColors.has(color)) {
      color++;
    }
    coloring.set(v, color);
  }
  return coloring;
}

// ─── Chromatic Number Upper Bound ────────────────────────────────────────────

/**
 * Returns an upper bound on the chromatic number of the graph.
 * Uses the greedy coloring result: the number of colors used is an upper bound.
 */
export function chromaticNumberUpperBound(graph: ColoringGraph): number {
  if (graph.vertexCount === 0) return 0;
  const coloring = greedyColoring(graph);
  return colorCount(coloring);
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Check whether a coloring is valid: every vertex is colored, and no two
 * adjacent vertices share the same color.
 */
export function isValidColoring(
  graph: ColoringGraph,
  coloring: Map<string, number>,
): boolean {
  for (const v of graph.vertices()) {
    if (!coloring.has(v)) return false;
    const vColor = coloring.get(v)!;
    for (const neighbor of graph.neighbors(v)) {
      if (coloring.has(neighbor) && coloring.get(neighbor) === vColor) {
        return false;
      }
    }
  }
  return true;
}

// ─── Color Count ─────────────────────────────────────────────────────────────

/**
 * Return the number of distinct colors used in a coloring.
 */
export function colorCount(coloring: Map<string, number>): number {
  return new Set(coloring.values()).size;
}
