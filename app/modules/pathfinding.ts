// @ts-check
// ─── Grid Pathfinding ────────────────────────────────────────────────────────
// Grid-based pathfinding algorithms (A*, BFS) and helpers.
// No browser APIs — pure computation.

// ─── Types ───────────────────────────────────────────────────────────────────

/** true = walkable, false = obstacle */
export type Grid = boolean[][];

export interface Point {
  x: number;
  y: number;
}

export interface PathResult {
  path: Point[];
  cost: number;
}

// ─── isWalkable ───────────────────────────────────────────────────────────────

/** Check if a point is walkable (in bounds and not obstacle). */
export function isWalkable(grid: Grid, point: Point): boolean {
  const { x, y } = point;
  if (y < 0 || y >= grid.length) return false;
  if (x < 0 || x >= grid[y].length) return false;
  return grid[y][x];
}

// ─── manhattan ────────────────────────────────────────────────────────────────

/** Manhattan distance heuristic. */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ─── euclidean ────────────────────────────────────────────────────────────────

/** Euclidean distance. */
export function euclidean(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── getNeighbors ─────────────────────────────────────────────────────────────

/** Get neighbors of a point (4 or 8 directions). */
export function getNeighbors(grid: Grid, point: Point, diagonal = false): Point[] {
  const { x, y } = point;
  const cardinalOffsets: [number, number][] = [
    [0, -1], // up
    [1, 0],  // right
    [0, 1],  // down
    [-1, 0], // left
  ];
  const diagonalOffsets: [number, number][] = [
    [-1, -1], // top-left
    [1, -1],  // top-right
    [1, 1],   // bottom-right
    [-1, 1],  // bottom-left
  ];

  const offsets = diagonal
    ? [...cardinalOffsets, ...diagonalOffsets]
    : cardinalOffsets;

  const neighbors: Point[] = [];
  for (const [dx, dy] of offsets) {
    const candidate = { x: x + dx, y: y + dy };
    if (isWalkable(grid, candidate)) {
      neighbors.push(candidate);
    }
  }
  return neighbors;
}

// ─── A* ──────────────────────────────────────────────────────────────────────

interface AStarNode {
  point: Point;
  g: number; // cost from start
  f: number; // g + h
  prev: AStarNode | null;
}

function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

/** A* pathfinding on a 2D grid. Returns null if no path. */
export function aStar(
  grid: Grid,
  start: Point,
  end: Point,
  allowDiagonal = false,
): PathResult | null {
  if (!isWalkable(grid, start) || !isWalkable(grid, end)) return null;

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();
  const gScore = new Map<string, number>();

  const startKey = pointKey(start);
  gScore.set(startKey, 0);

  openSet.push({
    point: start,
    g: 0,
    f: manhattan(start, end),
    prev: null,
  });

  while (openSet.length > 0) {
    // Find node with lowest f score
    let minIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[minIdx].f) minIdx = i;
    }
    const current = openSet.splice(minIdx, 1)[0];
    const key = pointKey(current.point);

    if (closedSet.has(key)) continue;
    closedSet.add(key);

    // Reached the goal
    if (current.point.x === end.x && current.point.y === end.y) {
      const path: Point[] = [];
      let node: AStarNode | null = current;
      while (node !== null) {
        path.unshift(node.point);
        node = node.prev;
      }
      return { path, cost: current.g };
    }

    const neighbors = getNeighbors(grid, current.point, allowDiagonal);
    for (const neighbor of neighbors) {
      const neighborKey = pointKey(neighbor);
      if (closedSet.has(neighborKey)) continue;

      // Cost: diagonal moves cost sqrt(2), cardinal moves cost 1
      const isDiagonal =
        neighbor.x !== current.point.x && neighbor.y !== current.point.y;
      const moveCost = isDiagonal ? Math.SQRT2 : 1;
      const tentativeG = current.g + moveCost;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        gScore.set(neighborKey, tentativeG);
        const h = manhattan(neighbor, end);
        openSet.push({
          point: neighbor,
          g: tentativeG,
          f: tentativeG + h,
          prev: current,
        });
      }
    }
  }

  return null;
}

// ─── bfsPath ──────────────────────────────────────────────────────────────────

/** BFS pathfinding on grid (unweighted). */
export function bfsPath(grid: Grid, start: Point, end: Point): PathResult | null {
  if (!isWalkable(grid, start) || !isWalkable(grid, end)) return null;

  interface BfsNode {
    point: Point;
    prev: BfsNode | null;
    cost: number;
  }

  const visited = new Set<string>();
  const startKey = pointKey(start);
  visited.add(startKey);

  const queue: BfsNode[] = [{ point: start, prev: null, cost: 0 }];

  while (queue.length > 0) {
    const current = queue.shift() as BfsNode;

    if (current.point.x === end.x && current.point.y === end.y) {
      const path: Point[] = [];
      let node: BfsNode | null = current;
      while (node !== null) {
        path.unshift(node.point);
        node = node.prev;
      }
      return { path, cost: current.cost };
    }

    const neighbors = getNeighbors(grid, current.point, false);
    for (const neighbor of neighbors) {
      const neighborKey = pointKey(neighbor);
      if (!visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push({ point: neighbor, prev: current, cost: current.cost + 1 });
      }
    }
  }

  return null;
}
