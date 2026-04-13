// ─── Unit Tests: Reservoir Sampling ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  reservoirSample,
  weightedReservoirSample,
  ReservoirSampler,
  createReservoirSampler,
} from '../../app/modules/reservoir-sampling.js';

// Deterministic RNG that always returns 0.5
const rng05 = () => 0.5;

// Seeded linear congruential generator for reproducible tests
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 0x100000000;
    return s / 0x100000000;
  };
}

// ─── reservoirSample ────────────────────────────────────────────────────────

describe('reservoirSample', () => {
  it('returns empty array when k <= 0', () => {
    assert.deepStrictEqual(reservoirSample([1, 2, 3], 0, rng05), []);
    assert.deepStrictEqual(reservoirSample([1, 2, 3], -1, rng05), []);
  });

  it('returns all items when k >= stream length', () => {
    const result = reservoirSample([10, 20, 30], 5, rng05);
    assert.equal(result.length, 3);
    assert.deepStrictEqual(result, [10, 20, 30]);
  });

  it('returns exactly k items from a larger stream', () => {
    const stream = Array.from({ length: 100 }, (_, i) => i);
    const result = reservoirSample(stream, 10, seededRng(42));
    assert.equal(result.length, 10);
  });

  it('produces deterministic output with fixed rng', () => {
    const stream = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = reservoirSample(stream, 3, seededRng(123));
    const b = reservoirSample(stream, 3, seededRng(123));
    assert.deepStrictEqual(a, b);
  });

  it('works with a generator iterable', () => {
    function* gen() {
      for (let i = 0; i < 50; i++) yield i;
    }
    const result = reservoirSample(gen(), 5, seededRng(99));
    assert.equal(result.length, 5);
    for (const v of result) {
      assert.ok(v >= 0 && v < 50, `value ${v} out of range`);
    }
  });

  it('returns empty array for empty stream', () => {
    assert.deepStrictEqual(reservoirSample([], 5, rng05), []);
  });
});

// ─── weightedReservoirSample ────────────────────────────────────────────────

describe('weightedReservoirSample', () => {
  it('returns empty array when k <= 0', () => {
    const items = [{ value: 'a', weight: 1 }];
    assert.deepStrictEqual(weightedReservoirSample(items, 0, rng05), []);
  });

  it('returns k items from weighted input', () => {
    const items = [
      { value: 'a', weight: 10 },
      { value: 'b', weight: 1 },
      { value: 'c', weight: 1 },
      { value: 'd', weight: 1 },
      { value: 'e', weight: 1 },
    ];
    const result = weightedReservoirSample(items, 2, seededRng(42));
    assert.equal(result.length, 2);
  });

  it('returns all items when k >= items.length', () => {
    const items = [
      { value: 'x', weight: 5 },
      { value: 'y', weight: 3 },
    ];
    const result = weightedReservoirSample(items, 10, rng05);
    assert.equal(result.length, 2);
  });

  it('produces deterministic output with fixed rng', () => {
    const items = [
      { value: 1, weight: 5 },
      { value: 2, weight: 3 },
      { value: 3, weight: 8 },
      { value: 4, weight: 1 },
    ];
    const a = weightedReservoirSample(items, 2, seededRng(77));
    const b = weightedReservoirSample(items, 2, seededRng(77));
    assert.deepStrictEqual(a, b);
  });
});

// ─── ReservoirSampler class ─────────────────────────────────────────────────

describe('ReservoirSampler', () => {
  it('fills reservoir up to k items', () => {
    const sampler = new ReservoirSampler(3, rng05);
    sampler.add('a');
    sampler.add('b');
    assert.equal(sampler.seen, 2);
    assert.deepStrictEqual(sampler.sample, ['a', 'b']);
  });

  it('maintains exactly k items after overflow', () => {
    const sampler = new ReservoirSampler(2, seededRng(42));
    for (let i = 0; i < 100; i++) sampler.add(i);
    assert.equal(sampler.sample.length, 2);
    assert.equal(sampler.seen, 100);
  });

  it('reset clears all state', () => {
    const sampler = new ReservoirSampler(5, rng05);
    for (let i = 0; i < 20; i++) sampler.add(i);
    sampler.reset();
    assert.equal(sampler.seen, 0);
    assert.deepStrictEqual(sampler.sample, []);
  });

  it('sample getter returns a copy, not the internal array', () => {
    const sampler = new ReservoirSampler(3, rng05);
    sampler.add(1);
    sampler.add(2);
    const s = sampler.sample;
    s.push(999);
    assert.equal(sampler.sample.length, 2);
  });
});

// ─── createReservoirSampler factory ─────────────────────────────────────────

describe('createReservoirSampler', () => {
  it('creates a working sampler instance', () => {
    const sampler = createReservoirSampler(3, rng05);
    assert.ok(sampler instanceof ReservoirSampler);
    sampler.add(10);
    sampler.add(20);
    sampler.add(30);
    assert.deepStrictEqual(sampler.sample, [10, 20, 30]);
  });

  it('factory and constructor produce equivalent behavior', () => {
    const rngA = seededRng(55);
    const rngB = seededRng(55);
    const a = createReservoirSampler(4, rngA);
    const b = new ReservoirSampler(4, rngB);
    for (let i = 0; i < 50; i++) {
      a.add(i);
      b.add(i);
    }
    assert.deepStrictEqual(a.sample, b.sample);
    assert.equal(a.seen, b.seen);
  });
});
