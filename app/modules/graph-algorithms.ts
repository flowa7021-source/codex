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

// ═══════════════════════════════════════════════════════════════════════════════
// Numeric-vertex graph algorithms (MST, flow, matching, Euler, bipartite)
// All vertex indices are 0-based numbers.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** A weighted edge between two numbered vertices. */
export interface Edge {
  from: number;
  to: number;
  weight: number;
}

/** An unweighted directed edge between two numbered vertices. */
export interface DirectedEdge {
  from: number;
  to: number;
}

// ─── Union-Find (internal helper) ─────────────────────────────────────────────

function makeUnionFind(n: number): { parent: number[]; rank: number[] } {
  const parent: number[] = [];
  const rank: number[] = [];
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    rank[i] = 0;
  }
  return { parent, rank };
}

function ufFind(parent: number[], x: number): number {
  if (parent[x] !== x) {
    parent[x] = ufFind(parent, parent[x]);
  }
  return parent[x];
}

function ufUnion(parent: number[], rank: number[], a: number, b: number): boolean {
  const ra = ufFind(parent, a);
  const rb = ufFind(parent, b);
  if (ra === rb) return false;
  if (rank[ra] < rank[rb]) {
    parent[ra] = rb;
  } else if (rank[ra] > rank[rb]) {
    parent[rb] = ra;
  } else {
    parent[rb] = ra;
    rank[ra]++;
  }
  return true;
}

// ─── kruskal ──────────────────────────────────────────────────────────────────

/**
 * Kruskal's Minimum Spanning Tree algorithm.
 * Returns the edges included in the MST and their total weight.
 * For a disconnected graph, returns the minimum spanning forest.
 */
export function kruskal(
  vertices: number,
  edges: Edge[],
): { edges: Edge[]; totalWeight: number } {
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  const { parent, rank } = makeUnionFind(vertices);
  const mstEdges: Edge[] = [];
  let totalWeight = 0;

  for (const edge of sorted) {
    if (ufUnion(parent, rank, edge.from, edge.to)) {
      mstEdges.push(edge);
      totalWeight += edge.weight;
      if (mstEdges.length === vertices - 1) break;
    }
  }

  return { edges: mstEdges, totalWeight };
}

// ─── prim ─────────────────────────────────────────────────────────────────────

/**
 * Prim's Minimum Spanning Tree algorithm.
 * `adjacency` maps each vertex to its list of neighbours with edge weights.
 * Returns the edges included in the MST and their total weight.
 * Starts from vertex 0.
 */
export function prim(
  vertices: number,
  adjacency: Map<number, Array<{ to: number; weight: number }>>,
): { edges: Edge[]; totalWeight: number } {
  if (vertices === 0) return { edges: [], totalWeight: 0 };

  const inMST = new Array<boolean>(vertices).fill(false);
  /** Cheapest known edge reaching each vertex: [weight, from] */
  const cheapest = new Array<{ weight: number; from: number }>(vertices).fill({ weight: Infinity, from: -1 });
  cheapest[0] = { weight: 0, from: -1 };

  const mstEdges: Edge[] = [];
  let totalWeight = 0;

  for (let step = 0; step < vertices; step++) {
    // Pick the non-MST vertex with the smallest key
    let u = -1;
    let minW = Infinity;
    for (let v = 0; v < vertices; v++) {
      if (!inMST[v] && cheapest[v].weight < minW) {
        minW = cheapest[v].weight;
        u = v;
      }
    }

    if (u === -1) break; // remaining vertices are unreachable
    inMST[u] = true;
    totalWeight += minW;

    if (cheapest[u].from !== -1) {
      mstEdges.push({ from: cheapest[u].from, to: u, weight: minW });
    }

    for (const { to, weight } of adjacency.get(u) ?? []) {
      if (!inMST[to] && weight < cheapest[to].weight) {
        cheapest[to] = { weight, from: u };
      }
    }
  }

  return { edges: mstEdges, totalWeight };
}

// ─── topologicalSort (numeric) ────────────────────────────────────────────────

/**
 * Kahn's topological sort on a graph with `vertices` numbered 0…vertices-1.
 * Returns the sorted vertex array, or `null` if the graph contains a cycle.
 */
export function topologicalSort(
  vertices: number,
  edges: DirectedEdge[],
): number[] | null;

/**
 * Topological sort on a generic Graph<T>. Returns sorted nodes or null if
 * a cycle is detected. (Overload retained for backward compatibility.)
 */
export function topologicalSort<T>(graph: Graph<T>): T[] | null;

export function topologicalSort<T>(
  verticesOrGraph: number | Graph<T>,
  edges?: DirectedEdge[],
): number[] | T[] | null {
  // Numeric API
  if (typeof verticesOrGraph === 'number') {
    const n = verticesOrGraph;
    const edgeList = edges ?? [];
    const inDegree = new Array<number>(n).fill(0);
    const adj: number[][] = Array.from({ length: n }, () => []);

    for (const { from, to } of edgeList) {
      adj[from].push(to);
      inDegree[to]++;
    }

    const queue: number[] = [];
    for (let i = 0; i < n; i++) {
      if (inDegree[i] === 0) queue.push(i);
    }

    const result: number[] = [];
    while (queue.length > 0) {
      const u = queue.shift() as number;
      result.push(u);
      for (const v of adj[u]) {
        inDegree[v]--;
        if (inDegree[v] === 0) queue.push(v);
      }
    }

    return result.length === n ? result : null;
  }

  // Generic Graph<T> API (original implementation)
  const graph = verticesOrGraph;
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

// ─── stronglyConnectedComponents ──────────────────────────────────────────────

/**
 * Kosaraju's Strongly Connected Components algorithm.
 * Returns an array of SCCs; each SCC is an array of vertex indices.
 * Vertices are 0-based.
 */
export function stronglyConnectedComponents(
  vertices: number,
  edges: DirectedEdge[],
): number[][] {
  if (vertices === 0) return [];

  // Build forward and reverse adjacency lists
  const fwd: number[][] = Array.from({ length: vertices }, () => []);
  const rev: number[][] = Array.from({ length: vertices }, () => []);
  for (const { from, to } of edges) {
    fwd[from].push(to);
    rev[to].push(from);
  }

  // Pass 1: DFS on forward graph, collect finish order
  const visited = new Array<boolean>(vertices).fill(false);
  const finishOrder: number[] = [];

  function dfs1(u: number): void {
    visited[u] = true;
    for (const v of fwd[u]) {
      if (!visited[v]) dfs1(v);
    }
    finishOrder.push(u);
  }

  for (let i = 0; i < vertices; i++) {
    if (!visited[i]) dfs1(i);
  }

  // Pass 2: DFS on reverse graph in reverse finish order
  const visited2 = new Array<boolean>(vertices).fill(false);
  const sccs: number[][] = [];

  function dfs2(u: number, scc: number[]): void {
    visited2[u] = true;
    scc.push(u);
    for (const v of rev[u]) {
      if (!visited2[v]) dfs2(v, scc);
    }
  }

  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const u = finishOrder[i];
    if (!visited2[u]) {
      const scc: number[] = [];
      dfs2(u, scc);
      sccs.push(scc);
    }
  }

  return sccs;
}

// ─── eulerPath ────────────────────────────────────────────────────────────────

/**
 * Find an Euler path or circuit in an undirected graph using Hierholzer's algorithm.
 * Returns the vertex sequence of the path, or `null` if no Euler path exists.
 * Vertices are 0-based.
 */
export function eulerPath(
  vertices: number,
  edges: DirectedEdge[],
): number[] | null {
  if (vertices === 0) return null;
  if (edges.length === 0) {
    // A graph with no edges has a trivial Euler circuit only if it has ≤1 vertex.
    return vertices === 1 ? [0] : null;
  }

  // Build undirected adjacency list using edge indices for deletion tracking
  const adj: { to: number; used: boolean }[][] = Array.from({ length: vertices }, () => []);
  const degree = new Array<number>(vertices).fill(0);

  for (const { from, to } of edges) {
    const eFrom = { to, used: false };
    const eTo = { to: from, used: false };
    adj[from].push(eFrom);
    adj[to].push(eTo);
    degree[from]++;
    degree[to]++;
  }

  // Check Euler path/circuit conditions
  let oddCount = 0;
  let start = 0;
  for (let v = 0; v < vertices; v++) {
    if (degree[v] % 2 !== 0) {
      oddCount++;
      start = v; // start from an odd-degree vertex
    }
  }

  // Euler path exists iff 0 or 2 vertices have odd degree
  if (oddCount !== 0 && oddCount !== 2) return null;

  // Ensure the graph is connected (considering only vertices with edges)
  const hasEdge = degree.map((d) => d > 0);
  const firstWithEdge = hasEdge.indexOf(true);
  if (firstWithEdge === -1) return null;

  // BFS connectivity check on vertices that have at least one edge
  const visited = new Array<boolean>(vertices).fill(false);
  const queue: number[] = [firstWithEdge];
  visited[firstWithEdge] = true;
  let visitedCount = 1;

  while (queue.length > 0) {
    const u = queue.shift() as number;
    for (const { to } of adj[u]) {
      if (!visited[to] && hasEdge[to]) {
        visited[to] = true;
        visitedCount++;
        queue.push(to);
      }
    }
  }

  const totalWithEdge = hasEdge.filter(Boolean).length;
  if (visitedCount !== totalWithEdge) return null; // graph is disconnected

  // If 0 odd-degree vertices, any vertex with edges is a valid start (use first)
  if (oddCount === 0) start = firstWithEdge;

  // Hierholzer's algorithm
  const pointers = new Array<number>(vertices).fill(0);
  const stack: number[] = [start];
  const path: number[] = [];

  while (stack.length > 0) {
    const u = stack[stack.length - 1];
    // Find next unused edge
    let found = false;
    while (pointers[u] < adj[u].length) {
      const edge = adj[u][pointers[u]];
      pointers[u]++;
      if (!edge.used) {
        // Find and mark the reverse edge
        const reverseAdj = adj[edge.to];
        for (let j = 0; j < reverseAdj.length; j++) {
          if (reverseAdj[j].to === u && !reverseAdj[j].used) {
            reverseAdj[j].used = true;
            break;
          }
        }
        edge.used = true;
        stack.push(edge.to);
        found = true;
        break;
      }
    }
    if (!found) {
      path.push(stack.pop() as number);
    }
  }

  if (path.length !== edges.length + 1) return null;

  return path.reverse();
}

// ─── isBipartite ──────────────────────────────────────────────────────────────

/**
 * Check if the undirected graph is bipartite using BFS 2-coloring.
 * Vertices are 0-based.
 */
export function isBipartite(vertices: number, edges: DirectedEdge[]): boolean {
  return bipartiteColoring(vertices, edges) !== null;
}

// ─── bipartiteColoring ────────────────────────────────────────────────────────

/**
 * Attempt to 2-color the graph (0 / 1).
 * Returns a colors array of length `vertices` with 0/1 values, or `null` if
 * the graph is not bipartite.
 * Vertices are 0-based.
 */
export function bipartiteColoring(
  vertices: number,
  edges: DirectedEdge[],
): number[] | null {
  if (vertices === 0) return [];

  const adj: number[][] = Array.from({ length: vertices }, () => []);
  for (const { from, to } of edges) {
    adj[from].push(to);
    adj[to].push(from);
  }

  const color = new Array<number>(vertices).fill(-1);

  for (let start = 0; start < vertices; start++) {
    if (color[start] !== -1) continue;

    color[start] = 0;
    const queue: number[] = [start];

    while (queue.length > 0) {
      const u = queue.shift() as number;
      for (const v of adj[u]) {
        if (color[v] === -1) {
          color[v] = 1 - color[u];
          queue.push(v);
        } else if (color[v] === color[u]) {
          return null; // odd cycle → not bipartite
        }
      }
    }
  }

  return color;
}
