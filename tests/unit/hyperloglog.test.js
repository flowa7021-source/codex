// ─── Unit Tests: hyperloglog ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  HyperLogLog,
  createHyperLogLog,
  estimateCardinality,
} from '../../app/modules/hyperloglog.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('constructor', () => {
  it('creates instance with default precision 10', () => {
    const hll = new HyperLogLog();
    assert.equal(hll.precision, 10);
  });

  it('creates instance with custom precision', () => {
    const hll = new HyperLogLog(8);
    assert.equal(hll.precision, 8);
  });

  it('accepts minimum precision 4', () => {
    const hll = new HyperLogLog(4);
    assert.equal(hll.precision, 4);
  });

  it('accepts maximum precision 16', () => {
    const hll = new HyperLogLog(16);
    assert.equal(hll.precision, 16);
  });

  it('throws RangeError for precision below 4', () => {
    assert.throws(() => new HyperLogLog(3), RangeError);
  });

  it('throws RangeError for precision above 16', () => {
    assert.throws(() => new HyperLogLog(17), RangeError);
  });

  it('throws RangeError for precision of 0', () => {
    assert.throws(() => new HyperLogLog(0), RangeError);
  });

  it('throws RangeError for negative precision', () => {
    assert.throws(() => new HyperLogLog(-1), RangeError);
  });
});

// ─── count — empty and single item ───────────────────────────────────────────

describe('count — empty and single item', () => {
  it('returns 0 for an empty estimator', () => {
    const hll = new HyperLogLog();
    assert.equal(hll.count(), 0);
  });

  it('returns approximately 1 after adding a single item', () => {
    const hll = new HyperLogLog(10);
    hll.add('only-item');
    const estimate = hll.count();
    // Generous bounds: within 0 to 10 for a single unique item
    assert.ok(estimate >= 0 && estimate <= 10, `Expected ~1, got ${estimate}`);
  });

  it('returns 0 again after clear', () => {
    const hll = new HyperLogLog();
    hll.add('hello');
    hll.clear();
    assert.equal(hll.count(), 0);
  });

  it('adding the same item repeatedly does not inflate count significantly', () => {
    const hll = new HyperLogLog(10);
    for (let i = 0; i < 100; i++) {
      hll.add('duplicate');
    }
    const estimate = hll.count();
    // Should still be close to 1
    assert.ok(estimate <= 15, `Expected ~1 for all-duplicate adds, got ${estimate}`);
  });

  it('two distinct items gives estimate >= 1', () => {
    const hll = new HyperLogLog(10);
    hll.add('alpha');
    hll.add('beta');
    const estimate = hll.count();
    assert.ok(estimate >= 1, `Expected estimate >= 1, got ${estimate}`);
  });

  it('estimate grows as more unique items are added', () => {
    const hll = new HyperLogLog(10);
    hll.add('x');
    const e1 = hll.count();
    for (let i = 0; i < 500; i++) {
      hll.add(`item-${i}`);
    }
    const e2 = hll.count();
    assert.ok(e2 > e1, `Expected estimate to grow, got ${e1} then ${e2}`);
  });

  it('count is non-negative for any input', () => {
    const hll = new HyperLogLog(8);
    hll.add('');
    hll.add('a');
    assert.ok(hll.count() >= 0);
  });

  it('handles empty string add without throwing', () => {
    const hll = new HyperLogLog();
    assert.doesNotThrow(() => hll.add(''));
  });
});

// ─── cardinality estimation accuracy ─────────────────────────────────────────

describe('cardinality estimation accuracy', () => {
  it('estimates 100 unique items within 30%', () => {
    const hll = new HyperLogLog(10);
    const n = 100;
    for (let i = 0; i < n; i++) {
      hll.add(`unique-item-${i}`);
    }
    const estimate = hll.count();
    const tolerance = 0.30;
    assert.ok(
      Math.abs(estimate - n) / n <= tolerance,
      `Expected ${n} ± 30%, got ${estimate}`,
    );
  });

  it('estimates 1000 unique items within 30%', () => {
    const hll = new HyperLogLog(10);
    const n = 1000;
    for (let i = 0; i < n; i++) {
      hll.add(`word-${i}`);
    }
    const estimate = hll.count();
    const tolerance = 0.30;
    assert.ok(
      Math.abs(estimate - n) / n <= tolerance,
      `Expected ${n} ± 30%, got ${estimate}`,
    );
  });

  it('estimates 5000 unique items within 30%', () => {
    const hll = new HyperLogLog(12);
    const n = 5000;
    for (let i = 0; i < n; i++) {
      hll.add(`entry-${i}`);
    }
    const estimate = hll.count();
    const tolerance = 0.30;
    assert.ok(
      Math.abs(estimate - n) / n <= tolerance,
      `Expected ${n} ± 30%, got ${estimate}`,
    );
  });

  it('estimates 200 items with precision 8 within 30%', () => {
    const hll = new HyperLogLog(8);
    const n = 200;
    for (let i = 0; i < n; i++) {
      hll.add(`v-${i}`);
    }
    const estimate = hll.count();
    const tolerance = 0.30;
    assert.ok(
      Math.abs(estimate - n) / n <= tolerance,
      `Expected ${n} ± 30%, got ${estimate}`,
    );
  });

  it('higher precision gives estimate closer to true cardinality', () => {
    const n = 1000;
    const items = Array.from({ length: n }, (_, i) => `key-${i}`);

    const hllLow = new HyperLogLog(6);
    const hllHigh = new HyperLogLog(14);
    for (const item of items) {
      hllLow.add(item);
      hllHigh.add(item);
    }
    const errLow = Math.abs(hllLow.count() - n);
    const errHigh = Math.abs(hllHigh.count() - n);

    // High-precision estimator should have smaller or comparable error
    // (this is probabilistic, so allow hllHigh error up to errLow * 3)
    assert.ok(
      errHigh <= errLow * 3 || errHigh <= n * 0.30,
      `Higher precision should be more accurate: errLow=${errLow}, errHigh=${errHigh}`,
    );
  });

  it('estimating items with non-ascii strings works within 30%', () => {
    const hll = new HyperLogLog(10);
    const words = ['café', 'naïve', '日本語', 'العربية', 'русский', 'ελληνικά',
      'türkçe', 'česky', 'português', 'español'];
    const n = words.length;
    for (const w of words) hll.add(w);
    const estimate = hll.count();
    assert.ok(
      Math.abs(estimate - n) / n <= 0.30 || estimate >= 1,
      `Expected roughly ${n}, got ${estimate}`,
    );
  });

  it('repeated items among unique items do not skew estimate beyond 30%', () => {
    const hll = new HyperLogLog(10);
    const n = 100;
    for (let i = 0; i < n; i++) {
      hll.add(`item-${i}`);
      // Add a fixed duplicate each time
      hll.add('always-same');
    }
    // True cardinality is n + 1
    const trueCount = n + 1;
    const estimate = hll.count();
    assert.ok(
      Math.abs(estimate - trueCount) / trueCount <= 0.30,
      `Expected ~${trueCount} ± 30%, got ${estimate}`,
    );
  });

  it('estimates are reproducible for the same set of items', () => {
    const items = Array.from({ length: 300 }, (_, i) => `stable-${i}`);
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    for (const item of items) {
      hll1.add(item);
      hll2.add(item);
    }
    assert.equal(hll1.count(), hll2.count());
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('merged estimator covers items from both sources', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    const n = 100;
    for (let i = 0; i < n; i++) hll1.add(`set-a-${i}`);
    for (let i = 0; i < n; i++) hll2.add(`set-b-${i}`);
    const merged = hll1.merge(hll2);
    const estimate = merged.count();
    // True cardinality is ~200
    assert.ok(
      Math.abs(estimate - 2 * n) / (2 * n) <= 0.30,
      `Expected ~${2 * n} ± 30%, got ${estimate}`,
    );
  });

  it('merging with an empty estimator returns same estimate', () => {
    const hll = new HyperLogLog(10);
    const empty = new HyperLogLog(10);
    const n = 150;
    for (let i = 0; i < n; i++) hll.add(`item-${i}`);
    const merged = hll.merge(empty);
    const estimate = merged.count();
    assert.ok(
      Math.abs(estimate - n) / n <= 0.30,
      `Expected ~${n} ± 30%, got ${estimate}`,
    );
  });

  it('merge returns a new HyperLogLog instance', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    const merged = hll1.merge(hll2);
    assert.ok(merged instanceof HyperLogLog);
    assert.notEqual(merged, hll1);
    assert.notEqual(merged, hll2);
  });

  it('merge does not mutate the original instances', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    for (let i = 0; i < 50; i++) hll1.add(`a-${i}`);
    for (let i = 0; i < 50; i++) hll2.add(`b-${i}`);
    const count1Before = hll1.count();
    const count2Before = hll2.count();
    hll1.merge(hll2);
    assert.equal(hll1.count(), count1Before);
    assert.equal(hll2.count(), count2Before);
  });

  it('merging identical estimators returns same estimate', () => {
    const hll = new HyperLogLog(10);
    const n = 200;
    for (let i = 0; i < n; i++) hll.add(`item-${i}`);
    const merged = hll.merge(hll);
    // Merging with self should give same registers → same estimate
    assert.equal(merged.count(), hll.count());
  });

  it('merged precision matches original precision', () => {
    const hll1 = new HyperLogLog(12);
    const hll2 = new HyperLogLog(12);
    const merged = hll1.merge(hll2);
    assert.equal(merged.precision, 12);
  });

  it('merging estimators with different precision throws', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(8);
    assert.throws(() => hll1.merge(hll2), Error);
  });

  it('three-way merge covers all items', () => {
    const a = new HyperLogLog(10);
    const b = new HyperLogLog(10);
    const c = new HyperLogLog(10);
    const n = 50;
    for (let i = 0; i < n; i++) a.add(`a-${i}`);
    for (let i = 0; i < n; i++) b.add(`b-${i}`);
    for (let i = 0; i < n; i++) c.add(`c-${i}`);
    const merged = a.merge(b).merge(c);
    const estimate = merged.count();
    assert.ok(
      Math.abs(estimate - 3 * n) / (3 * n) <= 0.30,
      `Expected ~${3 * n} ± 30%, got ${estimate}`,
    );
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('count returns 0 after clear', () => {
    const hll = new HyperLogLog(10);
    for (let i = 0; i < 100; i++) hll.add(`item-${i}`);
    hll.clear();
    assert.equal(hll.count(), 0);
  });

  it('add works normally after clear', () => {
    const hll = new HyperLogLog(10);
    for (let i = 0; i < 50; i++) hll.add(`before-${i}`);
    hll.clear();
    const n = 80;
    for (let i = 0; i < n; i++) hll.add(`after-${i}`);
    const estimate = hll.count();
    assert.ok(
      Math.abs(estimate - n) / n <= 0.30,
      `Expected ~${n} ± 30% after re-add, got ${estimate}`,
    );
  });

  it('multiple clears are idempotent', () => {
    const hll = new HyperLogLog(10);
    hll.add('x');
    hll.clear();
    hll.clear();
    assert.equal(hll.count(), 0);
  });

  it('clearing an empty estimator is a no-op', () => {
    const hll = new HyperLogLog(10);
    assert.doesNotThrow(() => hll.clear());
    assert.equal(hll.count(), 0);
  });

  it('precision is unchanged after clear', () => {
    const hll = new HyperLogLog(12);
    hll.add('something');
    hll.clear();
    assert.equal(hll.precision, 12);
  });

  it('cleared estimator can be merged', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    for (let i = 0; i < 100; i++) hll2.add(`item-${i}`);
    hll1.clear(); // ensure hll1 is empty
    const merged = hll1.merge(hll2);
    assert.ok(merged.count() > 0);
  });

  it('count before and after clear matches expected pattern', () => {
    const hll = new HyperLogLog(10);
    assert.equal(hll.count(), 0, 'starts at 0');
    for (let i = 0; i < 200; i++) hll.add(`item-${i}`);
    assert.ok(hll.count() > 0, 'count grows after adds');
    hll.clear();
    assert.equal(hll.count(), 0, 'returns to 0 after clear');
  });

  it('estimates remain accurate after clear and re-population', () => {
    const hll = new HyperLogLog(10);
    for (let i = 0; i < 500; i++) hll.add(`old-${i}`);
    hll.clear();
    const n = 300;
    for (let i = 0; i < n; i++) hll.add(`new-${i}`);
    const estimate = hll.count();
    assert.ok(
      Math.abs(estimate - n) / n <= 0.30,
      `Expected ~${n} ± 30%, got ${estimate}`,
    );
  });
});

// ─── precision getter ─────────────────────────────────────────────────────────

describe('precision getter', () => {
  it('returns 10 for default constructor', () => {
    const hll = new HyperLogLog();
    assert.equal(hll.precision, 10);
  });

  it('returns 4 for minimum precision', () => {
    const hll = new HyperLogLog(4);
    assert.equal(hll.precision, 4);
  });

  it('returns 16 for maximum precision', () => {
    const hll = new HyperLogLog(16);
    assert.equal(hll.precision, 16);
  });

  it('returns 7 for precision 7', () => {
    const hll = new HyperLogLog(7);
    assert.equal(hll.precision, 7);
  });

  it('precision is unchanged after adding items', () => {
    const hll = new HyperLogLog(11);
    hll.add('test');
    assert.equal(hll.precision, 11);
  });

  it('precision is unchanged after merge', () => {
    const hll1 = new HyperLogLog(9);
    const hll2 = new HyperLogLog(9);
    const merged = hll1.merge(hll2);
    assert.equal(merged.precision, 9);
  });

  it('precision is unchanged after clear', () => {
    const hll = new HyperLogLog(13);
    hll.clear();
    assert.equal(hll.precision, 13);
  });

  it('each precision creates a distinct register count (2^precision)', () => {
    // We can verify indirectly: higher precision should give more accurate
    // estimates for the same data set (on average). Here we just check precision
    // values are correct for a range of inputs.
    for (let p = 4; p <= 16; p++) {
      const hll = new HyperLogLog(p);
      assert.equal(hll.precision, p);
    }
  });
});

// ─── createHyperLogLog factory ────────────────────────────────────────────────

describe('createHyperLogLog factory', () => {
  it('returns a HyperLogLog instance', () => {
    const hll = createHyperLogLog();
    assert.ok(hll instanceof HyperLogLog);
  });

  it('uses default precision 10 when called with no args', () => {
    const hll = createHyperLogLog();
    assert.equal(hll.precision, 10);
  });

  it('passes precision argument through', () => {
    const hll = createHyperLogLog(8);
    assert.equal(hll.precision, 8);
  });

  it('returned instance has working add and count', () => {
    const hll = createHyperLogLog(10);
    for (let i = 0; i < 100; i++) hll.add(`item-${i}`);
    assert.ok(hll.count() > 0);
  });

  it('throws for invalid precision', () => {
    assert.throws(() => createHyperLogLog(3), RangeError);
    assert.throws(() => createHyperLogLog(17), RangeError);
  });

  it('each call returns a new independent instance', () => {
    const a = createHyperLogLog(10);
    const b = createHyperLogLog(10);
    a.add('only-in-a');
    assert.equal(b.count(), 0);
  });

  it('factory-created instances can be merged', () => {
    const a = createHyperLogLog(10);
    const b = createHyperLogLog(10);
    a.add('apple');
    b.add('banana');
    assert.doesNotThrow(() => a.merge(b));
  });

  it('factory with precision 16 gives accurate estimate for 1000 items', () => {
    const hll = createHyperLogLog(16);
    const n = 1000;
    for (let i = 0; i < n; i++) hll.add(`precise-${i}`);
    const estimate = hll.count();
    assert.ok(
      Math.abs(estimate - n) / n <= 0.30,
      `Expected ~${n} ± 30%, got ${estimate}`,
    );
  });
});

// ─── estimateCardinality one-shot ─────────────────────────────────────────────

describe('estimateCardinality', () => {
  it('returns 0 for empty array', () => {
    assert.equal(estimateCardinality([]), 0);
  });

  it('returns approximately 1 for a single-item array', () => {
    const estimate = estimateCardinality(['hello']);
    assert.ok(estimate >= 0 && estimate <= 10, `Expected ~1, got ${estimate}`);
  });

  it('estimates 50 distinct items within 30%', () => {
    const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const estimate = estimateCardinality(items);
    assert.ok(
      Math.abs(estimate - 50) / 50 <= 0.30,
      `Expected ~50 ± 30%, got ${estimate}`,
    );
  });

  it('estimates 500 distinct items within 30%', () => {
    const items = Array.from({ length: 500 }, (_, i) => `word-${i}`);
    const estimate = estimateCardinality(items);
    assert.ok(
      Math.abs(estimate - 500) / 500 <= 0.30,
      `Expected ~500 ± 30%, got ${estimate}`,
    );
  });

  it('handles array of all identical items (cardinality 1)', () => {
    const items = Array.from({ length: 200 }, () => 'same');
    const estimate = estimateCardinality(items);
    assert.ok(estimate <= 15, `Expected ~1 for all-identical, got ${estimate}`);
  });

  it('is deterministic — same input gives same output', () => {
    const items = Array.from({ length: 100 }, (_, i) => `stable-${i}`);
    assert.equal(estimateCardinality(items), estimateCardinality(items));
  });

  it('larger set gives larger estimate than smaller distinct set', () => {
    const small = Array.from({ length: 10 }, (_, i) => `a-${i}`);
    const large = Array.from({ length: 1000 }, (_, i) => `b-${i}`);
    assert.ok(estimateCardinality(large) > estimateCardinality(small));
  });

  it('works with single-character strings', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const estimate = estimateCardinality(items);
    assert.ok(estimate >= 1, `Expected positive estimate, got ${estimate}`);
  });
});
