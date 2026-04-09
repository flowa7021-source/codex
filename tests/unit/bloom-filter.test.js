// ─── Unit Tests: bloom-filter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BloomFilter } from '../../app/modules/bloom-filter.js';

// ─── constructor defaults ─────────────────────────────────────────────────────

describe('constructor defaults', () => {
  it('bitArraySize is greater than 0 with default options', () => {
    const bf = new BloomFilter();
    assert.ok(bf.bitArraySize > 0);
  });

  it('hashCount is greater than 0 with default options', () => {
    const bf = new BloomFilter();
    assert.ok(bf.hashCount > 0);
  });

  it('bitArraySize is greater than 0 with custom options', () => {
    const bf = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.05 });
    assert.ok(bf.bitArraySize > 0);
  });

  it('hashCount is greater than 0 with custom options', () => {
    const bf = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.05 });
    assert.ok(bf.hashCount > 0);
  });

  it('uses larger bit array for lower false positive rate', () => {
    const highFp = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.1 });
    const lowFp = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.001 });
    assert.ok(lowFp.bitArraySize > highFp.bitArraySize);
  });
});

// ─── add + mightContain ───────────────────────────────────────────────────────

describe('add + mightContain', () => {
  it('always returns true for added items', () => {
    const bf = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    const words = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const w of words) bf.add(w);
    for (const w of words) {
      assert.equal(bf.mightContain(w), true, `Expected ${w} to be found`);
    }
  });

  it('returns false for clearly absent items on a fresh filter', () => {
    const bf = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.001 });
    // With a very low fp rate and empty filter, these should not be present
    assert.equal(bf.mightContain('definitely-not-added-xyz-123'), false);
  });

  it('handles adding the same item multiple times without error', () => {
    const bf = new BloomFilter();
    bf.add('repeat');
    bf.add('repeat');
    assert.equal(bf.mightContain('repeat'), true);
  });
});

// ─── false positive rate ──────────────────────────────────────────────────────

describe('false positive rate', () => {
  it('false positive rate is below 10% for configured 1% rate with 1000 items', () => {
    const bf = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.01 });

    // Add 1000 items
    for (let i = 0; i < 1000; i++) {
      bf.add(`item-${i}`);
    }

    // Test ~100 items that were never added
    let falsePositives = 0;
    const testCount = 100;
    for (let i = 10000; i < 10000 + testCount; i++) {
      if (bf.mightContain(`nonexistent-${i}`)) {
        falsePositives++;
      }
    }

    // Expect < 10% false positives (lenient bound; theoretical is ~1%)
    assert.ok(
      falsePositives < 10,
      `False positive rate too high: ${falsePositives}/${testCount}`,
    );
  });
});

// ─── approximateCount ─────────────────────────────────────────────────────────

describe('approximateCount', () => {
  it('starts at 0', () => {
    const bf = new BloomFilter();
    assert.equal(bf.approximateCount, 0);
  });

  it('roughly matches number of adds', () => {
    const bf = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.01 });
    for (let i = 0; i < 50; i++) bf.add(`word-${i}`);
    assert.equal(bf.approximateCount, 50);
  });

  it('increments even for duplicate adds', () => {
    const bf = new BloomFilter();
    bf.add('same');
    bf.add('same');
    assert.equal(bf.approximateCount, 2);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('resets the filter so previously added items are no longer found', () => {
    const bf = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.001 });
    bf.add('hello');
    bf.add('world');
    bf.clear();
    // With very low fp rate and fresh filter, these should not be found
    assert.equal(bf.mightContain('hello'), false);
    assert.equal(bf.mightContain('world'), false);
  });

  it('resets approximateCount to 0', () => {
    const bf = new BloomFilter();
    bf.add('a');
    bf.add('b');
    bf.clear();
    assert.equal(bf.approximateCount, 0);
  });

  it('allows new adds after clear', () => {
    const bf = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    bf.add('before');
    bf.clear();
    bf.add('after');
    assert.equal(bf.mightContain('after'), true);
  });
});

// ─── export / import ──────────────────────────────────────────────────────────

describe('export/import roundtrip', () => {
  it('preserves mightContain state after roundtrip', () => {
    const bf = new BloomFilter({ expectedItems: 200, falsePositiveRate: 0.01 });
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    for (const w of words) bf.add(w);

    const exported = bf.export();
    assert.equal(typeof exported, 'string');
    assert.ok(exported.length > 0);

    const bf2 = new BloomFilter();
    bf2.import(exported);

    for (const w of words) {
      assert.equal(bf2.mightContain(w), true, `Expected ${w} to be found after import`);
    }
  });

  it('preserves bitArraySize after roundtrip', () => {
    const bf = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.02 });
    bf.add('test');
    const exported = bf.export();

    const bf2 = new BloomFilter();
    bf2.import(exported);

    assert.equal(bf2.bitArraySize, bf.bitArraySize);
  });

  it('preserves hashCount after roundtrip', () => {
    const bf = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.02 });
    bf.add('test');
    const exported = bf.export();

    const bf2 = new BloomFilter();
    bf2.import(exported);

    assert.equal(bf2.hashCount, bf.hashCount);
  });

  it('preserves approximateCount after roundtrip', () => {
    const bf = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    bf.add('one');
    bf.add('two');
    bf.add('three');
    const exported = bf.export();

    const bf2 = new BloomFilter();
    bf2.import(exported);

    assert.equal(bf2.approximateCount, 3);
  });
});
