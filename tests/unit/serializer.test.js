// ─── Unit Tests: serializer ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  serialize,
  deserialize,
  serializeExtended,
  deserializeExtended,
  serializeKV,
  deserializeKV,
  packNumbers,
  unpackNumbers,
  msgpack,
  msgunpack,
  diff,
  patch,
} from '../../app/modules/serializer.js';

// ─── serialize ────────────────────────────────────────────────────────────────

describe('serialize', () => {
  it('serializes a number to its JSON representation', () => {
    assert.equal(serialize(42), '42');
  });

  it('serializes a string', () => {
    assert.equal(serialize('hello'), '"hello"');
  });

  it('serializes null', () => {
    assert.equal(serialize(null), 'null');
  });

  it('serializes a boolean true', () => {
    assert.equal(serialize(true), 'true');
  });

  it('serializes a plain object without indentation by default', () => {
    assert.equal(serialize({ a: 1, b: 2 }), '{"a":1,"b":2}');
  });

  it('serializes an array', () => {
    assert.equal(serialize([1, 2, 3]), '[1,2,3]');
  });

  it('pretty-prints when pretty:true', () => {
    const result = serialize({ x: 1 }, { pretty: true });
    assert.equal(result, '{\n  "x": 1\n}');
  });

  it('respects a custom indent value', () => {
    const result = serialize({ x: 1 }, { pretty: true, indent: 4 });
    assert.equal(result, '{\n    "x": 1\n}');
  });

  it('applies a custom replacer', () => {
    const result = serialize(
      { a: 1, secret: 'pw' },
      { replacer: (key, val) => (key === 'secret' ? '[REDACTED]' : val) },
    );
    const parsed = JSON.parse(result);
    assert.equal(parsed.secret, '[REDACTED]');
    assert.equal(parsed.a, 1);
  });

  it('replacer receiving empty key gets the root value', () => {
    // The root call from JSON.stringify has key === ''
    let rootSeen = false;
    serialize({ a: 1 }, { replacer: (key, val) => { if (key === '') rootSeen = true; return val; } });
    assert.equal(rootSeen, true);
  });
});

// ─── deserialize ─────────────────────────────────────────────────────────────

describe('deserialize', () => {
  it('parses a number', () => {
    assert.equal(deserialize('42'), 42);
  });

  it('parses a plain object', () => {
    assert.deepEqual(deserialize('{"a":1}'), { a: 1 });
  });

  it('parses null', () => {
    assert.equal(deserialize('null'), null);
  });

  it('parses an array', () => {
    assert.deepEqual(deserialize('[1,2,3]'), [1, 2, 3]);
  });

  it('throws SyntaxError on invalid JSON', () => {
    assert.throws(() => deserialize('not json'), SyntaxError);
  });

  it('roundtrips a nested object', () => {
    const obj = { a: { b: { c: 'deep' } } };
    assert.deepEqual(deserialize(serialize(obj)), obj);
  });
});

// ─── serializeExtended / deserializeExtended ─────────────────────────────────

describe('serializeExtended – Date', () => {
  it('encodes a Date as a type-tagged object', () => {
    const d = new Date('2024-03-15T10:00:00.000Z');
    const json = serializeExtended({ d });
    const raw = JSON.parse(json);
    assert.equal(raw.d.__type, 'Date');
    assert.equal(raw.d.value, '2024-03-15T10:00:00.000Z');
  });

  it('roundtrips a Date value', () => {
    const d = new Date('2024-03-15T10:00:00.000Z');
    const result = deserializeExtended(serializeExtended({ d }));
    assert.ok(result.d instanceof Date);
    assert.equal(result.d.toISOString(), d.toISOString());
  });
});

describe('serializeExtended – Map', () => {
  it('encodes a Map with __type tag', () => {
    const m = new Map([['k', 'v']]);
    const raw = JSON.parse(serializeExtended({ m }));
    assert.equal(raw.m.__type, 'Map');
  });

  it('roundtrips a Map with string keys and values', () => {
    const m = new Map([['foo', 'bar'], ['baz', 'qux']]);
    const result = deserializeExtended(serializeExtended({ m }));
    assert.ok(result.m instanceof Map);
    assert.equal(result.m.get('foo'), 'bar');
    assert.equal(result.m.size, 2);
  });
});

describe('serializeExtended – Set', () => {
  it('encodes a Set with __type tag', () => {
    const s = new Set([1, 2, 3]);
    const raw = JSON.parse(serializeExtended({ s }));
    assert.equal(raw.s.__type, 'Set');
  });

  it('roundtrips a Set of numbers', () => {
    const s = new Set([10, 20, 30]);
    const result = deserializeExtended(serializeExtended({ s }));
    assert.ok(result.s instanceof Set);
    assert.ok(result.s.has(20));
    assert.equal(result.s.size, 3);
  });
});

describe('serializeExtended – Uint8Array', () => {
  it('encodes a Uint8Array with __type tag', () => {
    const arr = new Uint8Array([1, 2, 3]);
    const raw = JSON.parse(serializeExtended({ arr }));
    assert.equal(raw.arr.__type, 'Uint8Array');
  });

  it('roundtrips a Uint8Array', () => {
    const arr = new Uint8Array([5, 10, 15, 200]);
    const result = deserializeExtended(serializeExtended({ arr }));
    assert.ok(result.arr instanceof Uint8Array);
    assert.equal(result.arr[0], 5);
    assert.equal(result.arr[3], 200);
  });
});

describe('serializeExtended – undefined and BigInt', () => {
  it('roundtrips top-level undefined', () => {
    const result = deserializeExtended(serializeExtended(undefined));
    assert.equal(result, undefined);
  });

  it('roundtrips undefined inside an object property', () => {
    const result = deserializeExtended(serializeExtended({ x: undefined }));
    assert.equal(result.x, undefined);
  });

  it('roundtrips a BigInt value', () => {
    const big = BigInt('9007199254740993');
    const result = deserializeExtended(serializeExtended({ big }));
    assert.equal(typeof result.big, 'bigint');
    assert.equal(result.big, big);
  });

  it('stores BigInt as a string in the JSON', () => {
    const raw = JSON.parse(serializeExtended({ n: BigInt(42) }));
    assert.equal(raw.n.__type, 'BigInt');
    assert.equal(typeof raw.n.value, 'string');
  });
});

// ─── serializeKV / deserializeKV ─────────────────────────────────────────────

describe('serializeKV', () => {
  it('produces key=value lines', () => {
    const result = serializeKV({ a: 1, b: 'hello', c: true });
    assert.equal(result, 'a=1\nb=hello\nc=true');
  });

  it('handles a single entry', () => {
    assert.equal(serializeKV({ x: 42 }), 'x=42');
  });

  it('handles an empty object', () => {
    assert.equal(serializeKV({}), '');
  });

  it('converts boolean false to "false"', () => {
    assert.equal(serializeKV({ flag: false }), 'flag=false');
  });

  it('converts number 0 to "0"', () => {
    assert.equal(serializeKV({ n: 0 }), 'n=0');
  });
});

describe('deserializeKV', () => {
  it('parses a multi-line kv string', () => {
    const result = deserializeKV('a=1\nb=hello\nc=true');
    assert.deepEqual(result, { a: '1', b: 'hello', c: 'true' });
  });

  it('ignores lines without an equals sign', () => {
    const result = deserializeKV('valid=yes\nbadline\nother=ok');
    assert.ok(!('badline' in result));
    assert.equal(result.valid, 'yes');
  });

  it('handles values that contain equals signs', () => {
    const result = deserializeKV('url=http://example.com?a=1&b=2');
    assert.equal(result.url, 'http://example.com?a=1&b=2');
  });

  it('returns empty object for empty string', () => {
    assert.deepEqual(deserializeKV(''), {});
  });

  it('roundtrips a kv object', () => {
    const obj = { name: 'nova', version: '4', enabled: 'true' };
    const result = deserializeKV(serializeKV({ name: 'nova', version: 4, enabled: true }));
    assert.deepEqual(result, obj);
  });
});

// ─── packNumbers / unpackNumbers ──────────────────────────────────────────────

describe('packNumbers / unpackNumbers', () => {
  it('roundtrips an array of integers', () => {
    const nums = [1, 2, 3, 100, 255];
    assert.deepEqual(unpackNumbers(packNumbers(nums)), nums);
  });

  it('roundtrips an array containing floats', () => {
    const nums = [Math.PI, Math.E, 1.23456789, -0.5];
    const result = unpackNumbers(packNumbers(nums));
    for (let i = 0; i < nums.length; i++) {
      assert.equal(result[i], nums[i]);
    }
  });

  it('roundtrips special float values', () => {
    const nums = [Infinity, -Infinity, NaN, 0, -0];
    const result = unpackNumbers(packNumbers(nums));
    assert.equal(result[0], Infinity);
    assert.equal(result[1], -Infinity);
    assert.ok(Number.isNaN(result[2]));
    assert.equal(result[3], 0);
  });

  it('roundtrips an empty array', () => {
    assert.deepEqual(unpackNumbers(packNumbers([])), []);
  });

  it('produces a non-empty base64 string for a non-empty array', () => {
    const packed = packNumbers([1, 2, 3]);
    assert.equal(typeof packed, 'string');
    assert.ok(packed.length > 0);
  });

  it('packed string length grows with input length', () => {
    const short = packNumbers([1]);
    const long = packNumbers([1, 2, 3, 4, 5]);
    assert.ok(long.length > short.length);
  });
});

// ─── msgpack / msgunpack ──────────────────────────────────────────────────────

describe('msgpack / msgunpack – primitives', () => {
  it('roundtrips null', () => {
    assert.equal(msgunpack(msgpack(null)), null);
  });

  it('roundtrips undefined', () => {
    assert.equal(msgunpack(msgpack(undefined)), undefined);
  });

  it('roundtrips boolean true', () => {
    assert.equal(msgunpack(msgpack(true)), true);
  });

  it('roundtrips boolean false', () => {
    assert.equal(msgunpack(msgpack(false)), false);
  });

  it('roundtrips a positive integer', () => {
    assert.equal(msgunpack(msgpack(42)), 42);
  });

  it('roundtrips a negative float', () => {
    assert.equal(msgunpack(msgpack(-3.14)), -3.14);
  });

  it('roundtrips a string', () => {
    assert.equal(msgunpack(msgpack('hello world')), 'hello world');
  });

  it('roundtrips an empty string', () => {
    assert.equal(msgunpack(msgpack('')), '');
  });

  it('roundtrips a BigInt', () => {
    const big = BigInt('12345678901234567890');
    assert.equal(msgunpack(msgpack(big)), big);
  });
});

describe('msgpack / msgunpack – complex types', () => {
  it('roundtrips a plain array', () => {
    assert.deepEqual(msgunpack(msgpack([1, 'two', true, null])), [1, 'two', true, null]);
  });

  it('roundtrips a plain object', () => {
    const obj = { x: 1, y: 'hello', z: false };
    assert.deepEqual(msgunpack(msgpack(obj)), obj);
  });

  it('roundtrips a nested object', () => {
    const obj = { a: { b: { c: 42 } } };
    assert.deepEqual(msgunpack(msgpack(obj)), obj);
  });

  it('roundtrips a Date', () => {
    const d = new Date('2025-01-20T08:30:00.000Z');
    const result = msgunpack(msgpack(d));
    assert.ok(result instanceof Date);
    assert.equal(result.getTime(), d.getTime());
  });

  it('roundtrips a Uint8Array', () => {
    const arr = new Uint8Array([10, 20, 30, 255]);
    const result = msgunpack(msgpack(arr));
    assert.ok(result instanceof Uint8Array);
    assert.equal(result[0], 10);
    assert.equal(result[3], 255);
  });

  it('produces a base64 string', () => {
    const encoded = msgpack({ key: 'value' });
    assert.equal(typeof encoded, 'string');
    assert.match(encoded, /^[A-Za-z0-9+/]+=*$/);
  });

  it('roundtrips an array of mixed types', () => {
    const arr = [null, undefined, 0, '', false, { nested: true }];
    const result = msgunpack(msgpack(arr));
    assert.equal(result[0], null);
    assert.equal(result[1], undefined);
    assert.equal(result[2], 0);
    assert.equal(result[3], '');
    assert.equal(result[4], false);
    assert.deepEqual(result[5], { nested: true });
  });
});

// ─── diff ─────────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('detects added keys', () => {
    const result = diff({ a: 1 }, { a: 1, b: 2 });
    assert.deepEqual(result.added, { b: 2 });
    assert.deepEqual(result.removed, {});
    assert.deepEqual(result.changed, {});
  });

  it('detects removed keys', () => {
    const result = diff({ a: 1, b: 2 }, { a: 1 });
    assert.deepEqual(result.removed, { b: 2 });
    assert.deepEqual(result.added, {});
    assert.deepEqual(result.changed, {});
  });

  it('detects changed values', () => {
    const result = diff({ a: 1, b: 'old' }, { a: 1, b: 'new' });
    assert.deepEqual(result.changed, { b: { from: 'old', to: 'new' } });
    assert.deepEqual(result.added, {});
    assert.deepEqual(result.removed, {});
  });

  it('returns all empty buckets when objects are equal', () => {
    const result = diff({ x: 1, y: 2 }, { x: 1, y: 2 });
    assert.deepEqual(result.added, {});
    assert.deepEqual(result.removed, {});
    assert.deepEqual(result.changed, {});
  });

  it('compares nested objects by value not by reference', () => {
    const a = { obj: { inner: 1 } };
    const b = { obj: { inner: 1 } };
    const result = diff(a, b);
    assert.deepEqual(result.changed, {});
  });

  it('detects nested object value changes', () => {
    const a = { obj: { inner: 1 } };
    const b = { obj: { inner: 2 } };
    const result = diff(a, b);
    assert.ok('obj' in result.changed);
    assert.deepEqual(result.changed.obj.from, { inner: 1 });
    assert.deepEqual(result.changed.obj.to, { inner: 2 });
  });

  it('handles add + remove + change simultaneously', () => {
    const orig = { keep: 1, remove: 2, change: 'old' };
    const mod = { keep: 1, add: 99, change: 'new' };
    const result = diff(orig, mod);
    assert.deepEqual(result.added, { add: 99 });
    assert.deepEqual(result.removed, { remove: 2 });
    assert.equal(result.changed.change.from, 'old');
    assert.equal(result.changed.change.to, 'new');
  });

  it('works on empty objects', () => {
    const result = diff({}, {});
    assert.deepEqual(result, { added: {}, removed: {}, changed: {} });
  });
});

// ─── patch ────────────────────────────────────────────────────────────────────

describe('patch', () => {
  it('applies added keys', () => {
    const result = patch({ a: 1 }, { added: { b: 2 } });
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  it('removes keys listed in removed', () => {
    const result = patch({ a: 1, b: 2 }, { removed: { b: 2 } });
    assert.equal(result.a, 1);
    assert.ok(!('b' in result));
  });

  it('updates values listed in changed', () => {
    const result = patch({ a: 1, b: 'old' }, { changed: { b: { from: 'old', to: 'new' } } });
    assert.equal(result.b, 'new');
  });

  it('does not mutate the original object', () => {
    const original = { a: 1, b: 2 };
    patch(original, { removed: { a: 1 } });
    assert.equal(original.a, 1);
  });

  it('applies a full diff produced by diff()', () => {
    const orig = { keep: 1, remove: 2, change: 'old' };
    const mod = { keep: 1, add: 99, change: 'new' };
    const d = diff(orig, mod);
    const result = patch(orig, d);
    assert.deepEqual(result, mod);
  });

  it('accepts a diff with only added', () => {
    const result = patch({ x: 1 }, { added: { y: 2 } });
    assert.deepEqual(result, { x: 1, y: 2 });
  });

  it('accepts a diff with no fields (no-op)', () => {
    const original = { a: 1 };
    const result = patch(original, {});
    assert.deepEqual(result, { a: 1 });
  });

  it('patch then diff roundtrip is idempotent', () => {
    const orig = { a: 1, b: 2 };
    const mod = { a: 1, b: 99, c: 3 };
    const d = diff(orig, mod);
    const patched = patch(orig, d);
    assert.deepEqual(patched, mod);
    // Second diff should show no changes
    const d2 = diff(patched, mod);
    assert.deepEqual(d2, { added: {}, removed: {}, changed: {} });
  });
});
