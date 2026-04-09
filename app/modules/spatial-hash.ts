// @ts-check
// ─── Spatial Hash Grid ─────────────────────────────────────────────────────
// A spatial hash grid for efficient 2-D broad-phase collision detection.
// Objects are hashed into grid cells based on their axis-aligned bounding box
// so that only items sharing a cell need fine-grained intersection tests.

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Encode a cell coordinate pair into a single string key. */
function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

// ─── Internal item record ──────────────────────────────────────────────────

interface ItemRecord<T> {
  item: T;
  /** Cell keys the item currently occupies. */
  cells: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── SpatialHash ───────────────────────────────────────────────────────────

/**
 * Generic spatial hash grid.
 *
 * Items are inserted with an axis-aligned bounding box (AABB) and hashed into
 * fixed-size grid cells. Queries return all items whose cells overlap the
 * query region.
 */
export class SpatialHash<T> {
  readonly cellSize: number;

  /** Map from cell key to the set of items in that cell. */
  readonly #cells: Map<string, Set<T>>;

  /** Map from item to its current record (cells + AABB). */
  readonly #items: Map<T, ItemRecord<T>>;

  constructor(cellSize: number) {
    if (cellSize <= 0) {
      throw new RangeError('cellSize must be positive');
    }
    this.cellSize = cellSize;
    this.#cells = new Map();
    this.#items = new Map();
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /** Return every item whose AABB overlaps the given rectangle. */
  query(x: number, y: number, width: number, height: number): T[] {
    const seen = new Set<T>();
    const result: T[] = [];

    const minCX = Math.floor(x / this.cellSize);
    const minCY = Math.floor(y / this.cellSize);
    const maxCX = Math.floor((x + width) / this.cellSize);
    const maxCY = Math.floor((y + height) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const bucket = this.#cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (seen.has(item)) continue;
          seen.add(item);
          result.push(item);
        }
      }
    }

    return result;
  }

  /** Return every item whose cell(s) contain the given point. */
  queryPoint(x: number, y: number): T[] {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const bucket = this.#cells.get(cellKey(cx, cy));
    return bucket ? [...bucket] : [];
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  /** Insert an item with the given AABB. */
  insert(item: T, x: number, y: number, width: number, height: number): void {
    // Remove existing entry if present (idempotent re-insert).
    if (this.#items.has(item)) {
      this.remove(item);
    }

    const cells = this.#cellsFor(x, y, width, height);
    this.#items.set(item, { item, cells, x, y, width, height });

    for (const key of cells) {
      let bucket = this.#cells.get(key);
      if (!bucket) {
        bucket = new Set();
        this.#cells.set(key, bucket);
      }
      bucket.add(item);
    }
  }

  /** Remove a previously inserted item. Returns `true` if found. */
  remove(item: T): boolean {
    const record = this.#items.get(item);
    if (!record) return false;

    for (const key of record.cells) {
      const bucket = this.#cells.get(key);
      if (bucket) {
        bucket.delete(item);
        if (bucket.size === 0) {
          this.#cells.delete(key);
        }
      }
    }

    this.#items.delete(item);
    return true;
  }

  /** Shorthand: remove then re-insert with a new AABB. */
  update(item: T, x: number, y: number, width: number, height: number): void {
    this.remove(item);
    this.insert(item, x, y, width, height);
  }

  /** Number of items currently stored. */
  get size(): number {
    return this.#items.size;
  }

  /** Remove all items and cells. */
  clear(): void {
    this.#cells.clear();
    this.#items.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────

  /** Compute the list of cell keys that an AABB overlaps. */
  #cellsFor(x: number, y: number, width: number, height: number): string[] {
    const keys: string[] = [];
    const minCX = Math.floor(x / this.cellSize);
    const minCY = Math.floor(y / this.cellSize);
    const maxCX = Math.floor((x + width) / this.cellSize);
    const maxCY = Math.floor((y + height) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        keys.push(cellKey(cx, cy));
      }
    }
    return keys;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

/** Create a new `SpatialHash` with the given cell size. */
export function createSpatialHash<T>(cellSize: number): SpatialHash<T> {
  return new SpatialHash<T>(cellSize);
}
