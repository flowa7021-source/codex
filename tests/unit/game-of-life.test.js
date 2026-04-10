// ─── Unit Tests: Conway's Game of Life ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GameOfLife, PATTERNS } from '../../app/modules/game-of-life.js';

// ─── Basic Construction ──────────────────────────────────────────────────────

describe('GameOfLife – construction', () => {
  it('creates a grid with given dimensions', () => {
    const gol = new GameOfLife(10, 8);
    assert.equal(gol.width, 10);
    assert.equal(gol.height, 8);
  });

  it('starts with all cells dead (population 0)', () => {
    const gol = new GameOfLife(5, 5);
    assert.equal(gol.population, 0);
  });

  it('throws for zero width or height', () => {
    assert.throws(() => new GameOfLife(0, 5), RangeError);
    assert.throws(() => new GameOfLife(5, 0), RangeError);
  });
});

// ─── Cell Get / Set ──────────────────────────────────────────────────────────

describe('GameOfLife – get/set', () => {
  it('set and get a single cell', () => {
    const gol = new GameOfLife(5, 5);
    assert.equal(gol.get(2, 3), false);
    gol.set(2, 3, true);
    assert.equal(gol.get(2, 3), true);
  });

  it('set to false kills a live cell', () => {
    const gol = new GameOfLife(5, 5);
    gol.set(1, 1, true);
    gol.set(1, 1, false);
    assert.equal(gol.get(1, 1), false);
  });

  it('out-of-bounds get returns false on non-wrapping grid', () => {
    const gol = new GameOfLife(5, 5);
    gol.set(0, 0, true);
    assert.equal(gol.get(-1, 0), false);
    assert.equal(gol.get(5, 0), false);
    assert.equal(gol.get(0, -1), false);
    assert.equal(gol.get(0, 5), false);
  });
});

// ─── Population Count ────────────────────────────────────────────────────────

describe('GameOfLife – population', () => {
  it('counts live cells correctly', () => {
    const gol = new GameOfLife(5, 5);
    gol.set(0, 0, true);
    gol.set(1, 1, true);
    gol.set(2, 2, true);
    assert.equal(gol.population, 3);
  });

  it('population decreases when cells die', () => {
    const gol = new GameOfLife(5, 5);
    gol.set(0, 0, true);
    gol.set(1, 0, true);
    // Two isolated cells — both die next generation (underpopulation)
    const next = gol.step();
    assert.equal(next.population, 0);
  });
});

// ─── liveNeighbors ───────────────────────────────────────────────────────────

describe('GameOfLife – liveNeighbors', () => {
  it('counts all 8 possible neighbours', () => {
    const gol = new GameOfLife(3, 3);
    // Surround the centre cell
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (!(x === 1 && y === 1)) gol.set(x, y, true);
      }
    }
    assert.equal(gol.liveNeighbors(1, 1), 8);
  });

  it('returns 0 for isolated cell', () => {
    const gol = new GameOfLife(5, 5);
    gol.set(2, 2, true);
    assert.equal(gol.liveNeighbors(2, 2), 0);
  });
});

// ─── Block (still life) ──────────────────────────────────────────────────────

describe('GameOfLife – block still life', () => {
  it('2x2 block is unchanged after a step', () => {
    // A block occupies a 2×2 area; place it in a 6×6 grid with padding
    const gol = new GameOfLife(6, 6);
    gol.set(2, 2, true);
    gol.set(3, 2, true);
    gol.set(2, 3, true);
    gol.set(3, 3, true);

    const next = gol.step();
    assert.equal(next.population, 4);
    assert.equal(next.get(2, 2), true);
    assert.equal(next.get(3, 2), true);
    assert.equal(next.get(2, 3), true);
    assert.equal(next.get(3, 3), true);
  });

  it('block is still after many generations', () => {
    const gol = new GameOfLife(6, 6);
    gol.set(2, 2, true);
    gol.set(3, 2, true);
    gol.set(2, 3, true);
    gol.set(3, 3, true);

    let current = gol;
    for (let i = 0; i < 10; i++) current = current.step();
    assert.equal(current.population, 4);
  });
});

// ─── Blinker (period-2 oscillator) ───────────────────────────────────────────

describe('GameOfLife – blinker oscillator', () => {
  // Vertical blinker in a 5×5 grid (centre column, rows 1-3)
  function makeBlinker() {
    const gol = new GameOfLife(5, 5);
    gol.set(2, 1, true);
    gol.set(2, 2, true);
    gol.set(2, 3, true);
    return gol;
  }

  it('blinker has population 3', () => {
    assert.equal(makeBlinker().population, 3);
  });

  it('blinker flips to horizontal after one step', () => {
    const next = makeBlinker().step();
    // Horizontal: row 2, columns 1-3
    assert.equal(next.get(1, 2), true);
    assert.equal(next.get(2, 2), true);
    assert.equal(next.get(3, 2), true);
    assert.equal(next.get(2, 1), false);
    assert.equal(next.get(2, 3), false);
  });

  it('blinker returns to original after two steps (period 2)', () => {
    const gen2 = makeBlinker().step().step();
    assert.equal(gen2.get(2, 1), true);
    assert.equal(gen2.get(2, 2), true);
    assert.equal(gen2.get(2, 3), true);
    assert.equal(gen2.get(1, 2), false);
    assert.equal(gen2.get(3, 2), false);
  });
});

// ─── Glider ───────────────────────────────────────────────────────────────────

describe('GameOfLife – glider', () => {
  // Standard glider placed at top-left of a 10×10 grid
  // .#.
  // ..#
  // ###
  function makeGlider() {
    const gol = new GameOfLife(10, 10);
    gol.set(1, 0, true);
    gol.set(2, 1, true);
    gol.set(0, 2, true);
    gol.set(1, 2, true);
    gol.set(2, 2, true);
    return gol;
  }

  it('glider has population 5', () => {
    assert.equal(makeGlider().population, 5);
  });

  it('glider population stays 5 after each step', () => {
    let g = makeGlider();
    for (let i = 0; i < 4; i++) {
      g = g.step();
      assert.equal(g.population, 5);
    }
  });

  it('glider has shifted diagonally by (1,1) after 4 generations', () => {
    // A standard glider on an infinite grid moves (1,1) every 4 generations.
    // We record the bounding-box of live cells before and after.
    const g0 = makeGlider();
    let g4 = g0;
    for (let i = 0; i < 4; i++) g4 = g4.step();

    // Collect live cells
    function liveCells(gol) {
      const cells = [];
      for (let y = 0; y < gol.height; y++) {
        for (let x = 0; x < gol.width; x++) {
          if (gol.get(x, y)) cells.push([x, y]);
        }
      }
      return cells;
    }

    const before = liveCells(g0);
    const after = liveCells(g4);

    // Both have the same number of cells
    assert.equal(after.length, before.length);

    // Every cell in `after` should be exactly (+1, +1) relative to the
    // corresponding sorted cell in `before`.
    const sortedBefore = before.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const sortedAfter = after.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

    for (let i = 0; i < sortedBefore.length; i++) {
      assert.equal(sortedAfter[i][0] - sortedBefore[i][0], 1, 'x should shift by 1');
      assert.equal(sortedAfter[i][1] - sortedBefore[i][1], 1, 'y should shift by 1');
    }
  });
});

// ─── Wrapping Boundaries ─────────────────────────────────────────────────────

describe('GameOfLife – wrap vs no-wrap', () => {
  it('no-wrap: cell at boundary has fewer potential neighbours', () => {
    // Top-left corner on non-wrapping grid — at most 3 neighbours
    const gol = new GameOfLife(5, 5, false);
    // Make a 3-cell cluster at top-left that would survive only with wrap
    gol.set(0, 0, true);
    gol.set(4, 0, true); // far right — NOT adjacent in no-wrap
    gol.set(0, 4, true); // far bottom — NOT adjacent in no-wrap
    // (0,0) has 0 live neighbours → dies
    const next = gol.step();
    assert.equal(next.get(0, 0), false);
  });

  it('wrap: corner cell sees neighbour on opposite edge', () => {
    // 5×5 wrapping grid: put 3 cells in the same row straddling the boundary
    // so that the centre cell has 2 neighbours and survives.
    const gol = new GameOfLife(5, 5, true);
    // Row 0: cells at x=3, x=4, x=0 (wraps around)
    gol.set(3, 0, true);
    gol.set(4, 0, true);
    gol.set(0, 0, true);
    // x=4 has neighbours at x=3 (alive) and x=0 (alive via wrap) → survives
    const next = gol.step();
    assert.equal(next.get(4, 0), true);
  });
});

// ─── toString / fromString round-trip ────────────────────────────────────────

describe('GameOfLife – toString / fromString', () => {
  it('toString produces # and . characters', () => {
    const gol = new GameOfLife(3, 2);
    gol.set(0, 0, true);
    gol.set(2, 1, true);
    const s = gol.toString();
    assert.equal(s, '#..\n..#');
  });

  it('fromString round-trip preserves live cells', () => {
    const original = new GameOfLife(5, 5);
    original.set(1, 0, true);
    original.set(3, 2, true);
    original.set(0, 4, true);

    const s = original.toString();
    const restored = GameOfLife.fromString(s);

    assert.equal(restored.width, original.width);
    assert.equal(restored.height, original.height);
    assert.equal(restored.population, original.population);
    assert.deepEqual(restored.toGrid(), original.toGrid());
  });

  it('fromString imports the BLINKER pattern string', () => {
    const gol = GameOfLife.fromString(PATTERNS.BLINKER);
    assert.equal(gol.population, 3);
  });
});

// ─── PATTERNS ─────────────────────────────────────────────────────────────────

describe('GameOfLife – PATTERNS', () => {
  it('BLOCK pattern is a still life', () => {
    const gol = GameOfLife.fromString(PATTERNS.BLOCK);
    const pop = gol.population;
    assert.ok(pop > 0);
    const next = gol.step();
    assert.equal(next.population, pop);
    assert.deepEqual(next.toGrid(), gol.toGrid());
  });

  it('BEEHIVE pattern is a still life', () => {
    const gol = GameOfLife.fromString(PATTERNS.BEEHIVE);
    const pop = gol.population;
    assert.ok(pop > 0);
    const next = gol.step();
    assert.equal(next.population, pop);
    assert.deepEqual(next.toGrid(), gol.toGrid());
  });

  it('BLINKER pattern has period 2', () => {
    const gol = GameOfLife.fromString(PATTERNS.BLINKER);
    const gen2 = gol.step().step();
    assert.deepEqual(gen2.toGrid(), gol.toGrid());
  });

  it('TOAD pattern has period 2', () => {
    const gol = GameOfLife.fromString(PATTERNS.TOAD);
    const gen2 = gol.step().step();
    assert.deepEqual(gen2.toGrid(), gol.toGrid());
  });

  it('GLIDER pattern has population 5', () => {
    const gol = GameOfLife.fromString(PATTERNS.GLIDER);
    assert.equal(gol.population, 5);
  });
});

// ─── fromRLE ─────────────────────────────────────────────────────────────────

describe('GameOfLife – fromRLE', () => {
  it('imports a simple glider in RLE format', () => {
    // Standard RLE for a glider:
    //   .#.
    //   ..#
    //   ###
    const rle = 'x = 3, y = 3\nb o b $ b b o $ o o o !';
    const gol = GameOfLife.fromRLE(rle);
    assert.equal(gol.width, 3);
    assert.equal(gol.height, 3);
    assert.equal(gol.population, 5);
  });

  it('RLE run-length encoding works (blinker)', () => {
    // Blinker: three cells in a row (1×3)
    const rle = 'x = 3, y = 1\n3o!';
    const gol = GameOfLife.fromRLE(rle);
    assert.equal(gol.population, 3);
    assert.equal(gol.get(0, 0), true);
    assert.equal(gol.get(1, 0), true);
    assert.equal(gol.get(2, 0), true);
  });
});
