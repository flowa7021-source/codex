// ─── Unit Tests: VectorStore ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { VectorStore } from '../../app/modules/vector-store.js';

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('VectorStore – constructor', () => {
  it('creates an empty store', () => {
    const store = new VectorStore(3);
    assert.equal(store.size, 0);
    assert.deepEqual(store.ids(), []);
  });

  it('throws for non-positive dimensions', () => {
    assert.throws(() => new VectorStore(0), RangeError);
    assert.throws(() => new VectorStore(-1), RangeError);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('VectorStore – upsert', () => {
  it('adds a new entry and increments size', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    assert.equal(store.size, 1);
    assert.ok(store.ids().includes('a'));
  });

  it('updates an existing entry without changing size', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'a', vector: [0, 1] });
    assert.equal(store.size, 1);
    const entry = store.get('a');
    assert.ok(entry);
    assert.deepEqual(entry.vector, [0, 1]);
  });

  it('stores metadata alongside the vector', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'x', vector: [1, 0], metadata: { label: 'test' } });
    const entry = store.get('x');
    assert.ok(entry);
    assert.deepEqual(entry.metadata, { label: 'test' });
  });

  it('throws when vector length mismatches dimensions', () => {
    const store = new VectorStore(3);
    assert.throws(() => store.upsert({ id: 'bad', vector: [1, 2] }), RangeError);
  });

  it('stores a copy so mutations do not affect stored vector', () => {
    const store = new VectorStore(2);
    const vec = [1, 0];
    store.upsert({ id: 'a', vector: vec });
    vec[0] = 99;
    const entry = store.get('a');
    assert.ok(entry);
    assert.equal(entry.vector[0], 1);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('VectorStore – delete', () => {
  it('removes an existing entry and returns true', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    assert.equal(store.delete('a'), true);
    assert.equal(store.size, 0);
    assert.equal(store.get('a'), undefined);
  });

  it('returns false when id does not exist', () => {
    const store = new VectorStore(2);
    assert.equal(store.delete('missing'), false);
  });

  it('deleted entries are absent from ids()', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'b', vector: [0, 1] });
    store.delete('a');
    assert.ok(!store.ids().includes('a'));
    assert.ok(store.ids().includes('b'));
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('VectorStore – get', () => {
  it('returns undefined for unknown id', () => {
    const store = new VectorStore(2);
    assert.equal(store.get('ghost'), undefined);
  });

  it('returns a copy so caller mutations do not corrupt the store', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    const entry = store.get('a');
    assert.ok(entry);
    entry.vector[0] = 99;
    const entry2 = store.get('a');
    assert.ok(entry2);
    assert.equal(entry2.vector[0], 1);
  });
});

// ─── search ───────────────────────────────────────────────────────────────────

describe('VectorStore – search', () => {
  it('returns the closest entry first', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'right',  vector: [1, 0] }); // cos sim to [1,0] = 1
    store.upsert({ id: 'up',    vector: [0, 1] }); // cos sim to [1,0] = 0
    store.upsert({ id: 'diag',  vector: [1, 1] }); // cos sim to [1,0] ≈ 0.707
    const results = store.search([1, 0]);
    assert.equal(results[0].id, 'right');
    assert.ok(Math.abs(results[0].score - 1) < 1e-9);
  });

  it('limits results to k', () => {
    const store = new VectorStore(2);
    for (let i = 0; i < 10; i++) {
      store.upsert({ id: `v${i}`, vector: [i, 0] });
    }
    const results = store.search([1, 0], 3);
    assert.equal(results.length, 3);
  });

  it('returns all entries when k >= size', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'b', vector: [0, 1] });
    const results = store.search([1, 0], 100);
    assert.equal(results.length, 2);
  });

  it('returns empty array when store is empty', () => {
    const store = new VectorStore(2);
    assert.deepEqual(store.search([1, 0]), []);
  });

  it('throws when query length mismatches dimensions', () => {
    const store = new VectorStore(3);
    assert.throws(() => store.search([1, 0]), RangeError);
  });

  it('results are sorted descending by score', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'b', vector: [1, 1] });
    store.upsert({ id: 'c', vector: [0, 1] });
    const results = store.search([1, 0]);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });

  it('includes metadata in results', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0], metadata: { tag: 'hello' } });
    const results = store.search([1, 0], 1);
    assert.equal(results[0].id, 'a');
    assert.deepEqual(results[0].metadata, { tag: 'hello' });
  });
});

// ─── searchByThreshold ────────────────────────────────────────────────────────

describe('VectorStore – searchByThreshold', () => {
  it('returns only entries at or above the threshold', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'right', vector: [1, 0] }); // score = 1.0
    store.upsert({ id: 'diag',  vector: [1, 1] }); // score ≈ 0.707
    store.upsert({ id: 'up',   vector: [0, 1] }); // score = 0.0
    const results = store.searchByThreshold([1, 0], 0.8);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'right');
  });

  it('returns all entries when threshold is 0 or below', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'b', vector: [0, 1] });
    const results = store.searchByThreshold([1, 0], 0);
    assert.equal(results.length, 2);
  });

  it('returns empty array when nothing meets threshold', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    const results = store.searchByThreshold([0, 1], 0.99);
    assert.equal(results.length, 0);
  });

  it('results are sorted descending by score', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'a', vector: [1, 0] });
    store.upsert({ id: 'b', vector: [1, 1] });
    const results = store.searchByThreshold([1, 0], 0.5);
    assert.ok(results[0].score >= results[results.length - 1].score);
  });

  it('throws when query length mismatches dimensions', () => {
    const store = new VectorStore(3);
    assert.throws(() => store.searchByThreshold([1, 0], 0.5), RangeError);
  });
});

// ─── ids ──────────────────────────────────────────────────────────────────────

describe('VectorStore – ids', () => {
  it('returns all stored ids', () => {
    const store = new VectorStore(2);
    store.upsert({ id: 'x', vector: [1, 0] });
    store.upsert({ id: 'y', vector: [0, 1] });
    const ids = store.ids();
    assert.equal(ids.length, 2);
    assert.ok(ids.includes('x'));
    assert.ok(ids.includes('y'));
  });

  it('returns empty array for empty store', () => {
    const store = new VectorStore(2);
    assert.deepEqual(store.ids(), []);
  });
});
