// ─── Unit Tests: matrix-chain ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  matrixChainOrder,
  matrixMultiply,
  chainMultiply,
  matrixChainSplit,
} from '../../app/modules/matrix-chain.js';

// ─── matrixChainOrder ─────────────────────────────────────────────────────────

describe('matrixChainOrder', () => {
  it('returns cost 0 and empty string for empty dimensions', () => {
    const result = matrixChainOrder([]);
    assert.equal(result.cost, 0);
    assert.equal(result.order, '');
  });

  it('returns cost 0 for a single matrix', () => {
    const result = matrixChainOrder([10, 20]);
    assert.equal(result.cost, 0);
    assert.equal(result.order, 'A1');
  });

  it('computes cost for two matrices', () => {
    // A1: 10x20, A2: 20x30 => cost = 10*20*30 = 6000
    const result = matrixChainOrder([10, 20, 30]);
    assert.equal(result.cost, 6000);
    assert.equal(result.order, '(A1A2)');
  });

  it('computes classic 4-matrix example', () => {
    // Dimensions: [40, 20, 30, 10, 30]
    // Optimal: ((A1(A2A3))A4) with cost 26000
    const result = matrixChainOrder([40, 20, 30, 10, 30]);
    assert.equal(result.cost, 26000);
  });

  it('computes 3-matrix example from textbook', () => {
    // A1: 10x30, A2: 30x5, A3: 5x60
    // (A1A2)A3 = 10*30*5 + 10*5*60 = 1500 + 3000 = 4500
    // A1(A2A3) = 30*5*60 + 10*30*60 = 9000 + 18000 = 27000
    const result = matrixChainOrder([10, 30, 5, 60]);
    assert.equal(result.cost, 4500);
    assert.equal(result.order, '((A1A2)A3)');
  });

  it('parenthesization string has balanced parens', () => {
    const result = matrixChainOrder([5, 10, 3, 12, 5, 50, 6]);
    const opens = (result.order.match(/\(/g) || []).length;
    const closes = (result.order.match(/\)/g) || []).length;
    assert.equal(opens, closes);
  });
});

// ─── matrixChainSplit ─────────────────────────────────────────────────────────

describe('matrixChainSplit', () => {
  it('returns empty array for no matrices', () => {
    assert.deepEqual(matrixChainSplit([]), []);
  });

  it('returns valid split table for 4 matrices', () => {
    const s = matrixChainSplit([40, 20, 30, 10, 30]);
    // s[1][4] should be 3 for the classic example
    assert.equal(s[1][4], 3);
  });

  it('split table has correct dimensions', () => {
    const s = matrixChainSplit([1, 2, 3, 4]);
    // 3 matrices => table is 4x4 (indices 0..3, but 0-row unused)
    assert.equal(s.length, 4);
  });
});

// ─── matrixMultiply ───────────────────────────────────────────────────────────

describe('matrixMultiply', () => {
  it('multiplies two 2x2 matrices', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(matrixMultiply(a, b), [[19, 22], [43, 50]]);
  });

  it('multiplies non-square matrices', () => {
    // 2x3 * 3x2
    const a = [[1, 2, 3], [4, 5, 6]];
    const b = [[7, 8], [9, 10], [11, 12]];
    assert.deepEqual(matrixMultiply(a, b), [[58, 64], [139, 154]]);
  });

  it('throws on incompatible dimensions', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[1, 2, 3]];
    assert.throws(() => matrixMultiply(a, b), /Incompatible dimensions/);
  });

  it('handles identity multiplication', () => {
    const a = [[1, 0], [0, 1]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(matrixMultiply(a, b), [[5, 6], [7, 8]]);
  });
});

// ─── chainMultiply ────────────────────────────────────────────────────────────

describe('chainMultiply', () => {
  it('returns empty array for no matrices', () => {
    assert.deepEqual(chainMultiply([]), []);
  });

  it('returns the single matrix unchanged', () => {
    const m = [[1, 2], [3, 4]];
    assert.deepEqual(chainMultiply([m]), m);
  });

  it('multiplies chain of three matrices correctly', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    const c = [[1, 0], [0, 1]];
    // A*B = [[19,22],[43,50]], (A*B)*C = same (identity)
    const result = chainMultiply([a, b, c]);
    assert.deepEqual(result, [[19, 22], [43, 50]]);
  });

  it('chain result matches sequential multiplication', () => {
    const a = [[1, 2, 3]];         // 1x3
    const b = [[4], [5], [6]];     // 3x1
    const c = [[7, 8]];            // 1x2
    // a*b = [[32]], (a*b)*c = [[224, 256]]
    const expected = matrixMultiply(matrixMultiply(a, b), c);
    const result = chainMultiply([a, b, c]);
    assert.deepEqual(result, expected);
  });
});
