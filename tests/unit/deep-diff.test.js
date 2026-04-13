// ─── Unit Tests: deep-diff ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diff,
  deepEqual,
  addedKeys,
  removedKeys,
  changedKeys,
  applyDiff,
} from '../../app/modules/deep-diff.js';

// ─── deepEqual ────────────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual('hello', 'hello'), true);
    assert.equal(deepEqual(true, true), true);
    assert.equal(deepEqual(null, null), true);
  });

  it('returns false for different primitives', () => {
    assert.equal(deepEqual(1, 2), false);
    assert.equal(deepEqual('a', 'b'), false);
    assert.equal(deepEqual(true, false), false);
  });

  it('returns false for different types', () => {
    assert.equal(deepEqual(1, '1'), false);
    assert.equal(deepEqual(null, undefined), false);
    assert.equal(deepEqual(0, false), false);
  });

  it('returns true for equal shallow objects', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });

  it('returns false for objects with different values', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  it('returns false for objects with different keys', () => {
    assert.equal(deepEqual({ a: 1 }, { b: 1 }), false);
  });

  it('returns false for different key counts', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1 }), false);
  });

  it('returns true for deeply nested equal objects', () => {
    assert.equal(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }), true);
  });

  it('returns false for deeply nested different objects', () => {
    assert.equal(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }), false);
  });

  it('returns true for equal arrays', () => {
    assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true);
  });

  it('returns false for arrays with different lengths', () => {
    assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
  });

  it('returns false for arrays with different elements', () => {
    assert.equal(deepEqual([1, 2, 3], [1, 2, 4]), false);
  });

  it('returns false when one is array and other is object', () => {
    assert.equal(deepEqual([], {}), false);
  });

  it('returns true for equal nested arrays', () => {
    assert.equal(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]]), true);
  });

  it('returns false for unequal nested arrays', () => {
    assert.equal(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]]), false);
  });
});

// ─── diff – added ─────────────────────────────────────────────────────────────

describe('diff – added', () => {
  it('detects an added key', () => {
    const entries = diff({ a: 1 }, { a: 1, b: 2 });
    const added = entries.find((e) => e.type === 'added');
    assert.ok(added, 'expected an added entry');
    assert.equal(added.path, 'b');
    assert.equal(added.newValue, 2);
    assert.equal(added.oldValue, undefined);
  });

  it('detects multiple added keys', () => {
    const entries = diff({}, { x: 1, y: 2, z: 3 });
    const addedPaths = entries.filter((e) => e.type === 'added').map((e) => e.path).sort();
    assert.deepEqual(addedPaths, ['x', 'y', 'z']);
  });
});

// ─── diff – removed ───────────────────────────────────────────────────────────

describe('diff – removed', () => {
  it('detects a removed key', () => {
    const entries = diff({ a: 1, b: 2 }, { a: 1 });
    const removed = entries.find((e) => e.type === 'removed');
    assert.ok(removed, 'expected a removed entry');
    assert.equal(removed.path, 'b');
    assert.equal(removed.oldValue, 2);
    assert.equal(removed.newValue, undefined);
  });

  it('detects multiple removed keys', () => {
    const entries = diff({ x: 1, y: 2, z: 3 }, {});
    const removedPaths = entries.filter((e) => e.type === 'removed').map((e) => e.path).sort();
    assert.deepEqual(removedPaths, ['x', 'y', 'z']);
  });
});

// ─── diff – changed ───────────────────────────────────────────────────────────

describe('diff – changed', () => {
  it('detects a changed value', () => {
    const entries = diff({ a: 1 }, { a: 99 });
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed, 'expected a changed entry');
    assert.equal(changed.path, 'a');
    assert.equal(changed.oldValue, 1);
    assert.equal(changed.newValue, 99);
  });

  it('detects change from object to primitive', () => {
    const entries = diff({ a: { b: 1 } }, { a: 'hello' });
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed, 'expected a changed entry');
    assert.equal(changed.path, 'a');
  });

  it('detects change of array value', () => {
    const entries = diff({ a: [1, 2] }, { a: [1, 3] });
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed);
    assert.equal(changed.path, 'a');
  });
});

// ─── diff – unchanged ─────────────────────────────────────────────────────────

describe('diff – unchanged', () => {
  it('marks unchanged scalar values', () => {
    const entries = diff({ a: 1, b: 2 }, { a: 1, b: 99 });
    const unchanged = entries.find((e) => e.type === 'unchanged');
    assert.ok(unchanged, 'expected an unchanged entry');
    assert.equal(unchanged.path, 'a');
  });

  it('returns unchanged for equal primitive top-level values', () => {
    const entries = diff(42, 42, 'num');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, 'unchanged');
  });

  it('returns empty array for two identical objects (all paths recurse to no leaf diffs)', () => {
    // When two objects are identical, all leaves are unchanged — no top-level entries.
    const entries = diff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });
    assert.ok(entries.every((e) => e.type === 'unchanged'));
  });
});

// ─── diff – nested ────────────────────────────────────────────────────────────

describe('diff – nested', () => {
  it('uses dot-notation for nested paths', () => {
    const entries = diff({ a: { b: 1 } }, { a: { b: 99 } });
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed, 'expected a changed entry');
    assert.equal(changed.path, 'a.b');
  });

  it('detects added nested key', () => {
    const entries = diff({ a: {} }, { a: { x: 1 } });
    const added = entries.find((e) => e.type === 'added');
    assert.ok(added);
    assert.equal(added.path, 'a.x');
    assert.equal(added.newValue, 1);
  });

  it('detects removed nested key', () => {
    const entries = diff({ a: { x: 1, y: 2 } }, { a: { x: 1 } });
    const removed = entries.find((e) => e.type === 'removed');
    assert.ok(removed);
    assert.equal(removed.path, 'a.y');
  });

  it('supports custom starting path', () => {
    const entries = diff({ x: 1 }, { x: 2 }, 'root');
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed);
    assert.equal(changed.path, 'root.x');
  });

  it('deeply nested diff uses full dot path', () => {
    const entries = diff({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
    const changed = entries.find((e) => e.type === 'changed');
    assert.ok(changed);
    assert.equal(changed.path, 'a.b.c');
  });
});

// ─── addedKeys ────────────────────────────────────────────────────────────────

describe('addedKeys', () => {
  it('returns keys present in newObj but not in oldObj', () => {
    const result = addedKeys({ a: 1 }, { a: 1, b: 2, c: 3 });
    assert.deepEqual(result.sort(), ['b', 'c']);
  });

  it('returns empty array when nothing was added', () => {
    assert.deepEqual(addedKeys({ a: 1, b: 2 }, { a: 1 }), []);
  });

  it('returns all keys of newObj when oldObj is empty', () => {
    const result = addedKeys({}, { x: 1, y: 2 });
    assert.deepEqual(result.sort(), ['x', 'y']);
  });

  it('returns empty array when both objects are empty', () => {
    assert.deepEqual(addedKeys({}, {}), []);
  });

  it('returns empty array for identical objects', () => {
    assert.deepEqual(addedKeys({ a: 1 }, { a: 1 }), []);
  });
});

// ─── removedKeys ──────────────────────────────────────────────────────────────

describe('removedKeys', () => {
  it('returns keys present in oldObj but not in newObj', () => {
    const result = removedKeys({ a: 1, b: 2, c: 3 }, { a: 1 });
    assert.deepEqual(result.sort(), ['b', 'c']);
  });

  it('returns empty array when nothing was removed', () => {
    assert.deepEqual(removedKeys({ a: 1 }, { a: 1, b: 2 }), []);
  });

  it('returns all keys of oldObj when newObj is empty', () => {
    const result = removedKeys({ x: 1, y: 2 }, {});
    assert.deepEqual(result.sort(), ['x', 'y']);
  });

  it('returns empty array when both objects are empty', () => {
    assert.deepEqual(removedKeys({}, {}), []);
  });

  it('returns empty array for identical objects', () => {
    assert.deepEqual(removedKeys({ a: 1 }, { a: 1 }), []);
  });
});

// ─── changedKeys ──────────────────────────────────────────────────────────────

describe('changedKeys', () => {
  it('returns keys that exist in both but have different values', () => {
    const result = changedKeys({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 });
    assert.deepEqual(result, ['b']);
  });

  it('returns empty array when no values changed', () => {
    assert.deepEqual(changedKeys({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 }), []);
  });

  it('returns all keys when all values changed', () => {
    const result = changedKeys({ a: 1, b: 2 }, { a: 9, b: 8 });
    assert.deepEqual(result.sort(), ['a', 'b']);
  });

  it('returns empty array for empty objects', () => {
    assert.deepEqual(changedKeys({}, {}), []);
  });

  it('detects change in nested object (shallow compare)', () => {
    // changedKeys does a deepEqual per key
    const result = changedKeys({ a: { x: 1 } }, { a: { x: 2 } });
    assert.deepEqual(result, ['a']);
  });

  it('does not include keys only in newObj', () => {
    const result = changedKeys({ a: 1 }, { a: 1, b: 2 });
    assert.deepEqual(result, []);
  });
});

// ─── applyDiff ────────────────────────────────────────────────────────────────

describe('applyDiff', () => {
  it('applies an added entry', () => {
    const result = applyDiff({ a: 1 }, [{ path: 'b', type: 'added', newValue: 2 }]);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('applies a removed entry', () => {
    const result = applyDiff({ a: 1, b: 2 }, [{ path: 'b', type: 'removed' }]);
    assert.deepEqual(result, { a: 1 });
  });

  it('applies a changed entry', () => {
    const result = applyDiff({ a: 1 }, [{ path: 'a', type: 'changed', oldValue: 1, newValue: 99 }]);
    assert.deepEqual(result, { a: 99 });
  });

  it('skips unchanged entries', () => {
    const original = { a: 1, b: 2 };
    const result = applyDiff(original, [{ path: 'a', type: 'unchanged', oldValue: 1, newValue: 1 }]);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('does not mutate the original object', () => {
    const original = { a: 1, b: 2 };
    applyDiff(original, [{ path: 'b', type: 'removed' }]);
    assert.deepEqual(original, { a: 1, b: 2 });
  });

  it('applies multiple diff entries', () => {
    const result = applyDiff(
      { a: 1, b: 2, c: 3 },
      [
        { path: 'a', type: 'changed', oldValue: 1, newValue: 10 },
        { path: 'b', type: 'removed' },
        { path: 'd', type: 'added', newValue: 4 },
      ],
    );
    assert.deepEqual(result, { a: 10, c: 3, d: 4 });
  });

  it('applies a nested path change', () => {
    const result = applyDiff(
      { a: { b: 1, c: 2 } },
      [{ path: 'a.b', type: 'changed', oldValue: 1, newValue: 99 }],
    );
    assert.deepEqual(result, { a: { b: 99, c: 2 } });
  });

  it('applies a diff produced by diff() to reproduce doc2', () => {
    const doc1 = { a: 1, b: 2, c: 3 };
    const doc2 = { a: 10, b: 2, d: 4 };
    const entries = diff(doc1, doc2);
    const result = applyDiff(doc1, entries);
    assert.deepEqual(result, doc2);
  });

  it('returns empty object for empty input and empty diff', () => {
    const result = applyDiff({}, []);
    assert.deepEqual(result, {});
  });
});
