// ─── Unit Tests: json-patch ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPatch,
  applyOp,
  createPatch,
  invertPatch,
  validatePatch,
} from '../../app/modules/json-patch.js';

// ─── applyPatch – add ─────────────────────────────────────────────────────────

describe('applyPatch – add', () => {
  it('adds a new property to an object', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 1, b: 2 });
  });

  it('adds a nested property', () => {
    const result = applyPatch({ a: {} }, [{ op: 'add', path: '/a/x', value: 42 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: { x: 42 } });
  });

  it('appends to an array with "-" index', () => {
    const result = applyPatch({ arr: [1, 2, 3] }, [{ op: 'add', path: '/arr/-', value: 4 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { arr: [1, 2, 3, 4] });
  });

  it('inserts into an array at a specific index', () => {
    const result = applyPatch([1, 2, 3], [{ op: 'add', path: '/1', value: 99 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, [1, 99, 2, 3]);
  });

  it('replaces the root document when path is ""', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'add', path: '', value: { b: 2 } }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { b: 2 });
  });

  it('does not mutate the original document', () => {
    const original = { a: 1 };
    applyPatch(original, [{ op: 'add', path: '/b', value: 2 }]);
    assert.deepEqual(original, { a: 1 });
  });

  it('returns success=false when parent path does not exist', () => {
    const result = applyPatch({}, [{ op: 'add', path: '/a/b', value: 1 }]);
    assert.equal(result.success, false);
    assert.ok(typeof result.error === 'string');
  });
});

// ─── applyPatch – remove ──────────────────────────────────────────────────────

describe('applyPatch – remove', () => {
  it('removes a property from an object', () => {
    const result = applyPatch({ a: 1, b: 2 }, [{ op: 'remove', path: '/a' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { b: 2 });
  });

  it('removes an element from an array', () => {
    const result = applyPatch([10, 20, 30], [{ op: 'remove', path: '/1' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, [10, 30]);
  });

  it('removes a nested key', () => {
    const result = applyPatch({ a: { b: 1, c: 2 } }, [{ op: 'remove', path: '/a/b' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: { c: 2 } });
  });

  it('returns success=false when key does not exist', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'remove', path: '/z' }]);
    assert.equal(result.success, false);
  });

  it('returns success=false when array index is out of bounds', () => {
    const result = applyPatch([1, 2], [{ op: 'remove', path: '/5' }]);
    assert.equal(result.success, false);
  });
});

// ─── applyPatch – replace ─────────────────────────────────────────────────────

describe('applyPatch – replace', () => {
  it('replaces an existing property', () => {
    const result = applyPatch({ a: 1, b: 2 }, [{ op: 'replace', path: '/a', value: 99 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 99, b: 2 });
  });

  it('replaces an array element', () => {
    const result = applyPatch([1, 2, 3], [{ op: 'replace', path: '/1', value: 42 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, [1, 42, 3]);
  });

  it('replaces the root document when path is ""', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'replace', path: '', value: 'hello' }]);
    assert.equal(result.success, true);
    assert.equal(result.doc, 'hello');
  });

  it('returns success=false when key does not exist', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'replace', path: '/z', value: 99 }]);
    assert.equal(result.success, false);
  });
});

// ─── applyPatch – move ────────────────────────────────────────────────────────

describe('applyPatch – move', () => {
  it('moves a property within an object', () => {
    const result = applyPatch({ a: 1, b: 2 }, [{ op: 'move', from: '/a', path: '/c' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { b: 2, c: 1 });
  });

  it('moves an array element to another index', () => {
    const result = applyPatch([1, 2, 3], [{ op: 'move', from: '/0', path: '/2' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, [2, 3, 1]);
  });

  it('moves a nested value to the root', () => {
    const result = applyPatch({ a: { b: 42 } }, [{ op: 'move', from: '/a/b', path: '/x' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: {}, x: 42 });
  });

  it('returns success=false when from path does not exist', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'move', from: '/z', path: '/b' }]);
    assert.equal(result.success, false);
  });
});

// ─── applyPatch – copy ────────────────────────────────────────────────────────

describe('applyPatch – copy', () => {
  it('copies a property to a new location', () => {
    const result = applyPatch({ a: 1, b: 2 }, [{ op: 'copy', from: '/a', path: '/c' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 1, b: 2, c: 1 });
  });

  it('copy creates an independent clone', () => {
    const result = applyPatch({ a: { x: 1 } }, [{ op: 'copy', from: '/a', path: '/b' }]);
    assert.equal(result.success, true);
    const doc = result.doc;
    assert.deepEqual(doc, { a: { x: 1 }, b: { x: 1 } });
  });

  it('copies an array element to an object key', () => {
    const result = applyPatch({ arr: [10, 20, 30] }, [{ op: 'copy', from: '/arr/0', path: '/first' }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { arr: [10, 20, 30], first: 10 });
  });

  it('returns success=false when from path does not exist', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'copy', from: '/z', path: '/b' }]);
    assert.equal(result.success, false);
  });
});

// ─── applyPatch – test ────────────────────────────────────────────────────────

describe('applyPatch – test', () => {
  it('succeeds when value matches', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 1 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 1 });
  });

  it('fails when value does not match', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 999 }]);
    assert.equal(result.success, false);
    assert.ok(typeof result.error === 'string');
  });

  it('succeeds for deep equal objects', () => {
    const result = applyPatch({ a: { b: [1, 2] } }, [{ op: 'test', path: '/a', value: { b: [1, 2] } }]);
    assert.equal(result.success, true);
  });

  it('fails for structurally unequal objects', () => {
    const result = applyPatch({ a: { b: [1, 2] } }, [{ op: 'test', path: '/a', value: { b: [1, 3] } }]);
    assert.equal(result.success, false);
  });
});

// ─── applyPatch – chained operations ─────────────────────────────────────────

describe('applyPatch – chained operations', () => {
  it('applies multiple operations in sequence', () => {
    const result = applyPatch(
      { a: 1, b: 2 },
      [
        { op: 'add', path: '/c', value: 3 },
        { op: 'remove', path: '/b' },
        { op: 'replace', path: '/a', value: 10 },
      ],
    );
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 10, c: 3 });
  });

  it('stops on the first failed operation and returns error', () => {
    const result = applyPatch(
      { a: 1 },
      [
        { op: 'add', path: '/b', value: 2 },
        { op: 'remove', path: '/nonexistent' },
        { op: 'add', path: '/c', value: 3 },
      ],
    );
    assert.equal(result.success, false);
    assert.ok(typeof result.error === 'string');
  });
});

// ─── applyOp ──────────────────────────────────────────────────────────────────

describe('applyOp', () => {
  it('returns the new document', () => {
    const doc = applyOp({ a: 1 }, { op: 'add', path: '/b', value: 2 });
    assert.deepEqual(doc, { a: 1, b: 2 });
  });

  it('throws on invalid operation', () => {
    assert.throws(() => applyOp({ a: 1 }, { op: 'remove', path: '/z' }));
  });
});

// ─── JSON Pointer – tilde escape ─────────────────────────────────────────────

describe('JSON Pointer escape sequences', () => {
  it('handles ~1 as / in path', () => {
    const result = applyPatch({ 'a/b': 1 }, [{ op: 'replace', path: '/a~1b', value: 99 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { 'a/b': 99 });
  });

  it('handles ~0 as ~ in path', () => {
    const result = applyPatch({ 'a~b': 1 }, [{ op: 'replace', path: '/a~0b', value: 99 }]);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { 'a~b': 99 });
  });
});

// ─── createPatch ──────────────────────────────────────────────────────────────

describe('createPatch', () => {
  it('produces empty patch for identical documents', () => {
    const patch = createPatch({ a: 1 }, { a: 1 });
    assert.deepEqual(patch, []);
  });

  it('roundtrip: applying created patch transforms doc1 into doc2', () => {
    const doc1 = { a: 1, b: 2, c: 3 };
    const doc2 = { a: 10, b: 2, d: 4 };
    const patch = createPatch(doc1, doc2);
    const result = applyPatch(doc1, patch);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, doc2);
  });

  it('creates add op for new key', () => {
    const patch = createPatch({ a: 1 }, { a: 1, b: 2 });
    assert.ok(patch.some((op) => op.op === 'add' && op.path === '/b'));
  });

  it('creates remove op for deleted key', () => {
    const patch = createPatch({ a: 1, b: 2 }, { a: 1 });
    assert.ok(patch.some((op) => op.op === 'remove' && op.path === '/b'));
  });

  it('creates replace op for changed value', () => {
    const patch = createPatch({ a: 1 }, { a: 99 });
    assert.ok(patch.some((op) => op.op === 'replace' && op.path === '/a'));
  });

  it('handles nested object changes', () => {
    const doc1 = { a: { b: 1, c: 2 } };
    const doc2 = { a: { b: 99, d: 3 } };
    const patch = createPatch(doc1, doc2);
    const result = applyPatch(doc1, patch);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, doc2);
  });

  it('handles scalar to scalar replacement', () => {
    const patch = createPatch(42, 100);
    assert.ok(patch.length > 0);
    const result = applyPatch(42, patch);
    assert.equal(result.success, true);
    assert.equal(result.doc, 100);
  });

  it('handles null values', () => {
    const patch = createPatch({ a: null }, { a: 1 });
    const result = applyPatch({ a: null }, patch);
    assert.equal(result.success, true);
    assert.deepEqual(result.doc, { a: 1 });
  });
});

// ─── invertPatch ──────────────────────────────────────────────────────────────

describe('invertPatch', () => {
  it('inverts an add operation (inverse = remove)', () => {
    const doc = { a: 1 };
    const patch = [{ op: 'add', path: '/b', value: 2 }];
    const inv = invertPatch(patch, doc);
    const doc2 = applyPatch(doc, patch).doc;
    const restored = applyPatch(doc2, inv);
    assert.equal(restored.success, true);
    assert.deepEqual(restored.doc, doc);
  });

  it('inverts a remove operation (inverse = add)', () => {
    const doc = { a: 1, b: 2 };
    const patch = [{ op: 'remove', path: '/b' }];
    const inv = invertPatch(patch, doc);
    const doc2 = applyPatch(doc, patch).doc;
    const restored = applyPatch(doc2, inv);
    assert.equal(restored.success, true);
    assert.deepEqual(restored.doc, doc);
  });

  it('inverts a replace operation', () => {
    const doc = { a: 1 };
    const patch = [{ op: 'replace', path: '/a', value: 99 }];
    const inv = invertPatch(patch, doc);
    const doc2 = applyPatch(doc, patch).doc;
    const restored = applyPatch(doc2, inv);
    assert.equal(restored.success, true);
    assert.deepEqual(restored.doc, doc);
  });

  it('inverts a move operation (inverse = move back)', () => {
    const doc = { a: 1, b: 2 };
    const patch = [{ op: 'move', from: '/a', path: '/c' }];
    const inv = invertPatch(patch, doc);
    const doc2 = applyPatch(doc, patch).doc;
    const restored = applyPatch(doc2, inv);
    assert.equal(restored.success, true);
    assert.deepEqual(restored.doc, doc);
  });

  it('inverts a multi-op patch', () => {
    const doc = { a: 1, b: 2, c: 3 };
    const patch = [
      { op: 'add', path: '/d', value: 4 },
      { op: 'remove', path: '/c' },
      { op: 'replace', path: '/a', value: 10 },
    ];
    const inv = invertPatch(patch, doc);
    const doc2 = applyPatch(doc, patch).doc;
    const restored = applyPatch(doc2, inv);
    assert.equal(restored.success, true);
    assert.deepEqual(restored.doc, doc);
  });

  it('returns empty array for empty patch', () => {
    const inv = invertPatch([], { a: 1 });
    assert.deepEqual(inv, []);
  });
});

// ─── validatePatch ────────────────────────────────────────────────────────────

describe('validatePatch', () => {
  it('returns true for a valid patch', () => {
    assert.equal(validatePatch({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]), true);
  });

  it('returns false for an invalid patch', () => {
    assert.equal(validatePatch({ a: 1 }, [{ op: 'remove', path: '/z' }]), false);
  });

  it('returns true for empty patch', () => {
    assert.equal(validatePatch({}, []), true);
  });

  it('returns false when test op fails', () => {
    assert.equal(
      validatePatch({ a: 1 }, [{ op: 'test', path: '/a', value: 999 }]),
      false,
    );
  });

  it('returns true when test op succeeds', () => {
    assert.equal(
      validatePatch({ a: 1 }, [{ op: 'test', path: '/a', value: 1 }]),
      true,
    );
  });
});
