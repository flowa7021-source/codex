// @ts-check
// ─── A* Pathfinding ─────────────────────────────────────────────────────────
// Standalone A* search implementation with a generic graph interface and a
// ready-made GridGraph class for 2-D grid-based pathfinding.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A node identified by a unique string id and optional 2-D coordinates. */
export interface AStarNode {
  id: string;
  x: number;
  y: number;
}

/** Graph adapter required by the generic `astar` function. */
export interface AStarGraph {
  /** Return the neighbours of `node` together with the traversal cost. */
  neighbors: (node: string) => { id: string; cost: number }[];
  /** Admissible heuristic estimating the distance from `a` to `b`. */
  heuristic: (a: string, b: string) => number;
}

// ─── Generic A* Search ──────────────────────────────────────────────────────

/**
 * Run A* on `graph` from `start` to `goal`.
 * Returns the shortest path and its total cost, or `null` if unreachable.
 */
export function astar(
  graph: AStarGraph,
  start: string,
  goal: string,
): { path: string[]; cost: number } | null {
  /** g-scores: cheapest known cost from start → node */
  const gScore = new Map<string, number>();
  /** f-scores: g + heuristic */
  const fScore = new Map<string, number>();
  /** Back-pointers for path reconstruction */
  const cameFrom = new Map<string, string>();

  gScore.set(start, 0);
  fScore.set(start, graph.heuristic(start, goal));

  // Open set stored as a simple array; entries are removed by marking closed.
  const open = new Set<string>([start]);

  while (open.size > 0) {
    // Pick the open node with the lowest f-score.
    let current: string | null = null;
    let bestF = Infinity;
    for (const node of open) {
      const f = fScore.get(node) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = node;
      }
    }

    if (current === null) break;
    if (current === goal) return reconstructPath(cameFrom, current, gScore);

    open.delete(current);

    const currentG = gScore.get(current) ?? Infinity;

    for (const { id: neighborId, cost } of graph.neighbors(current)) {
      const tentativeG = currentG + cost;
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + graph.heuristic(neighborId, goal));
        open.add(neighborId);
      }
    }
  }

  return null; // goal unreachable
}

// ─── Path Reconstruction ────────────────────────────────────────────────────

function reconstructPath(
  cameFrom: Map<string, string>,
  current: string,
  gScore: Map<string, number>,
): { path: string[]; cost: number } {
  const path: string[] = [current];
  let node = current;
  while (cameFrom.has(node)) {
    node = cameFrom.get(node)!;
    path.unshift(node);
  }
  return { path, cost: gScore.get(current) ?? 0 };
}

// ─── GridGraph ──────────────────────────────────────────────────────────────

/** Directions: 4-connected (N, E, S, W). */
const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function cellId(x: number, y: number): string {
  return `${x},${y}`;
}

function parseId(id: string): [number, number] {
  const [x, y] = id.split(',').map(Number);
  return [x, y];
}

/**
 * A 2-D grid that implements `AStarGraph` internally and exposes a
 * coordinate-based API for pathfinding.
 */
export class GridGraph {
  readonly width: number;
  readonly height: number;
  readonly #walls: Set<string>;

  constructor(width: number, height: number, walls?: [number, number][]) {
    this.width = width;
    this.height = height;
    this.#walls = new Set<string>();
    if (walls) {
      for (const [wx, wy] of walls) {
        this.#walls.add(cellId(wx, wy));
      }
    }
  }

  /** Mark a cell as impassable. */
  setWall(x: number, y: number): void {
    this.#walls.add(cellId(x, y));
  }

  /** Mark a previously walled cell as passable. */
  removeWall(x: number, y: number): void {
    this.#walls.delete(cellId(x, y));
  }

  /** Check whether a cell is a wall. */
  isWall(x: number, y: number): boolean {
    return this.#walls.has(cellId(x, y));
  }

  /**
   * Find the shortest path between two cells using A*.
   * Returns an array of `[x, y]` pairs from start to goal, or `null`.
   */
  findPath(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
  ): [number, number][] | null {
    const graph: AStarGraph = {
      neighbors: (node: string) => {
        const [nx, ny] = parseId(node);
        const result: { id: string; cost: number }[] = [];
        for (const [dx, dy] of DIRS) {
          const cx = nx + dx;
          const cy = ny + dy;
          if (
            cx >= 0 &&
            cx < this.width &&
            cy >= 0 &&
            cy < this.height &&
            !this.#walls.has(cellId(cx, cy))
          ) {
            result.push({ id: cellId(cx, cy), cost: 1 });
          }
        }
        return result;
      },
      heuristic: (a: string, b: string) => {
        const [ax, ay] = parseId(a);
        const [bx, by] = parseId(b);
        return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan distance
      },
    };

    const startId = cellId(startX, startY);
    const goalId = cellId(goalX, goalY);

    // Bail early if start or goal is a wall or out of bounds.
    if (
      this.#walls.has(startId) ||
      this.#walls.has(goalId) ||
      startX < 0 || startX >= this.width ||
      startY < 0 || startY >= this.height ||
      goalX < 0 || goalX >= this.width ||
      goalY < 0 || goalY >= this.height
    ) {
      return null;
    }

    const result = astar(graph, startId, goalId);
    if (!result) return null;

    return result.path.map(parseId);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a new `GridGraph` with the given dimensions and no walls. */
export function createGridGraph(width: number, height: number): GridGraph {
  return new GridGraph(width, height);
}
