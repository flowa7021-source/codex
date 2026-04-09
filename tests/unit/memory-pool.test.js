// ─── Unit Tests: MemoryPool ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryPool, createMemoryPool } from '../../app/modules/memory-pool.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('MemoryPool – constructor', () => {
  it('creates a pool with zero blocks by default', () => {
    const pool = new MemoryPool({ blockSize: 1024 });
    assert.equal(pool.size, 0);
    assert.equal(pool.available, 0);
    assert.equal(pool.used, 0);
  });

  it('pre-allocates initialBlocks when specified', () => {
    const pool = new MemoryPool({ blockSize: 512, initialBlocks: 4 });
    assert.equal(pool.size, 4);
    assert.equal(pool.available, 4);
    assert.equal(pool.used, 0);
  });

  it('throws RangeError for blockSize <= 0', () => {
    assert.throws(() => new MemoryPool({ blockSize: 0 }), RangeError);
    assert.throws(() => new MemoryPool({ blockSize: -1 }), RangeError);
  });

  it('accepts maxBlocks option without error', () => {
    const pool = new MemoryPool({ blockSize: 256, maxBlocks: 10 });
    assert.equal(pool.size, 0);
  });

  it('pre-allocates no more than maxBlocks when initialBlocks exceeds it', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 10, maxBlocks: 5 });
    assert.equal(pool.size, 5);
    assert.equal(pool.available, 5);
  });
});

// ─── allocate ─────────────────────────────────────────────────────────────────

describe('MemoryPool – allocate', () => {
  it('returns an ArrayBuffer of the correct size', () => {
    const pool = new MemoryPool({ blockSize: 128 });
    const buf = pool.allocate();
    assert.ok(buf instanceof ArrayBuffer);
    assert.equal(buf.byteLength, 128);
  });

  it('increments used count', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    pool.allocate();
    pool.allocate();
    assert.equal(pool.used, 2);
    assert.equal(pool.size, 2);
  });

  it('reuses a freed block instead of creating a new one', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 1 });
    const buf = pool.allocate();
    assert.equal(pool.size, 1);
    pool.free(buf);
    const buf2 = pool.allocate();
    assert.equal(pool.size, 1); // no new allocation
    assert.ok(buf2 instanceof ArrayBuffer);
  });

  it('returns null when maxBlocks is exhausted', () => {
    const pool = new MemoryPool({ blockSize: 64, maxBlocks: 2 });
    pool.allocate();
    pool.allocate();
    const result = pool.allocate();
    assert.equal(result, null);
  });

  it('available decreases after allocate', () => {
    const pool = new MemoryPool({ blockSize: 32, initialBlocks: 3 });
    pool.allocate();
    assert.equal(pool.available, 2);
  });

  it('allocates from pool before creating new blocks', () => {
    const pool = new MemoryPool({ blockSize: 16, initialBlocks: 2 });
    const b1 = pool.allocate();
    pool.free(b1);
    // pool now has 1 recycled block; total should still be 2
    pool.allocate();
    assert.equal(pool.size, 2);
  });

  it('allocates successfully up to maxBlocks', () => {
    const pool = new MemoryPool({ blockSize: 8, maxBlocks: 3 });
    const results = [pool.allocate(), pool.allocate(), pool.allocate()];
    assert.ok(results.every((r) => r instanceof ArrayBuffer));
    assert.equal(pool.allocate(), null);
  });
});

// ─── free ─────────────────────────────────────────────────────────────────────

describe('MemoryPool – free', () => {
  it('returns block to the pool', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    const buf = pool.allocate();
    assert.equal(pool.available, 0);
    pool.free(buf);
    assert.equal(pool.available, 1);
  });

  it('decrements used count', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    const buf = pool.allocate();
    assert.equal(pool.used, 1);
    pool.free(buf);
    assert.equal(pool.used, 0);
  });

  it('discards block when pool is at maxBlocks capacity', () => {
    const pool = new MemoryPool({ blockSize: 32, maxBlocks: 2, initialBlocks: 2 });
    const extra = new ArrayBuffer(32);
    pool.free(extra); // pool already has 2 — should be silently dropped
    assert.equal(pool.available, 2);
  });

  it('freed blocks are reusable', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    const buf = pool.allocate();
    pool.free(buf);
    const buf2 = pool.allocate();
    assert.ok(buf2 instanceof ArrayBuffer);
    assert.equal(pool.available, 0);
  });

  it('can free multiple blocks independently', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    const b1 = pool.allocate();
    const b2 = pool.allocate();
    const b3 = pool.allocate();
    pool.free(b1);
    pool.free(b2);
    pool.free(b3);
    assert.equal(pool.available, 3);
    assert.equal(pool.used, 0);
  });
});

// ─── grow ─────────────────────────────────────────────────────────────────────

describe('MemoryPool – grow', () => {
  it('adds n blocks to the pool', () => {
    const pool = new MemoryPool({ blockSize: 256 });
    pool.grow(5);
    assert.equal(pool.size, 5);
    assert.equal(pool.available, 5);
  });

  it('does not create blocks beyond maxBlocks', () => {
    const pool = new MemoryPool({ blockSize: 64, maxBlocks: 3 });
    pool.grow(10);
    assert.equal(pool.size, 3);
    assert.equal(pool.available, 3);
  });

  it('combines with initialBlocks towards the cap', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 2, maxBlocks: 5 });
    pool.grow(10);
    assert.equal(pool.size, 5);
  });

  it('grow(0) is a no-op', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    pool.grow(0);
    assert.equal(pool.size, 0);
  });

  it('freshly grown blocks are allocatable', () => {
    const pool = new MemoryPool({ blockSize: 128 });
    pool.grow(3);
    const b = pool.allocate();
    assert.ok(b instanceof ArrayBuffer);
    assert.equal(b.byteLength, 128);
    assert.equal(pool.available, 2);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('MemoryPool – clear', () => {
  it('resets size and available to zero', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 5 });
    pool.clear();
    assert.equal(pool.size, 0);
    assert.equal(pool.available, 0);
    assert.equal(pool.used, 0);
  });

  it('allows allocation again after clear', () => {
    const pool = new MemoryPool({ blockSize: 64, maxBlocks: 2 });
    pool.allocate();
    pool.allocate();
    assert.equal(pool.allocate(), null);
    pool.clear();
    const buf = pool.allocate();
    assert.ok(buf instanceof ArrayBuffer);
  });

  it('can be called on an empty pool without error', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    assert.doesNotThrow(() => pool.clear());
  });

  it('pool is usable after multiple clear cycles', () => {
    const pool = new MemoryPool({ blockSize: 32 });
    for (let i = 0; i < 3; i++) {
      pool.grow(4);
      pool.clear();
    }
    assert.equal(pool.size, 0);
    pool.grow(2);
    assert.equal(pool.available, 2);
  });
});

// ─── size / available / used getters ──────────────────────────────────────────

describe('MemoryPool – size / available / used', () => {
  it('size equals available + used', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 4 });
    pool.allocate();
    pool.allocate();
    assert.equal(pool.size, pool.available + pool.used);
  });

  it('used is 0 when all blocks are in the pool', () => {
    const pool = new MemoryPool({ blockSize: 64, initialBlocks: 3 });
    assert.equal(pool.used, 0);
  });

  it('available is 0 when all blocks are checked out', () => {
    const pool = new MemoryPool({ blockSize: 32, initialBlocks: 2 });
    pool.allocate();
    pool.allocate();
    assert.equal(pool.available, 0);
  });

  it('used tracks multiple outstanding blocks', () => {
    const pool = new MemoryPool({ blockSize: 16 });
    pool.allocate();
    pool.allocate();
    pool.allocate();
    assert.equal(pool.used, 3);
  });

  it('size does not decrease when blocks are freed', () => {
    const pool = new MemoryPool({ blockSize: 64 });
    const b = pool.allocate();
    assert.equal(pool.size, 1);
    pool.free(b);
    assert.equal(pool.size, 1);
  });
});

// ─── createMemoryPool factory ─────────────────────────────────────────────────

describe('createMemoryPool', () => {
  it('returns a MemoryPool instance', () => {
    const pool = createMemoryPool({ blockSize: 512 });
    assert.ok(pool instanceof MemoryPool);
  });

  it('passes options through correctly', () => {
    const pool = createMemoryPool({ blockSize: 256, initialBlocks: 3, maxBlocks: 10 });
    assert.equal(pool.size, 3);
    assert.equal(pool.available, 3);
  });

  it('allocate / free cycle works via factory', () => {
    const pool = createMemoryPool({ blockSize: 128 });
    const buf = pool.allocate();
    assert.ok(buf instanceof ArrayBuffer);
    pool.free(buf);
    assert.equal(pool.available, 1);
  });

  it('respects maxBlocks via factory', () => {
    const pool = createMemoryPool({ blockSize: 64, maxBlocks: 1 });
    pool.allocate();
    assert.equal(pool.allocate(), null);
  });
});
