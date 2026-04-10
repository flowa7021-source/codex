// @ts-check
// ─── Conway's Game of Life ───────────────────────────────────────────────────
// A self-contained implementation of Conway's Game of Life with support for
// wrapping boundaries, RLE import, and named patterns.

// ─── Types ────────────────────────────────────────────────────────────────────

export type Cell = 0 | 1;
export type Grid = Cell[][];

// ─── GameOfLife ───────────────────────────────────────────────────────────────

export class GameOfLife {
  readonly #width: number;
  readonly #height: number;
  readonly #wrap: boolean;
  readonly #cells: Cell[][];

  constructor(width: number, height: number, wrap: boolean = false) {
    if (width < 1 || height < 1) {
      throw new RangeError('Width and height must be at least 1');
    }
    this.#width = width;
    this.#height = height;
    this.#wrap = wrap;
    // Initialise all cells to dead (0)
    this.#cells = Array.from({ length: height }, () =>
      new Array<Cell>(width).fill(0),
    );
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  // ─── Cell Access ──────────────────────────────────────────────────────────

  /** Set cell state at (x, y). */
  set(x: number, y: number, alive: boolean): void {
    const rx = this.#resolveX(x);
    const ry = this.#resolveY(y);
    if (rx === null || ry === null) return;
    this.#cells[ry][rx] = alive ? 1 : 0;
  }

  /** Get cell state at (x, y). Returns false for out-of-bounds on non-wrapping grids. */
  get(x: number, y: number): boolean {
    const rx = this.#resolveX(x);
    const ry = this.#resolveY(y);
    if (rx === null || ry === null) return false;
    return this.#cells[ry][rx] === 1;
  }

  // ─── Neighbour Counting ───────────────────────────────────────────────────

  /** Count live neighbours of cell at (x, y). */
  liveNeighbors(x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.get(x + dx, y + dy)) count++;
      }
    }
    return count;
  }

  // ─── Evolution ────────────────────────────────────────────────────────────

  /** Advance one generation. Returns a new GameOfLife instance. */
  step(): GameOfLife {
    const next = new GameOfLife(this.#width, this.#height, this.#wrap);
    for (let y = 0; y < this.#height; y++) {
      for (let x = 0; x < this.#width; x++) {
        const alive = this.#cells[y][x] === 1;
        const neighbors = this.liveNeighbors(x, y);
        // Conway's rules:
        //   Live cell survives with 2 or 3 neighbours.
        //   Dead cell becomes alive with exactly 3 neighbours.
        const nextAlive = alive
          ? neighbors === 2 || neighbors === 3
          : neighbors === 3;
        next.#cells[y][x] = nextAlive ? 1 : 0;
      }
    }
    return next;
  }

  // ─── Population ───────────────────────────────────────────────────────────

  /** Count all live cells. */
  get population(): number {
    let count = 0;
    for (let y = 0; y < this.#height; y++) {
      for (let x = 0; x < this.#width; x++) {
        if (this.#cells[y][x] === 1) count++;
      }
    }
    return count;
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  /** Export as 2D boolean grid (row-major: result[y][x]). */
  toGrid(): boolean[][] {
    return this.#cells.map(row => row.map(cell => cell === 1));
  }

  /** Export as string: '#' = alive, '.' = dead, rows separated by newlines. */
  toString(): string {
    return this.#cells
      .map(row => row.map(cell => (cell === 1 ? '#' : '.')).join(''))
      .join('\n');
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  /**
   * Import from string: '#' = alive, any other character = dead.
   * Rows are separated by newlines. Width/height are inferred from content.
   */
  static fromString(s: string, wrap: boolean = false): GameOfLife {
    const rows = s.split('\n');
    const height = rows.length;
    const width = Math.max(...rows.map(r => r.length));
    const gol = new GameOfLife(width || 1, height || 1, wrap);
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] === '#') {
          gol.set(x, y, true);
        }
      }
    }
    return gol;
  }

  /**
   * Import from RLE (Run Length Encoded) format.
   * Supports the header line "x = W, y = H" followed by RLE data.
   * 'b' = dead, 'o' = alive, '$' = end-of-row, '!' = end.
   */
  static fromRLE(rle: string, wrap: boolean = false): GameOfLife {
    const lines = rle.split('\n').filter(l => !l.startsWith('#'));

    let width = 0;
    let height = 0;
    let dataLines: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/i);
      if (headerMatch) {
        width = parseInt(headerMatch[1], 10);
        height = parseInt(headerMatch[2], 10);
      } else {
        dataLines.push(line);
      }
    }

    const data = dataLines.join('');
    // Parse RLE data if we have explicit dimensions; otherwise infer them
    const cells: boolean[][] = [];
    let currentRow: boolean[] = [];
    let runBuf = '';

    for (const ch of data) {
      if (ch === '!') break;
      if (ch >= '0' && ch <= '9') {
        runBuf += ch;
      } else {
        const run = runBuf ? parseInt(runBuf, 10) : 1;
        runBuf = '';
        if (ch === 'b') {
          for (let i = 0; i < run; i++) currentRow.push(false);
        } else if (ch === 'o') {
          for (let i = 0; i < run; i++) currentRow.push(true);
        } else if (ch === '$') {
          cells.push(currentRow);
          // Extra end-of-row tokens mean blank rows
          for (let i = 1; i < run; i++) cells.push([]);
          currentRow = [];
        }
      }
    }
    // Push the last row (if it has content or if there's no terminating '$')
    if (currentRow.length > 0 || cells.length === 0) {
      cells.push(currentRow);
    }

    // Determine dimensions
    if (width === 0) width = Math.max(...cells.map(r => r.length), 1);
    if (height === 0) height = cells.length || 1;

    const gol = new GameOfLife(width, height, wrap);
    for (let y = 0; y < cells.length && y < height; y++) {
      for (let x = 0; x < cells[y].length && x < width; x++) {
        if (cells[y][x]) gol.set(x, y, true);
      }
    }
    return gol;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  #resolveX(x: number): number | null {
    if (this.#wrap) return ((x % this.#width) + this.#width) % this.#width;
    if (x < 0 || x >= this.#width) return null;
    return x;
  }

  #resolveY(y: number): number | null {
    if (this.#wrap) return ((y % this.#height) + this.#height) % this.#height;
    if (y < 0 || y >= this.#height) return null;
    return y;
  }
}

// ─── Named Patterns ───────────────────────────────────────────────────────────

/**
 * Named Game of Life patterns as plain-text strings.
 * '#' = alive, '.' = dead.
 */
export const PATTERNS = {
  /** Period-2 oscillator. */
  BLINKER: '.....\n..#..\n..#..\n..#..\n.....',
  /** Moves diagonally one cell per two generations. */
  GLIDER: '.#...\n..##.\n.##..\n.....\n.....',
  /** 2×2 still life. */
  BLOCK: '.##.\n.##.\n....',
  /** Hexagonal still life. */
  BEEHIVE: '.##..\n#..#.\n.##..',
  /** Period-2 oscillator. */
  TOAD: '......\n..###.\n.###..\n......',
} as const;
