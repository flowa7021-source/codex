// ─── Unit Tests: immutable-record ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ImmutableRecord, record } from '../../app/modules/immutable-record.js';

// ─── constructor / toObject ───────────────────────────────────────────────────

describe('ImmutableRecord – constructor and toObject', () => {
  it('stores the initial data', () => {
    const r = new ImmutableRecord({ name: 'Alice', age: 30 });
    assert.deepEqual(r.toObject(), { name: 'Alice', age: 30 });
  });

  it('toObject returns a plain copy, not the internal frozen object', () => {
    const r = record({ x: 1 });
    const obj = r.toObject();
    obj.x = 99;
    assert.equal(r.get('x'), 1, 'mutating the copy must not affect the record');
  });

  it('constructor does not retain a reference to the original object', () => {
    const src = { a: 1, b: 2 };
    const r = record(src);
    src.a = 99;
    assert.equal(r.get('a'), 1, 'mutating the source must not affect the record');
  });

  it('works with numeric, boolean, and null field values', () => {
    const r = record({ n: 42, flag: false, nothing: null });
    assert.equal(r.get('n'), 42);
    assert.equal(r.get('flag'), false);
    assert.equal(r.get('nothing'), null);
  });

  it('works with nested objects as values', () => {
    const r = record({ point: { x: 1, y: 2 } });
    assert.deepEqual(r.get('point'), { x: 1, y: 2 });
  });

  it('factory record() produces an ImmutableRecord instance', () => {
    const r = record({ key: 'value' });
    assert.ok(r instanceof ImmutableRecord);
  });

  it('toObject on an empty record returns {}', () => {
    const r = record({});
    assert.deepEqual(r.toObject(), {});
  });

  it('handles string values with special characters', () => {
    const r = record({ msg: 'hello\nworld', tab: '\t' });
    assert.equal(r.get('msg'), 'hello\nworld');
  });
});

// ─── get / has / keys ────────────────────────────────────────────────────────

describe('ImmutableRecord – get, has, keys', () => {
  it('get returns the correct value for a known key', () => {
    const r = record({ foo: 'bar', baz: 42 });
    assert.equal(r.get('foo'), 'bar');
    assert.equal(r.get('baz'), 42);
  });

  it('has returns true for existing keys', () => {
    const r = record({ a: 1, b: 2 });
    assert.ok(r.has('a'));
    assert.ok(r.has('b'));
  });

  it('has returns false for non-existent keys', () => {
    const r = record({ a: 1 });
    assert.equal(r.has('z'), false);
    assert.equal(r.has(''), false);
  });

  it('keys returns all field names', () => {
    const r = record({ x: 10, y: 20, z: 30 });
    assert.deepEqual(r.keys().sort(), ['x', 'y', 'z']);
  });

  it('keys returns empty array for an empty record', () => {
    const r = record({});
    assert.deepEqual(r.keys(), []);
  });

  it('has returns false for inherited prototype properties', () => {
    const r = record({ a: 1 });
    assert.equal(r.has('toString'), false);
    assert.equal(r.has('constructor'), false);
  });

  it('get returns undefined for missing keys without throwing', () => {
    const r = record({ a: 1 });
    // @ts-ignore — intentional wrong key for test
    assert.equal(r.get('missing'), undefined);
  });

  it('keys count matches toObject key count', () => {
    const data = { p: 1, q: 2, r: 3, s: 4 };
    const rec = record(data);
    assert.equal(rec.keys().length, Object.keys(data).length);
  });
});

// ─── set ─────────────────────────────────────────────────────────────────────

describe('ImmutableRecord – set', () => {
  it('returns a new record with the updated value', () => {
    const r1 = record({ name: 'Alice', age: 30 });
    const r2 = r1.set('age', 31);
    assert.equal(r2.get('age'), 31);
  });

  it('original is unchanged after set', () => {
    const r1 = record({ name: 'Alice', age: 30 });
    r1.set('age', 99);
    assert.equal(r1.get('age'), 30, 'original record must not be mutated');
  });

  it('other fields are preserved after set', () => {
    const r1 = record({ name: 'Alice', age: 30, city: 'NY' });
    const r2 = r1.set('age', 31);
    assert.equal(r2.get('name'), 'Alice');
    assert.equal(r2.get('city'), 'NY');
  });

  it('set returns a new ImmutableRecord instance', () => {
    const r1 = record({ a: 1 });
    const r2 = r1.set('a', 2);
    assert.ok(r2 instanceof ImmutableRecord);
    assert.notEqual(r1, r2);
  });

  it('chained sets are each independent', () => {
    const base = record({ val: 0 });
    const r1 = base.set('val', 1);
    const r2 = base.set('val', 2);
    assert.equal(base.get('val'), 0);
    assert.equal(r1.get('val'), 1);
    assert.equal(r2.get('val'), 2);
  });

  it('set with the same value still returns a new instance', () => {
    const r1 = record({ a: 1 });
    const r2 = r1.set('a', 1);
    assert.notEqual(r1, r2);
    assert.equal(r2.get('a'), 1);
  });

  it('setting a field to null is allowed', () => {
    const r1 = record({ label: 'hello' });
    const r2 = r1.set('label', null);
    assert.equal(r2.get('label'), null);
  });

  it('deep chain of sets preserves intermediate records', () => {
    const r0 = record({ counter: 0 });
    const r1 = r0.set('counter', 1);
    const r2 = r1.set('counter', 2);
    assert.equal(r0.get('counter'), 0);
    assert.equal(r1.get('counter'), 1);
    assert.equal(r2.get('counter'), 2);
  });
});

// ─── update / merge ───────────────────────────────────────────────────────────

describe('ImmutableRecord – update and merge', () => {
  it('update merges partial changes into a new record', () => {
    const r1 = record({ a: 1, b: 2, c: 3 });
    const r2 = r1.update({ b: 20, c: 30 });
    assert.deepEqual(r2.toObject(), { a: 1, b: 20, c: 30 });
  });

  it('original is unchanged after update', () => {
    const r1 = record({ a: 1, b: 2 });
    r1.update({ a: 99 });
    assert.equal(r1.get('a'), 1);
  });

  it('update with empty partial returns equivalent record', () => {
    const r1 = record({ x: 5 });
    const r2 = r1.update({});
    assert.deepEqual(r2.toObject(), r1.toObject());
  });

  it('merge is an alias for update', () => {
    const r1 = record({ a: 1, b: 2 });
    const r2 = r1.merge({ b: 99 });
    assert.equal(r2.get('b'), 99);
    assert.equal(r1.get('b'), 2, 'original must not be mutated');
  });

  it('merge preserves unmentioned fields', () => {
    const r1 = record({ x: 1, y: 2, z: 3 });
    const r2 = r1.merge({ y: 20 });
    assert.equal(r2.get('x'), 1);
    assert.equal(r2.get('z'), 3);
  });

  it('update returns a new ImmutableRecord instance', () => {
    const r1 = record({ a: 1 });
    const r2 = r1.update({ a: 2 });
    assert.ok(r2 instanceof ImmutableRecord);
    assert.notEqual(r1, r2);
  });

  it('merge does not affect the source partial object', () => {
    const partial = { b: 10 };
    const r1 = record({ a: 1, b: 2 });
    r1.merge(partial);
    assert.equal(partial.b, 10, 'partial object passed to merge must not change');
  });

  it('multiple merges from the same base are independent', () => {
    const base = record({ v: 0 });
    const r1 = base.merge({ v: 1 });
    const r2 = base.merge({ v: 2 });
    assert.equal(base.get('v'), 0);
    assert.equal(r1.get('v'), 1);
    assert.equal(r2.get('v'), 2);
  });
});

// ─── equals ───────────────────────────────────────────────────────────────────

describe('ImmutableRecord – equals', () => {
  it('returns true for two records with the same data', () => {
    const r1 = record({ a: 1, b: 'hello' });
    const r2 = record({ a: 1, b: 'hello' });
    assert.ok(r1.equals(r2));
  });

  it('returns false when field values differ', () => {
    const r1 = record({ a: 1 });
    const r2 = record({ a: 2 });
    assert.equal(r1.equals(r2), false);
  });

  it('returns false when one has an extra key', () => {
    const r1 = record({ a: 1 });
    const r2 = record({ a: 1, b: 2 });
    // @ts-ignore — intentional type mismatch for test
    assert.equal(r1.equals(r2), false);
  });

  it('a record equals itself', () => {
    const r = record({ x: 42 });
    assert.ok(r.equals(r));
  });

  it('equals is symmetric', () => {
    const r1 = record({ a: 1 });
    const r2 = record({ a: 1 });
    assert.equal(r1.equals(r2), r2.equals(r1));
  });

  it('deep-equals nested objects', () => {
    const r1 = record({ pt: { x: 1, y: 2 } });
    const r2 = record({ pt: { x: 1, y: 2 } });
    assert.ok(r1.equals(r2));
  });

  it('returns false when nested objects differ', () => {
    const r1 = record({ pt: { x: 1, y: 2 } });
    const r2 = record({ pt: { x: 1, y: 3 } });
    assert.equal(r1.equals(r2), false);
  });

  it('set followed by set-back gives an equal record', () => {
    const r1 = record({ a: 5 });
    const r2 = r1.set('a', 99).set('a', 5);
    assert.ok(r1.equals(r2));
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('ImmutableRecord – delete', () => {
  it('returns a new record without the deleted key', () => {
    const r1 = record({ a: 1, b: 2, c: 3 });
    const r2 = r1.delete('b');
    assert.equal(r2.has('b'), false);
  });

  it('original is unchanged after delete', () => {
    const r1 = record({ a: 1, b: 2 });
    r1.delete('a');
    assert.ok(r1.has('a'), 'original must still have the deleted key');
  });

  it('remaining fields are preserved after delete', () => {
    const r1 = record({ a: 1, b: 2, c: 3 });
    const r2 = r1.delete('b');
    assert.equal(r2.get('a'), 1);
    assert.equal(r2.get('c'), 3);
  });

  it('delete returns an ImmutableRecord instance', () => {
    const r1 = record({ x: 1 });
    const r2 = r1.delete('x');
    assert.ok(r2 instanceof ImmutableRecord);
  });

  it('deleting a key reduces the key count by one', () => {
    const r1 = record({ a: 1, b: 2, c: 3 });
    const r2 = r1.delete('c');
    assert.equal(r2.keys().length, 2);
  });

  it('deleted record toObject does not contain the removed key', () => {
    const r1 = record({ x: 10, y: 20 });
    const r2 = r1.delete('x');
    assert.deepEqual(r2.toObject(), { y: 20 });
  });

  it('chained deletes each produce independent records', () => {
    const r = record({ a: 1, b: 2, c: 3 });
    const r2 = r.delete('a');
    const r3 = r2.delete('b');
    assert.ok(r.has('a'));
    assert.ok(r2.has('a') === false && r2.has('b'));
    assert.ok(r3.has('b') === false && r3.has('c'));
  });

  it('deleting from an empty record (via two deletes) leaves no keys', () => {
    const r1 = record({ only: 'one' });
    const r2 = r1.delete('only');
    assert.deepEqual(r2.keys(), []);
  });
});
