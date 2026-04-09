// @ts-check
// ─── Dijkstra's Shortest Path ───────────────────────────────────────────────
// Generic Dijkstra implementation that works with any vertex type `T`.
// Provides single-source / single-target and single-source / all-targets
// variants.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Graph adapter consumed by Dijkstra's algorithm. */
export interface DijkstraGraph<T> {
  /** Return every vertex in the graph. */
  vertices: () => T[];
  /** Return the neighbours of `v` with their edge weights. */
  neighbors: (v: T) => { vertex: T; weight: number }[];
}

// ─── Core Dijkstra ──────────────────────────────────────────────────────────

/**
 * Run Dijkstra's algorithm from `source`.
 *
 * If `target` is supplied the algorithm terminates early once `target` is
 * settled, which can avoid exploring the entire graph.
 *
 * Returns `distances` and `predecessors` maps.
 */
export function dijkstra<T>(
  graph: DijkstraGraph<T>,
  source: T,
  target?: T,
): { distances: Map<T, number>; predecessors: Map<T, T | null> } {
  const distances = new Map<T, number>();
  const predecessors = new Map<T, T | null>();
  const visited = new Set<T>();

  // Initialise all vertices.
  for (const v of graph.vertices()) {
    distances.set(v, Infinity);
    predecessors.set(v, null);
  }
  distances.set(source, 0);

  // Simple priority extraction via linear scan (adequate for moderate graphs).
  const remaining = new Set<T>(graph.vertices());

  while (remaining.size > 0) {
    // Pick the unvisited vertex with the smallest tentative distance.
    let current: T | undefined;
    let best = Infinity;
    for (const v of remaining) {
      const d = distances.get(v) ?? Infinity;
      if (d < best) {
        best = d;
        current = v;
      }
    }

    // All remaining vertices are unreachable.
    if (current === undefined || best === Infinity) break;

    remaining.delete(current);
    visited.add(current);

    // Early exit when the target is settled.
    if (target !== undefined && current === target) break;

    const currentDist = distances.get(current)!;

    for (const { vertex: neighbor, weight } of graph.neighbors(current)) {
      if (visited.has(neighbor)) continue;
      const alt = currentDist + weight;
      if (alt < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, alt);
        predecessors.set(neighbor, current);
      }
    }
  }

  return { distances, predecessors };
}

// ─── Single Shortest Path ───────────────────────────────────────────────────

/**
 * Return the shortest path from `source` to `target` and its total distance,
 * or `null` if `target` is unreachable.
 */
export function shortestPath<T>(
  graph: DijkstraGraph<T>,
  source: T,
  target: T,
): { path: T[]; distance: number } | null {
  const { distances, predecessors } = dijkstra(graph, source, target);

  const dist = distances.get(target);
  if (dist === undefined || dist === Infinity) return null;

  // Reconstruct path.
  const path: T[] = [];
  let current: T | null = target;
  while (current !== null) {
    path.unshift(current);
    current = predecessors.get(current) ?? null;
  }

  return { path, distance: dist };
}

// ─── All Shortest Paths ─────────────────────────────────────────────────────

/**
 * Compute shortest paths from `source` to every reachable vertex.
 * The returned map only contains entries for vertices that are reachable.
 */
export function allShortestPaths<T>(
  graph: DijkstraGraph<T>,
  source: T,
): Map<T, { path: T[]; distance: number }> {
  const { distances, predecessors } = dijkstra(graph, source);
  const result = new Map<T, { path: T[]; distance: number }>();

  for (const [vertex, dist] of distances) {
    if (dist === Infinity) continue;

    const path: T[] = [];
    let current: T | null = vertex;
    while (current !== null) {
      path.unshift(current);
      current = predecessors.get(current) ?? null;
    }

    result.set(vertex, { path, distance: dist });
  }

  return result;
}
