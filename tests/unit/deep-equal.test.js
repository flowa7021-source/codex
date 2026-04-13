// ─── Unit Tests: Deep Equality ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deepEqual,
  shallowEqual,
  deepCloneStructured,
  diff,
  patch,
} from '../../app/modules/deep-equal.js';

// ─── deepEqual – primitives ───────────────────────────────────────────────────

describe('deepEqual – primitives', () => {
  it('equal numbers', () => assert.equal(deepEqual(1, 1), true));
  it('unequal numbers', () => assert.equal(deepEqual(1, 2), false));
  it('NaN equals NaN', () => assert.equal(deepEqual(NaN, NaN), true));
  it('null equals null', () => assert.equal(deepEqual(null, null), true));
  it('null vs undefined', () => assert.equal(deepEqual(null, undefined), false));
  it('equal strings', () => assert.equal(deepEqual('hi', 'hi'), true));
  it('equal booleans', () => assert.equal(deepEqual(true, true), true));
  it('false vs true', () => assert.equal(deepEqual(false, true), false));
});

// ─── deepEqual – Date ─────────────────────────────────────────────────────────

describe('deepEqual – Date', () => {
  it('equal dates', () => {
    assert.equal(deepEqual(new Date('2024-01-01'), new Date('2024-01-01')), true);
  });
  it('unequal dates', () => {
    assert.equal(deepEqual(new Date('2024-01-01'), new Date('2025-01-01')), false);
  });
  it('Date vs non-Date', () => {
    assert.equal(deepEqual(new Date(0), 0), false);
  });
});

// ─── deepEqual – RegExp ───────────────────────────────────────────────────────

describe('deepEqual – RegExp', () => {
  it('equal regexps', () => {
    assert.equal(deepEqual(/abc/gi, /abc/gi), true);
  });
  it('different flags', () => {
    assert.equal(deepEqual(/abc/g, /abc/i), false);
  });
  it('different source', () => {
    assert.equal(deepEqual(/abc/, /xyz/), false);
  });
});

// ─── deepEqual – arrays ───────────────────────────────────────────────────────

describe('deepEqual – arrays', () => {
  it('equal arrays', () => assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true));
  it('different length', () => assert.equal(deepEqual([1, 2], [1, 2, 3]), false));
  it('different element', () => assert.equal(deepEqual([1, 2], [1, 3]), false));
  it('nested arrays', () => assert.equal(deepEqual([[1], [2]], [[1], [2]]), true));
  it('array vs object', () => assert.equal(deepEqual([1], { 0: 1, length: 1 }), false));
});

// ─── deepEqual – plain objects ────────────────────────────────────────────────

describe('deepEqual – plain objects', () => {
  it('equal flat objects', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });
  it('extra key in b', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);
  });
  it('different value', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });
  it('nested objects', () => {
    assert.equal(deepEqual({ x: { y: 1 } }, { x: { y: 1 } }), true);
  });
  it('nested object mismatch', () => {
    assert.equal(deepEqual({ x: { y: 1 } }, { x: { y: 2 } }), false);
  });
});

// ─── deepEqual – Map / Set ────────────────────────────────────────────────────

describe('deepEqual – Map', () => {
  it('equal maps', () => {
    assert.equal(deepEqual(new Map([['a', 1]]), new Map([['a', 1]])), true);
  });
  it('different value', () => {
    assert.equal(deepEqual(new Map([['a', 1]]), new Map([['a', 2]])), false);
  });
  it('different size', () => {
    assert.equal(deepEqual(new Map([['a', 1], ['b', 2]]), new Map([['a', 1]])), false);
  });
});

describe('deepEqual – Set', () => {
  it('equal sets', () => {
    assert.equal(deepEqual(new Set([1, 2, 3]), new Set([1, 2, 3])), true);
  });
  it('different element', () => {
    assert.equal(deepEqual(new Set([1, 2]), new Set([1, 3])), false);
  });
  it('different size', () => {
    assert.equal(deepEqual(new Set([1, 2, 3]), new Set([1, 2])), false);
  });
  it('set order independence', () => {
    assert.equal(deepEqual(new Set([3, 1, 2]), new Set([1, 2, 3])), true);
  });
});

// ─── shallowEqual ─────────────────────────────────────────────────────────────

describe('shallowEqual', () => {
  it('equal primitives', () => assert.equal(shallowEqual(42, 42), true));
  it('unequal primitives', () => assert.equal(shallowEqual(1, 2), false));

  it('equal flat objects', () => {
    assert.equal(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });

  it('nested objects are not deeply compared', () => {
    const inner = { c: 3 };
    assert.equal(shallowEqual({ a: inner }, { a: inner }), true);  // same ref
    assert.equal(shallowEqual({ a: { c: 3 } }, { a: { c: 3 } }), false); // diff refs
  });

  it('different keys', () => {
    assert.equal(shallowEqual({ a: 1 }, { b: 1 }), false);
  });

  it('equal arrays shallow', () => {
    assert.equal(shallowEqual([1, 2, 3], [1, 2, 3]), true);
  });

  it('array element by reference', () => {
    const obj = {};
    assert.equal(shallowEqual([obj], [obj]), true);
    assert.equal(shallowEqual([{}], [{}]), false);
  });

  it('different length arrays', () => {
    assert.equal(shallowEqual([1, 2], [1, 2, 3]), false);
  });

  it('null inputs', () => {
    assert.equal(shallowEqual(null, null), true);
    assert.equal(shallowEqual(null, {}), false);
  });
});

// ─── deepCloneStructured ──────────────────────────────────────────────────────

describe('deepCloneStructured', () => {
  it('clones primitives as-is', () => {
    assert.equal(deepCloneStructured(42), 42);
    assert.equal(deepCloneStructured('hello'), 'hello');
    assert.equal(deepCloneStructured(null), null);
  });

  it('clones a plain object deeply', () => {
    const original = { a: 1, b: { c: 2 } };
    const clone = deepCloneStructured(original);
    assert.deepEqual(clone, original);
    assert.notEqual(clone, original);
    assert.notEqual(clone.b, original.b);
  });

  it('clones an array deeply', () => {
    const original = [1, [2, 3], { x: 4 }];
    const clone = deepCloneStructured(original);
    assert.deepEqual(clone, original);
    assert.notEqual(clone, original);
    assert.notEqual(clone[1], original[1]);
  });

  it('clones a Date', () => {
    const d = new Date('2024-06-01');
    const clone = deepCloneStructured(d);
    assert.ok(clone instanceof Date);
    assert.equal(clone.getTime(), d.getTime());
    assert.notEqual(clone, d);
  });

  it('clones a RegExp', () => {
    const re = /hello/gi;
    const clone = deepCloneStructured(re);
    assert.ok(clone instanceof RegExp);
    assert.equal(clone.source, re.source);
    assert.equal(clone.flags, re.flags);
    assert.notEqual(clone, re);
  });

  it('clones a Map', () => {
    const m = new Map([['key', { val: 1 }]]);
    const clone = deepCloneStructured(m);
    assert.ok(clone instanceof Map);
    assert.notEqual(clone, m);
    assert.notEqual(clone.get('key'), m.get('key'));
    assert.deepEqual(clone.get('key'), m.get('key'));
  });

  it('clones a Set', () => {
    const s = new Set([1, 2, 3]);
    const clone = deepCloneStructured(s);
    assert.ok(clone instanceof Set);
    assert.notEqual(clone, s);
    assert.deepEqual([...clone], [1, 2, 3]);
  });

  it('throws on circular reference', () => {
    const obj = { a: 1 };
    obj.self = obj;
    assert.throws(() => deepCloneStructured(obj), TypeError);
  });
});

// ─── diff ─────────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('returns empty array for equal values', () => {
    assert.deepEqual(diff({ a: 1 }, { a: 1 }), []);
  });

  it('detects a changed property', () => {
    const result = diff({ a: 1 }, { a: 2 });
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'a');
    assert.equal(result[0].oldVal, 1);
    assert.equal(result[0].newVal, 2);
  });

  it('detects an added property', () => {
    const result = diff({ a: 1 }, { a: 1, b: 2 });
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'b');
    assert.equal(result[0].oldVal, undefined);
    assert.equal(result[0].newVal, 2);
  });

  it('detects a removed property', () => {
    const result = diff({ a: 1, b: 2 }, { a: 1 });
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'b');
    assert.equal(result[0].oldVal, 2);
    assert.equal(result[0].newVal, undefined);
  });

  it('uses dot notation for nested paths', () => {
    const result = diff({ x: { y: 1 } }, { x: { y: 2 } });
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'x.y');
  });

  it('uses bracket notation for array indices', () => {
    const result = diff([1, 2, 3], [1, 99, 3]);
    assert.equal(result.length, 1);
    assert.equal(result[0].path, '[1]');
    assert.equal(result[0].oldVal, 2);
    assert.equal(result[0].newVal, 99);
  });

  it('detects multiple changes', () => {
    const result = diff({ a: 1, b: 2 }, { a: 9, b: 8 });
    assert.equal(result.length, 2);
  });

  it('deeply nested diff', () => {
    const result = diff({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'a.b.c');
  });
});

// ─── patch ────────────────────────────────────────────────────────────────────

describe('patch', () => {
  it('applies a single change', () => {
    const result = patch({ a: 1, b: 2 }, [{ path: 'a', newVal: 99 }]);
    assert.deepEqual(result, { a: 99, b: 2 });
  });

  it('does not mutate the original', () => {
    const original = { a: 1 };
    patch(original, [{ path: 'a', newVal: 2 }]);
    assert.equal(original.a, 1);
  });

  it('applies nested path', () => {
    const result = patch({ x: { y: 1 } }, [{ path: 'x.y', newVal: 42 }]);
    assert.deepEqual(result, { x: { y: 42 } });
  });

  it('applies array index path', () => {
    const result = patch([1, 2, 3], [{ path: '[1]', newVal: 99 }]);
    assert.deepEqual(result, [1, 99, 3]);
  });

  it('creates intermediate objects for new paths', () => {
    const result = patch({ a: 1 }, [{ path: 'b.c', newVal: 5 }]);
    assert.equal(result.b.c, 5);
  });

  it('applies multiple diffs', () => {
    const result = patch(
      { a: 1, b: 2, c: 3 },
      [
        { path: 'a', newVal: 10 },
        { path: 'c', newVal: 30 },
      ],
    );
    assert.deepEqual(result, { a: 10, b: 2, c: 30 });
  });

  it('round-trips diff → patch', () => {
    const original = { name: 'Alice', age: 30, address: { city: 'Paris' } };
    const updated  = { name: 'Alice', age: 31, address: { city: 'Lyon'  } };
    const diffs = diff(original, updated);
    const patched = patch(original, diffs);
    assert.deepEqual(patched, updated);
  });

  it('handles empty diffs', () => {
    const original = { a: 1 };
    const result = patch(original, []);
    assert.deepEqual(result, original);
    assert.notEqual(result, original); // still a clone
  });
});
