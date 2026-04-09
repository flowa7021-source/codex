// @ts-check
// ─── Minimum Spanning Tree ───────────────────────────────────────────────────
// Kruskal's and Prim's algorithms for computing minimum spanning trees
// on a WeightedGraph.

import { WeightedGraph } from './weighted-graph.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Edge<T> {
  from: T;
  to: T;
  weight: number;
}

// ─── Union-Find (internal) ───────────────────────────────────────────────────

class UnionFind<T> {
  private parent: Map<T, T> = new Map();
  private rank: Map<T, number> = new Map();

  makeSet(x: T): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: T): T {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: T, b: T): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Kruskal's algorithm: compute the MST by sorting all edges by weight
 * and greedily adding them if they don't form a cycle.
 * Returns an empty array if the graph has fewer than 2 vertices.
 */
export function kruskal<T>(graph: WeightedGraph<T>): Edge<T>[] {
  const verts = graph.vertices();
  if (verts.length < 2) return [];

  const allEdges = graph.edges().slice().sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind<T>();
  for (const v of verts) {
    uf.makeSet(v);
  }

  const mst: Edge<T>[] = [];
  for (const edge of allEdges) {
    if (uf.union(edge.from, edge.to)) {
      mst.push({ from: edge.from, to: edge.to, weight: edge.weight });
      if (mst.length === verts.length - 1) break;
    }
  }
  return mst;
}

/**
 * Prim's algorithm: grow the MST from a start vertex by always picking
 * the cheapest edge crossing the cut.
 */
export function prim<T>(graph: WeightedGraph<T>, start: T): Edge<T>[] {
  const verts = graph.vertices();
  if (verts.length < 2 || !graph.hasVertex(start)) return [];

  const inMST = new Set<T>();
  const mst: Edge<T>[] = [];

  // Min-heap entries: [weight, from, to]
  // Using a simple array-based approach for clarity
  const candidates: { weight: number; from: T; to: T }[] = [];

  const addEdgesFrom = (v: T): void => {
    for (const { vertex: neighbor, weight } of graph.neighbors(v)) {
      if (!inMST.has(neighbor)) {
        candidates.push({ weight, from: v, to: neighbor });
      }
    }
    // Sort descending so we can pop from end (cheapest last)
    candidates.sort((a, b) => b.weight - a.weight);
  };

  inMST.add(start);
  addEdgesFrom(start);

  while (candidates.length > 0 && inMST.size < verts.length) {
    const cheapest = candidates.pop()!;
    if (inMST.has(cheapest.to)) continue;

    inMST.add(cheapest.to);
    mst.push({ from: cheapest.from, to: cheapest.to, weight: cheapest.weight });
    addEdgesFrom(cheapest.to);
  }

  return mst;
}

/** Compute the total weight of a list of edges. */
export function totalWeight<T>(edges: Edge<T>[]): number {
  let sum = 0;
  for (const e of edges) {
    sum += e.weight;
  }
  return sum;
}

/**
 * Check if a set of edges forms a spanning tree of the graph.
 * A spanning tree must have exactly V-1 edges, connect all vertices,
 * and contain no cycles.
 */
export function isSpanningTree<T>(graph: WeightedGraph<T>, edges: Edge<T>[]): boolean {
  const verts = graph.vertices();
  if (verts.length === 0) return edges.length === 0;
  if (edges.length !== verts.length - 1) return false;

  // Check that all edge endpoints are valid graph vertices
  for (const e of edges) {
    if (!graph.hasVertex(e.from) || !graph.hasVertex(e.to)) return false;
  }

  // Use union-find to check connectivity and acyclicity
  const uf = new UnionFind<T>();
  for (const v of verts) {
    uf.makeSet(v);
  }
  for (const e of edges) {
    if (!uf.union(e.from, e.to)) {
      // Cycle detected
      return false;
    }
  }

  // Check all vertices are connected (same component)
  const root = uf.find(verts[0]);
  for (const v of verts) {
    if (uf.find(v) !== root) return false;
  }

  return true;
}
