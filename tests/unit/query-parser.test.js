// ─── Unit Tests: query-parser ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseQuery,
  stringifyQuery,
  getQueryValue,
  hasQueryKey,
  mergeQuery,
  omitQuery,
  pickQuery,
} from '../../app/modules/query-parser.js';

// ─── parseQuery ───────────────────────────────────────────────────────────────

describe('parseQuery', () => {
  it('parses simple key=value pairs', () => {
    assert.deepEqual(parseQuery('a=1&b=2'), { a: '1', b: '2' });
  });

  it('parses array params with key[]', () => {
    const result = parseQuery('tag[]=foo&tag[]=bar');
    assert.deepEqual(result, { tag: ['foo', 'bar'] });
  });

  it('returns empty object for empty string', () => {
    assert.deepEqual(parseQuery(''), {});
  });

  it('strips leading ? from query string', () => {
    assert.deepEqual(parseQuery('?x=1'), { x: '1' });
  });

  it('decodes percent-encoded values', () => {
    assert.deepEqual(parseQuery('name=hello%20world'), { name: 'hello world' });
  });

  it('handles a param with no value', () => {
    const result = parseQuery('foo=');
    assert.equal(result['foo'], '');
  });
});

// ─── stringifyQuery ───────────────────────────────────────────────────────────

describe('stringifyQuery', () => {
  it('stringifies basic key-value pairs', () => {
    const result = stringifyQuery({ a: '1', b: '2' });
    assert.ok(result.includes('a=1'));
    assert.ok(result.includes('b=2'));
  });

  it('stringifies array values with key[]', () => {
    const result = stringifyQuery({ tag: ['foo', 'bar'] });
    assert.ok(result.includes('tag%5B%5D=foo'));
    assert.ok(result.includes('tag%5B%5D=bar'));
  });

  it('skips null values', () => {
    const result = stringifyQuery({ a: '1', b: null });
    assert.ok(!result.includes('b='));
    assert.ok(result.includes('a=1'));
  });

  it('skips undefined values', () => {
    const result = stringifyQuery({ a: '1', b: undefined });
    assert.ok(!result.includes('b='));
  });

  it('stringifies boolean values', () => {
    const result = stringifyQuery({ active: true, archived: false });
    assert.ok(result.includes('active=true'));
    assert.ok(result.includes('archived=false'));
  });

  it('stringifies number values', () => {
    const result = stringifyQuery({ page: 3 });
    assert.ok(result.includes('page=3'));
  });

  it('returns empty string for empty object', () => {
    assert.equal(stringifyQuery({}), '');
  });
});

// ─── getQueryValue ────────────────────────────────────────────────────────────

describe('getQueryValue', () => {
  it('returns the value for an existing key', () => {
    assert.equal(getQueryValue({ foo: 'bar' }, 'foo'), 'bar');
  });

  it('returns null for a missing key', () => {
    assert.equal(getQueryValue({ foo: 'bar' }, 'baz'), null);
  });

  it('returns the first value when the key is an array', () => {
    assert.equal(getQueryValue({ tag: ['a', 'b', 'c'] }, 'tag'), 'a');
  });

  it('returns null for an empty array value', () => {
    assert.equal(getQueryValue({ tag: [] }, 'tag'), null);
  });
});

// ─── hasQueryKey ──────────────────────────────────────────────────────────────

describe('hasQueryKey', () => {
  it('returns true for an existing key', () => {
    assert.equal(hasQueryKey({ foo: 'bar' }, 'foo'), true);
  });

  it('returns false for a missing key', () => {
    assert.equal(hasQueryKey({ foo: 'bar' }, 'baz'), false);
  });

  it('returns true for a key with array value', () => {
    assert.equal(hasQueryKey({ tag: ['a', 'b'] }, 'tag'), true);
  });

  it('returns false for empty object', () => {
    assert.equal(hasQueryKey({}, 'anything'), false);
  });
});

// ─── mergeQuery ───────────────────────────────────────────────────────────────

describe('mergeQuery', () => {
  it('b overrides a for shared keys', () => {
    const result = mergeQuery({ x: '1', y: '2' }, { x: '99' });
    assert.equal(result['x'], '99');
    assert.equal(result['y'], '2');
  });

  it('adds new keys from b that are not in a', () => {
    const result = mergeQuery({ a: '1' }, { b: '2' });
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
  });

  it('returns a copy of a when b is empty', () => {
    const a = { a: '1', b: '2' };
    const result = mergeQuery(a, {});
    assert.deepEqual(result, a);
    assert.notEqual(result, a); // must be a new object
  });

  it('handles array values in b overriding string values in a', () => {
    const result = mergeQuery({ tag: 'x' }, { tag: ['y', 'z'] });
    assert.deepEqual(result['tag'], ['y', 'z']);
  });
});

// ─── omitQuery ────────────────────────────────────────────────────────────────

describe('omitQuery', () => {
  it('removes specified keys', () => {
    const result = omitQuery({ a: '1', b: '2', c: '3' }, ['a', 'c']);
    assert.deepEqual(result, { b: '2' });
  });

  it('returns a copy with all keys when none match', () => {
    const params = { a: '1', b: '2' };
    const result = omitQuery(params, ['x', 'y']);
    assert.deepEqual(result, params);
    assert.notEqual(result, params);
  });

  it('returns empty object when all keys are omitted', () => {
    const result = omitQuery({ a: '1' }, ['a']);
    assert.deepEqual(result, {});
  });

  it('does not mutate the original object', () => {
    const params = { a: '1', b: '2' };
    omitQuery(params, ['a']);
    assert.equal(params['a'], '1');
  });
});

// ─── pickQuery ────────────────────────────────────────────────────────────────

describe('pickQuery', () => {
  it('keeps only the specified keys', () => {
    const result = pickQuery({ a: '1', b: '2', c: '3' }, ['a', 'c']);
    assert.deepEqual(result, { a: '1', c: '3' });
  });

  it('returns empty object when no keys match', () => {
    const result = pickQuery({ a: '1', b: '2' }, ['x', 'y']);
    assert.deepEqual(result, {});
  });

  it('returns copy of full object when all keys are picked', () => {
    const params = { a: '1', b: '2' };
    const result = pickQuery(params, ['a', 'b']);
    assert.deepEqual(result, params);
    assert.notEqual(result, params);
  });

  it('does not mutate the original object', () => {
    const params = { a: '1', b: '2' };
    pickQuery(params, ['a']);
    assert.equal(params['b'], '2');
  });
});
