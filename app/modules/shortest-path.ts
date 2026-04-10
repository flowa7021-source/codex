// @ts-check
// ─── Shortest-Path Algorithms ────────────────────────────────────────────────
// Dijkstra, Bellman-Ford, Floyd-Warshall, and A* over the Graph<T> class.

import type { Graph } from './graph.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PathResult<T> {
  distance: number;
  path: T[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reconstruct path from `cameFrom` back-pointer map. */
function reconstructPath<T>(cameFrom: Map<T, T>, end: T): T[] {
  const path: T[] = [end];
  let node = end;
  while (cameFrom.has(node)) {
    node = cameFrom.get(node)!;
    path.unshift(node);
  }
  return path;
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────

/**
 * Dijkstra's single-source shortest-path algorithm.
 * Works only with non-negative edge weights.
 *
 * Returns a Map from every reachable vertex to its `PathResult`.
 * If `end` is provided the search stops early once that vertex is settled.
 *
 * @example
 *   const results = dijkstra(graph, 'A', 'C');
 *   results.get('C'); // { distance: 5, path: ['A', 'B', 'C'] }
 */
export function dijkstra<T>(
  graph: Graph<T>,
  start: T,
  end?: T,
): Map<T, PathResult<T>> {
  const dist = new Map<T, number>();
  const cameFrom = new Map<T, T>();
  const settled = new Set<T>();

  // Initialise all known vertices to Infinity
  for (const v of graph.vertices()) {
    dist.set(v, Infinity);
  }
  dist.set(start, 0);

  // Simple min-priority queue backed by a sorted array.
  // For large graphs a binary heap would be faster, but correctness is identical.
  const pq: Array<{ v: T; d: number }> = [{ v: start, d: 0 }];

  while (pq.length > 0) {
    // Pop minimum
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].d < pq[minIdx].d) minIdx = i;
    }
    const { v } = pq[minIdx];
    pq.splice(minIdx, 1);

    if (settled.has(v)) continue;
    settled.add(v);

    if (end !== undefined && v === end) break; // early exit

    for (const { to, weight } of graph.neighbors(v)) {
      if (settled.has(to)) continue;
      const newDist = (dist.get(v) ?? Infinity) + weight;
      if (newDist < (dist.get(to) ?? Infinity)) {
        dist.set(to, newDist);
        cameFrom.set(to, v);
        pq.push({ v: to, d: newDist });
      }
    }
  }

  // Build result map for all reachable vertices
  const result = new Map<T, PathResult<T>>();
  for (const [v, d] of dist) {
    if (d !== Infinity) {
      result.set(v, {
        distance: d,
        path: v === start ? [start] : reconstructPath(cameFrom, v),
      });
    }
  }
  return result;
}

// ─── Bellman-Ford ─────────────────────────────────────────────────────────────

/**
 * Bellman-Ford single-source shortest paths.
 * Handles negative edge weights and detects negative-weight cycles.
 *
 * @returns `{ distances, hasNegativeCycle }` where `distances` maps each
 *   vertex to its shortest distance from `start` (or `Infinity` if unreachable).
 */
export function bellmanFord<T>(
  graph: Graph<T>,
  start: T,
): { distances: Map<T, number>; hasNegativeCycle: boolean } {
  const verts = graph.vertices();
  const dist = new Map<T, number>();
  for (const v of verts) dist.set(v, Infinity);
  dist.set(start, 0);

  const allEdges = graph.edges();
  const n = verts.length;

  // Relax all edges n-1 times
  for (let i = 0; i < n - 1; i++) {
    for (const { from, to, weight } of allEdges) {
      const dFrom = dist.get(from) ?? Infinity;
      if (dFrom === Infinity) continue;
      const candidate = dFrom + weight;
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
      }
    }
  }

  // Check for negative cycles: if any edge can still be relaxed a cycle exists
  let hasNegativeCycle = false;
  for (const { from, to, weight } of allEdges) {
    const dFrom = dist.get(from) ?? Infinity;
    if (dFrom === Infinity) continue;
    if (dFrom + weight < (dist.get(to) ?? Infinity)) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { distances: dist, hasNegativeCycle };
}

// ─── Floyd-Warshall ───────────────────────────────────────────────────────────

/**
 * Floyd-Warshall all-pairs shortest paths.
 *
 * Returns a Map of Maps: `result.get(u).get(v)` is the shortest distance
 * from `u` to `v`, or `Infinity` if no path exists.
 */
export function floydWarshall<T>(graph: Graph<T>): Map<T, Map<T, number>> {
  const verts = graph.vertices();

  // Initialise distance matrix
  const dist = new Map<T, Map<T, number>>();
  for (const u of verts) {
    const row = new Map<T, number>();
    for (const v of verts) {
      row.set(v, u === v ? 0 : Infinity);
    }
    dist.set(u, row);
  }

  // Seed with direct edge weights
  for (const { from, to, weight } of graph.edges()) {
    const row = dist.get(from)!;
    // Keep the minimum if there are parallel edges
    if (weight < (row.get(to) ?? Infinity)) {
      row.set(to, weight);
    }
  }

  // Relax via intermediate vertices
  for (const k of verts) {
    const dk = dist.get(k)!;
    for (const u of verts) {
      const du = dist.get(u)!;
      const duk = du.get(k) ?? Infinity;
      if (duk === Infinity) continue;
      for (const v of verts) {
        const dkv = dk.get(v) ?? Infinity;
        if (dkv === Infinity) continue;
        const candidate = duk + dkv;
        if (candidate < (du.get(v) ?? Infinity)) {
          du.set(v, candidate);
        }
      }
    }
  }

  return dist;
}

// ─── A* ───────────────────────────────────────────────────────────────────────

/**
 * A* search from `start` to `end` using the supplied admissible `heuristic`.
 * Returns the shortest `PathResult`, or `null` if `end` is unreachable.
 *
 * A zero heuristic (`() => 0`) reduces A* to Dijkstra.
 *
 * @example
 *   const result = astar(graph, 'A', 'D', () => 0);
 *   result?.path; // ['A', 'B', 'D']
 */
export function astar<T>(
  graph: Graph<T>,
  start: T,
  end: T,
  heuristic: (from: T, to: T) => number,
): PathResult<T> | null {
  if (!graph.hasVertex(start) || !graph.hasVertex(end)) return null;

  /** g-scores: cheapest known cost from start → node */
  const gScore = new Map<T, number>();
  /** f-scores: g + heuristic */
  const fScore = new Map<T, number>();
  /** Back-pointers for path reconstruction */
  const cameFrom = new Map<T, T>();
  const closed = new Set<T>();

  gScore.set(start, 0);
  fScore.set(start, heuristic(start, end));

  const open = new Set<T>([start]);

  while (open.size > 0) {
    // Pick the open node with the lowest f-score
    let current: T | null = null;
    let bestF = Infinity;
    for (const node of open) {
      const f = fScore.get(node) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = node;
      }
    }

    if (current === null) break;

    if (current === end) {
      return {
        distance: gScore.get(current) ?? 0,
        path: current === start ? [start] : reconstructPath(cameFrom, current),
      };
    }

    open.delete(current);
    closed.add(current);

    const currentG = gScore.get(current) ?? Infinity;

    for (const { to, weight } of graph.neighbors(current)) {
      if (closed.has(to)) continue;
      const tentativeG = currentG + weight;
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tentativeG);
        fScore.set(to, tentativeG + heuristic(to, end));
        open.add(to);
      }
    }
  }

  return null; // end unreachable
}
