// ─── Unit Tests: random-utils ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  randomInt,
  randomFloat,
  randomChoice,
  shuffle,
  sampleWithout,
  weightedChoice,
  randomBool,
  randomString,
  seededRandom,
} from '../../app/modules/random-utils.js';

// ─── randomInt() ─────────────────────────────────────────────────────────────

describe('randomInt()', () => {
  it('returns an integer', () => {
    for (let i = 0; i < 20; i++) {
      const n = randomInt(0, 10);
      assert.equal(Math.floor(n), n);
    }
  });

  it('result is within [min, max] inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomInt(5, 10);
      assert.ok(n >= 5 && n <= 10);
    }
  });

  it('works for negative ranges', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomInt(-10, -1);
      assert.ok(n >= -10 && n <= -1);
    }
  });

  it('returns the only possible value when min === max', () => {
    assert.equal(randomInt(7, 7), 7);
  });

  it('can produce both boundary values', () => {
    const results = new Set(Array.from({ length: 1000 }, () => randomInt(0, 1)));
    assert.ok(results.has(0));
    assert.ok(results.has(1));
  });
});

// ─── randomFloat() ───────────────────────────────────────────────────────────

describe('randomFloat()', () => {
  it('returns a number', () => {
    assert.equal(typeof randomFloat(0, 1), 'number');
  });

  it('result is within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomFloat(2.5, 5.5);
      assert.ok(n >= 2.5 && n < 5.5);
    }
  });

  it('works for negative ranges', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomFloat(-5, -1);
      assert.ok(n >= -5 && n < -1);
    }
  });

  it('returns 0 when min === max', () => {
    assert.equal(randomFloat(3, 3), 3);
  });
});

// ─── randomChoice() ──────────────────────────────────────────────────────────

describe('randomChoice()', () => {
  it('returns undefined for empty array', () => {
    assert.equal(randomChoice([]), undefined);
  });

  it('returns the only element for single-element array', () => {
    assert.equal(randomChoice([42]), 42);
  });

  it('returns an element that exists in the array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 20; i++) {
      const choice = randomChoice(arr);
      assert.ok(arr.includes(choice));
    }
  });

  it('can return any element from the array', () => {
    const arr = [1, 2, 3, 4, 5];
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(randomChoice(arr));
    }
    // Should see all 5 elements eventually
    assert.equal(seen.size, 5);
  });
});

// ─── shuffle() ───────────────────────────────────────────────────────────────

describe('shuffle()', () => {
  it('returns the same array reference', () => {
    const arr = [1, 2, 3];
    const result = shuffle(arr);
    assert.strictEqual(result, arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffle(arr);
    assert.deepEqual([...arr].sort((a, b) => a - b), copy);
  });

  it('preserves length', () => {
    const arr = [10, 20, 30, 40];
    shuffle(arr);
    assert.equal(arr.length, 4);
  });

  it('handles empty array', () => {
    const arr = [];
    shuffle(arr);
    assert.deepEqual(arr, []);
  });

  it('handles single-element array', () => {
    const arr = [99];
    shuffle(arr);
    assert.deepEqual(arr, [99]);
  });

  it('produces different orderings over many runs', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const orderings = new Set();
    for (let i = 0; i < 50; i++) {
      const arr = [...original];
      shuffle(arr);
      orderings.add(arr.join(','));
    }
    // Very unlikely all 50 shuffles are identical
    assert.ok(orderings.size > 1);
  });
});

// ─── sampleWithout() ─────────────────────────────────────────────────────────

describe('sampleWithout()', () => {
  it('returns n elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(sampleWithout(arr, 3).length, 3);
    assert.equal(sampleWithout(arr, 1).length, 1);
    assert.equal(sampleWithout(arr, 10).length, 10);
  });

  it('returns all elements when n >= arr.length', () => {
    const arr = [1, 2, 3];
    const result = sampleWithout(arr, 5);
    assert.equal(result.length, arr.length);
    assert.deepEqual([...result].sort((a, b) => a - b), arr);
  });

  it('all sampled elements come from source array', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const sample = sampleWithout(arr, 3);
    for (const item of sample) {
      assert.ok(arr.includes(item));
    }
  });

  it('returns no duplicate elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < 20; i++) {
      const sample = sampleWithout(arr, 5);
      const unique = new Set(sample);
      assert.equal(unique.size, 5);
    }
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    sampleWithout(arr, 3);
    assert.deepEqual(arr, copy);
  });

  it('returns empty array when n = 0', () => {
    assert.deepEqual(sampleWithout([1, 2, 3], 0), []);
  });
});

// ─── weightedChoice() ────────────────────────────────────────────────────────

describe('weightedChoice()', () => {
  it('returns -1 for empty weights array', () => {
    assert.equal(weightedChoice([]), -1);
  });

  it('returns 0 for single-element array', () => {
    assert.equal(weightedChoice([1]), 0);
  });

  it('returns a valid index', () => {
    const weights = [1, 2, 3, 4];
    for (let i = 0; i < 50; i++) {
      const idx = weightedChoice(weights);
      assert.ok(idx >= 0 && idx < weights.length);
    }
  });

  it('index 0 is always returned when only first weight is non-zero', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(weightedChoice([10, 0, 0, 0]), 0);
    }
  });

  it('last index is always returned when only last weight is non-zero', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(weightedChoice([0, 0, 0, 10]), 3);
    }
  });

  it('skewed weights produce skewed distribution', () => {
    // Weight index 0 heavily
    const weights = [100, 1];
    const counts = [0, 0];
    for (let i = 0; i < 500; i++) {
      counts[weightedChoice(weights)]++;
    }
    // Index 0 should be picked much more often
    assert.ok(counts[0] > counts[1] * 5);
  });
});

// ─── randomBool() ────────────────────────────────────────────────────────────

describe('randomBool()', () => {
  it('returns a boolean', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(typeof randomBool(), 'boolean');
    }
  });

  it('p=1 always returns true', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(randomBool(1), true);
    }
  });

  it('p=0 always returns false', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(randomBool(0), false);
    }
  });

  it('default p=0.5 returns both true and false over many calls', () => {
    let trueCount = 0;
    for (let i = 0; i < 200; i++) {
      if (randomBool()) trueCount++;
    }
    // With p=0.5, very unlikely to get < 50 or > 150 out of 200
    assert.ok(trueCount > 50 && trueCount < 150);
  });
});

// ─── randomString() ──────────────────────────────────────────────────────────

describe('randomString()', () => {
  it('returns a string of the correct length', () => {
    assert.equal(randomString(0).length, 0);
    assert.equal(randomString(1).length, 1);
    assert.equal(randomString(10).length, 10);
    assert.equal(randomString(100).length, 100);
  });

  it('uses only characters from the default alphabet', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const str = randomString(200);
    for (const char of str) {
      assert.ok(alphabet.includes(char), `Unexpected char: ${char}`);
    }
  });

  it('uses only characters from a custom alphabet', () => {
    const alphabet = 'abc';
    const str = randomString(50, alphabet);
    for (const char of str) {
      assert.ok(alphabet.includes(char), `Unexpected char: ${char}`);
    }
  });

  it('can produce all characters in the alphabet', () => {
    const alphabet = 'ABCD';
    const str = randomString(200, alphabet);
    const seen = new Set([...str]);
    // Should see all 4 chars in 200 iterations
    assert.equal(seen.size, 4);
  });

  it('produces different strings on repeated calls', () => {
    const strs = new Set(Array.from({ length: 10 }, () => randomString(16)));
    assert.ok(strs.size > 1);
  });
});

// ─── seededRandom() ──────────────────────────────────────────────────────────

describe('seededRandom()', () => {
  it('returns a function', () => {
    assert.equal(typeof seededRandom(42), 'function');
  });

  it('returned function produces values in [0, 1)', () => {
    const rng = seededRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `Value ${v} out of range`);
    }
  });

  it('is deterministic: same seed produces same sequence', () => {
    const rng1 = seededRandom(99);
    const rng2 = seededRandom(99);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = seededRandom(1);
    const rng2 = seededRandom(2);
    let allEqual = true;
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) {
        allEqual = false;
        break;
      }
    }
    assert.ok(!allEqual);
  });

  it('produces a sequence, not the same value repeatedly', () => {
    const rng = seededRandom(0);
    const values = Array.from({ length: 10 }, () => rng());
    const unique = new Set(values);
    assert.ok(unique.size > 1);
  });
});
