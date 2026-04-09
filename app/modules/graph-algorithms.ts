// @ts-check
// ─── Graph Algorithms ────────────────────────────────────────────────────────
// Common graph algorithms using adjacency list representation.
// No browser APIs — pure computation.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Graph<T = string> {
  nodes: T[];
  edges: { from: T; to: T; weight?: number }[];
}

// ─── buildAdjList ─────────────────────────────────────────────────────────────

/** Build adjacency list from edge list. */
export function buildAdjList<T>(graph: Graph<T>): Map<T, { node: T; weight: number }[]> {
  const adj = new Map<T, { node: T; weight: number }[]>();
  for (const node of graph.nodes) {
    adj.set(node, []);
  }
  for (const edge of graph.edges) {
    const weight = edge.weight ?? 1;
    const fromList = adj.get(edge.from);
    if (fromList !== undefined) {
      fromList.push({ node: edge.to, weight });
    }
  }
  return adj;
}

// ─── bfs ──────────────────────────────────────────────────────────────────────

/** BFS: return visited nodes in BFS order starting from source. */
export function bfs<T>(graph: Graph<T>, source: T): T[] {
  const adj = buildAdjList(graph);
  const visited = new Set<T>();
  const order: T[] = [];
  const queue: T[] = [source];
  visited.add(source);

  while (queue.length > 0) {
    const node = queue.shift() as T;
    order.push(node);
    const neighbors = adj.get(node) ?? [];
    for (const { node: neighbor } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return order;
}

// ─── dfs ──────────────────────────────────────────────────────────────────────

/** DFS: return visited nodes in DFS order. */
export function dfs<T>(graph: Graph<T>, source: T): T[] {
  const adj = buildAdjList(graph);
  const visited = new Set<T>();
  const order: T[] = [];

  function visit(node: T): void {
    visited.add(node);
    order.push(node);
    const neighbors = adj.get(node) ?? [];
    for (const { node: neighbor } of neighbors) {
      if (!visited.has(neighbor)) {
        visit(neighbor);
      }
    }
  }

  visit(source);
  return order;
}

// ─── dijkstra ─────────────────────────────────────────────────────────────────

/** Dijkstra's shortest path. Returns map of node → shortest distance from source. */
export function dijkstra<T>(graph: Graph<T>, source: T): Map<T, number> {
  const adj = buildAdjList(graph);
  const dist = new Map<T, number>();
  const visited = new Set<T>();

  for (const node of graph.nodes) {
    dist.set(node, Infinity);
  }
  dist.set(source, 0);

  // Simple priority queue via repeated min-extraction (suitable for small graphs)
  const remaining = new Set<T>(graph.nodes);

  while (remaining.size > 0) {
    // Find unvisited node with minimum distance
    let minNode: T | null = null;
    let minDist = Infinity;
    for (const node of remaining) {
      const d = dist.get(node) ?? Infinity;
      if (d < minDist) {
        minDist = d;
        minNode = node;
      }
    }

    if (minNode === null || minDist === Infinity) break;

    remaining.delete(minNode);
    visited.add(minNode);

    const neighbors = adj.get(minNode) ?? [];
    for (const { node: neighbor, weight } of neighbors) {
      if (!visited.has(neighbor)) {
        const newDist = minDist + weight;
        if (newDist < (dist.get(neighbor) ?? Infinity)) {
          dist.set(neighbor, newDist);
        }
      }
    }
  }

  return dist;
}

// ─── shortestPath ─────────────────────────────────────────────────────────────

/** Get shortest path from source to target (Dijkstra). Returns null if unreachable. */
export function shortestPath<T>(graph: Graph<T>, source: T, target: T): T[] | null {
  const adj = buildAdjList(graph);
  const dist = new Map<T, number>();
  const prev = new Map<T, T | null>();
  const visited = new Set<T>();

  for (const node of graph.nodes) {
    dist.set(node, Infinity);
    prev.set(node, null);
  }
  dist.set(source, 0);

  const remaining = new Set<T>(graph.nodes);

  while (remaining.size > 0) {
    let minNode: T | null = null;
    let minDist = Infinity;
    for (const node of remaining) {
      const d = dist.get(node) ?? Infinity;
      if (d < minDist) {
        minDist = d;
        minNode = node;
      }
    }

    if (minNode === null || minDist === Infinity) break;
    if (minNode === target) break;

    remaining.delete(minNode);
    visited.add(minNode);

    const neighbors = adj.get(minNode) ?? [];
    for (const { node: neighbor, weight } of neighbors) {
      if (!visited.has(neighbor)) {
        const newDist = minDist + weight;
        if (newDist < (dist.get(neighbor) ?? Infinity)) {
          dist.set(neighbor, newDist);
          prev.set(neighbor, minNode);
        }
      }
    }
  }

  if ((dist.get(target) ?? Infinity) === Infinity) return null;

  // Reconstruct path
  const path: T[] = [];
  let current: T | null = target;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path;
}

// ─── topologicalSort ──────────────────────────────────────────────────────────

/** Topological sort. Returns sorted nodes or null if cycle detected. */
export function topologicalSort<T>(graph: Graph<T>): T[] | null {
  const adj = buildAdjList(graph);
  const inDegree = new Map<T, number>();

  for (const node of graph.nodes) {
    inDegree.set(node, 0);
  }
  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: T[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const result: T[] = [];

  while (queue.length > 0) {
    const node = queue.shift() as T;
    result.push(node);
    const neighbors = adj.get(node) ?? [];
    for (const { node: neighbor } of neighbors) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return result.length === graph.nodes.length ? result : null;
}

// ─── hasCycle ─────────────────────────────────────────────────────────────────

/** Detect if graph has a cycle. */
export function hasCycle<T>(graph: Graph<T>): boolean {
  return topologicalSort(graph) === null;
}

// ─── connectedComponents ──────────────────────────────────────────────────────

/** Find all connected components (undirected). */
export function connectedComponents<T>(graph: Graph<T>): T[][] {
  // Build undirected adjacency list
  const adj = new Map<T, Set<T>>();
  for (const node of graph.nodes) {
    adj.set(node, new Set<T>());
  }
  for (const edge of graph.edges) {
    adj.get(edge.from)?.add(edge.to);
    adj.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<T>();
  const components: T[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node)) continue;

    // BFS from this node
    const component: T[] = [];
    const queue: T[] = [node];
    visited.add(node);

    while (queue.length > 0) {
      const curr = queue.shift() as T;
      component.push(curr);
      const neighbors = adj.get(curr) ?? new Set<T>();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

// ─── isConnected ──────────────────────────────────────────────────────────────

/** Check if graph is connected (undirected). */
export function isConnected<T>(graph: Graph<T>): boolean {
  if (graph.nodes.length === 0) return true;
  return connectedComponents(graph).length === 1;
}
