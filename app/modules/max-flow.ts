// @ts-check
// ─── Max Flow ────────────────────────────────────────────────────────────────
// Network flow algorithms: Edmonds-Karp (BFS-based Ford-Fulkerson) and min-cut.

// ─── FlowNetwork ─────────────────────────────────────────────────────────────

export class FlowNetwork {
  /** Adjacency list with capacities: from → to → capacity */
  #capacity: Map<string, Map<string, number>> = new Map();
  /** Set of all vertices */
  #vertices: Set<string> = new Set();

  /** Add a vertex to the network. Ignored if already present. */
  addVertex(v: string): void {
    this.#vertices.add(v);
    if (!this.#capacity.has(v)) {
      this.#capacity.set(v, new Map());
    }
  }

  /**
   * Add a directed edge with the given capacity.
   * If the edge already exists, the capacity is replaced.
   * Both vertices are created if absent.
   */
  addEdge(from: string, to: string, capacity: number): void {
    this.addVertex(from);
    this.addVertex(to);
    this.#capacity.get(from)!.set(to, capacity);
    // ensure reverse entry exists for residual graph
    if (!this.#capacity.get(to)!.has(from)) {
      this.#capacity.get(to)!.set(from, 0);
    }
  }

  /** Return all vertices. */
  vertices(): string[] {
    return [...this.#vertices];
  }

  /** Number of vertices. */
  get vertexCount(): number {
    return this.#vertices.size;
  }

  /**
   * Get the capacity from u to v (0 if no edge).
   * @internal used by the algorithms below.
   */
  getCapacity(u: string, v: string): number {
    return this.#capacity.get(u)?.get(v) ?? 0;
  }

  /**
   * Get all outgoing neighbors of u (including residual reverse edges).
   * @internal
   */
  getNeighbors(u: string): string[] {
    const map = this.#capacity.get(u);
    return map ? [...map.keys()] : [];
  }
}

// ─── BFS for augmenting path ─────────────────────────────────────────────────

function bfs(
  residual: Map<string, Map<string, number>>,
  source: string,
  sink: string,
  parent: Map<string, string>,
): boolean {
  const visited = new Set<string>();
  const queue: string[] = [source];
  visited.add(source);

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = residual.get(u);
    if (!neighbors) continue;
    for (const [v, cap] of neighbors) {
      if (!visited.has(v) && cap > 0) {
        visited.add(v);
        parent.set(v, u);
        if (v === sink) return true;
        queue.push(v);
      }
    }
  }
  return false;
}

// ─── Build residual graph ────────────────────────────────────────────────────

function buildResidual(network: FlowNetwork): Map<string, Map<string, number>> {
  const residual = new Map<string, Map<string, number>>();
  for (const v of network.vertices()) {
    residual.set(v, new Map());
  }
  for (const u of network.vertices()) {
    for (const v of network.getNeighbors(u)) {
      const cap = network.getCapacity(u, v);
      residual.get(u)!.set(v, cap);
      // ensure reverse edge exists
      if (!residual.get(v)!.has(u)) {
        residual.get(v)!.set(u, 0);
      }
    }
  }
  return residual;
}

// ─── Edmonds-Karp ────────────────────────────────────────────────────────────

/**
 * Edmonds-Karp algorithm (BFS-based Ford-Fulkerson) for maximum flow.
 * Returns the max flow value and a flow map (from → to → flow amount).
 */
export function edmondsKarp(
  network: FlowNetwork,
  source: string,
  sink: string,
): { maxFlow: number; flow: Map<string, Map<string, number>> } {
  const residual = buildResidual(network);
  let maxFlow = 0;

  // Repeatedly find augmenting paths via BFS
  while (true) {
    const parent = new Map<string, string>();
    if (!bfs(residual, source, sink, parent)) break;

    // Find bottleneck
    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      pathFlow = Math.min(pathFlow, residual.get(u)!.get(v)!);
      v = u;
    }

    // Update residual capacities
    v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      residual.get(u)!.set(v, residual.get(u)!.get(v)! - pathFlow);
      residual.get(v)!.set(u, residual.get(v)!.get(u)! + pathFlow);
      v = u;
    }

    maxFlow += pathFlow;
  }

  // Compute flow from residual: flow(u,v) = capacity(u,v) - residual(u,v)
  const flow = new Map<string, Map<string, number>>();
  for (const u of network.vertices()) {
    flow.set(u, new Map());
  }
  for (const u of network.vertices()) {
    for (const v of network.getNeighbors(u)) {
      const cap = network.getCapacity(u, v);
      if (cap > 0) {
        const f = cap - residual.get(u)!.get(v)!;
        if (f > 0) {
          flow.get(u)!.set(v, f);
        }
      }
    }
  }

  return { maxFlow, flow };
}

// ─── Min-Cut ─────────────────────────────────────────────────────────────────

/**
 * Finds the minimum s-t cut using Edmonds-Karp.
 * Returns the two partitions and the cut capacity (equal to max flow).
 */
export function minCut(
  network: FlowNetwork,
  source: string,
  sink: string,
): { cut: [string[], string[]]; capacity: number } {
  const residual = buildResidual(network);

  // Run Edmonds-Karp to get final residual graph
  let totalFlow = 0;
  while (true) {
    const parent = new Map<string, string>();
    if (!bfs(residual, source, sink, parent)) break;

    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      pathFlow = Math.min(pathFlow, residual.get(u)!.get(v)!);
      v = u;
    }

    v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      residual.get(u)!.set(v, residual.get(u)!.get(v)! - pathFlow);
      residual.get(v)!.set(u, residual.get(v)!.get(u)! + pathFlow);
      v = u;
    }

    totalFlow += pathFlow;
  }

  // BFS from source on residual with positive capacity → reachable set S
  const visited = new Set<string>();
  const queue: string[] = [source];
  visited.add(source);
  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = residual.get(u);
    if (!neighbors) continue;
    for (const [v, cap] of neighbors) {
      if (!visited.has(v) && cap > 0) {
        visited.add(v);
        queue.push(v);
      }
    }
  }

  const sPartition: string[] = [];
  const tPartition: string[] = [];
  for (const v of network.vertices()) {
    if (visited.has(v)) {
      sPartition.push(v);
    } else {
      tPartition.push(v);
    }
  }

  return { cut: [sPartition, tPartition], capacity: totalFlow };
}
