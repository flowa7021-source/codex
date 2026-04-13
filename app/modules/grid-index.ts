// @ts-check
// ─── Fixed-Grid Spatial Index ──────────────────────────────────────────────
// A bounded, fixed-size spatial index that maps items to grid cells by
// position.  Supports point, rectangle, radius, and nearest-neighbour
// queries.

// ─── Internal item record ──────────────────────────────────────────────────

interface ItemRecord<T> {
  item: T;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
}

// ─── GridIndex ─────────────────────────────────────────────────────────────

/**
 * A fixed-size 2-D grid index.
 *
 * The world is `width x height` units, divided into cells of `cellSize`.
 * Items are inserted at a single point `(x, y)` and stored in the cell that
 * contains that point.
 */
export class GridIndex<T> {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly #cols: number;
  readonly #rows: number;

  /** Grid storage: flattened array of item sets, indexed by `row * cols + col`. */
  readonly #grid: Set<T>[];

  /** Reverse lookup from item to its record. */
  readonly #items: Map<T, ItemRecord<T>>;

  constructor(width: number, height: number, cellSize: number) {
    if (cellSize <= 0) throw new RangeError('cellSize must be positive');
    if (width <= 0 || height <= 0) throw new RangeError('width and height must be positive');

    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.#cols = Math.ceil(width / cellSize);
    this.#rows = Math.ceil(height / cellSize);

    this.#grid = new Array(this.#cols * this.#rows);
    for (let i = 0; i < this.#grid.length; i++) {
      this.#grid[i] = new Set();
    }

    this.#items = new Map();
  }

  // ── Insertion / removal ────────────────────────────────────────────────

  /**
   * Insert an item at `(x, y)`.
   * Returns `false` (and does nothing) if the point is outside the grid.
   */
  insert(item: T, x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

    // Remove existing entry if present (idempotent re-insert).
    if (this.#items.has(item)) {
      this.remove(item);
    }

    const cellX = Math.min(Math.floor(x / this.cellSize), this.#cols - 1);
    const cellY = Math.min(Math.floor(y / this.cellSize), this.#rows - 1);

    const record: ItemRecord<T> = { item, x, y, cellX, cellY };
    this.#items.set(item, record);
    this.#bucket(cellX, cellY).add(item);
    return true;
  }

  /** Remove a previously inserted item. Returns `true` if found. */
  remove(item: T): boolean {
    const record = this.#items.get(item);
    if (!record) return false;

    this.#bucket(record.cellX, record.cellY).delete(item);
    this.#items.delete(item);
    return true;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /** Return all items in the cell at grid coordinates `(cellX, cellY)`. */
  queryCell(cellX: number, cellY: number): T[] {
    if (cellX < 0 || cellX >= this.#cols || cellY < 0 || cellY >= this.#rows) {
      return [];
    }
    return [...this.#bucket(cellX, cellY)];
  }

  /** Return all items within `radius` distance of `(x, y)`. */
  queryRadius(x: number, y: number, radius: number): T[] {
    const r2 = radius * radius;
    const result: T[] = [];

    // Determine the cell range to scan.
    const minCX = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const minCY = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCX = Math.min(this.#cols - 1, Math.floor((x + radius) / this.cellSize));
    const maxCY = Math.min(this.#rows - 1, Math.floor((y + radius) / this.cellSize));

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (const item of this.#bucket(cx, cy)) {
          const rec = this.#items.get(item)!;
          const dx = rec.x - x;
          const dy = rec.y - y;
          if (dx * dx + dy * dy <= r2) {
            result.push(item);
          }
        }
      }
    }

    return result;
  }

  /** Return all items whose position falls within the rectangle `(x, y, w, h)`. */
  queryRect(x: number, y: number, w: number, h: number): T[] {
    const result: T[] = [];

    const minCX = Math.max(0, Math.floor(x / this.cellSize));
    const minCY = Math.max(0, Math.floor(y / this.cellSize));
    const maxCX = Math.min(this.#cols - 1, Math.floor((x + w) / this.cellSize));
    const maxCY = Math.min(this.#rows - 1, Math.floor((y + h) / this.cellSize));

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (const item of this.#bucket(cx, cy)) {
          const rec = this.#items.get(item)!;
          if (rec.x >= x && rec.x <= x + w && rec.y >= y && rec.y <= y + h) {
            result.push(item);
          }
        }
      }
    }

    return result;
  }

  /**
   * Return the nearest item to `(x, y)`, or `null` if the grid is empty.
   * If `maxDistance` is given, only items within that distance are considered.
   */
  nearest(x: number, y: number, maxDistance?: number): T | null {
    const limit = maxDistance ?? Math.max(this.width, this.height);
    let best: T | null = null;
    let bestD2 = limit * limit;

    // Spiral outward from the query cell, stopping early when the minimum
    // possible distance of the next ring exceeds the best found so far.
    const startCX = Math.floor(x / this.cellSize);
    const startCY = Math.floor(y / this.cellSize);

    const maxRing = Math.max(this.#cols, this.#rows);

    for (let ring = 0; ring <= maxRing; ring++) {
      // Minimum possible squared distance to any point in this ring of cells.
      const ringDist = Math.max(0, ring - 1) * this.cellSize;
      if (ringDist * ringDist > bestD2) break;

      const minCX = Math.max(0, startCX - ring);
      const maxCX = Math.min(this.#cols - 1, startCX + ring);
      const minCY = Math.max(0, startCY - ring);
      const maxCY = Math.min(this.#rows - 1, startCY + ring);

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          // Only visit cells on the border of this ring (inner cells
          // were handled in previous rings).
          if (
            ring > 0 &&
            cx > minCX && cx < maxCX &&
            cy > minCY && cy < maxCY
          ) {
            continue;
          }

          for (const item of this.#bucket(cx, cy)) {
            const rec = this.#items.get(item)!;
            const dx = rec.x - x;
            const dy = rec.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = item;
            }
          }
        }
      }
    }

    return best;
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  /** Number of items currently stored. */
  get size(): number {
    return this.#items.size;
  }

  /** Remove all items from the grid. */
  clear(): void {
    for (const bucket of this.#grid) {
      bucket.clear();
    }
    this.#items.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────

  /** Return the set for a given cell coordinate. */
  #bucket(cx: number, cy: number): Set<T> {
    return this.#grid[cy * this.#cols + cx];
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

/** Create a new `GridIndex` with the given world size and cell size. */
export function createGridIndex<T>(
  width: number,
  height: number,
  cellSize: number,
): GridIndex<T> {
  return new GridIndex<T>(width, height, cellSize);
}
