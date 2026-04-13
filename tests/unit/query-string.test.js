// ─── Unit Tests: query-string ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parse,
  stringify,
  get,
  set,
  append,
  remove,
  merge,
  encode,
  decode,
} from '../../app/modules/query-string.js';

// ─── encode ───────────────────────────────────────────────────────────────────

describe('encode', () => {
  it('encodes a space as %20', () => {
    assert.equal(encode('hello world'), 'hello%20world');
  });

  it('encodes special characters', () => {
    const result = encode('foo=bar&baz');
    assert.ok(result.includes('%3D') || result.includes('%26'), `got: ${result}`);
  });

  it('leaves unreserved characters unencoded', () => {
    assert.equal(encode('abcABC123-_.~'), 'abcABC123-_.~');
  });

  it('encodes a forward slash', () => {
    assert.ok(encode('a/b').includes('%2F'));
  });

  it('encodes a question mark', () => {
    assert.ok(encode('a?b').includes('%3F'));
  });

  it('returns empty string for empty input', () => {
    assert.equal(encode(''), '');
  });

  it('round-trips with decode', () => {
    const original = 'hello world & "quotes"';
    assert.equal(decode(encode(original)), original);
  });

  it('encodes Unicode characters', () => {
    const result = encode('caf\u00e9');
    assert.ok(result.includes('%'), `expected percent-encoding, got "${result}"`);
    assert.equal(decode(result), 'café');
  });
});

// ─── decode ───────────────────────────────────────────────────────────────────

describe('decode', () => {
  it('decodes %20 as a space', () => {
    assert.equal(decode('hello%20world'), 'hello world');
  });

  it('decodes a + sign as a space', () => {
    assert.equal(decode('hello+world'), 'hello world');
  });

  it('decodes a percent-encoded slash', () => {
    assert.equal(decode('a%2Fb'), 'a/b');
  });

  it('returns the string unchanged when nothing to decode', () => {
    assert.equal(decode('abcABC123'), 'abcABC123');
  });

  it('returns empty string for empty input', () => {
    assert.equal(decode(''), '');
  });

  it('decodes Unicode percent-sequences', () => {
    assert.equal(decode('caf%C3%A9'), 'café');
  });

  it('round-trips with encode', () => {
    const original = 'key = value & more';
    assert.equal(decode(encode(original)), original);
  });

  it('decodes a full percent-encoded query pair', () => {
    assert.equal(decode('foo%3Dbar'), 'foo=bar');
  });
});

// ─── parse ────────────────────────────────────────────────────────────────────

describe('parse – basic key/value extraction', () => {
  it('parses a simple foo=1&bar=2 string', () => {
    const result = parse('foo=1&bar=2');
    assert.equal(result['foo'], '1');
    assert.equal(result['bar'], '2');
  });

  it('strips a leading ? before parsing', () => {
    const result = parse('?foo=1&bar=2');
    assert.equal(result['foo'], '1');
    assert.equal(result['bar'], '2');
  });

  it('returns empty object for empty string', () => {
    assert.deepEqual(parse(''), {});
  });

  it('returns empty object for bare ?', () => {
    assert.deepEqual(parse('?'), {});
  });

  it('treats a key with no = sign as an empty-string value', () => {
    const result = parse('flag');
    assert.equal(result['flag'], '');
  });

  it('collects repeated keys into an array', () => {
    const result = parse('a=1&a=2&a=3');
    assert.deepEqual(result['a'], ['1', '2', '3']);
  });

  it('decodes percent-encoded keys and values', () => {
    const result = parse('hello%20world=foo%20bar');
    assert.equal(result['hello world'], 'foo bar');
  });

  it('handles + as space in values', () => {
    const result = parse('q=hello+world');
    assert.equal(result['q'], 'hello world');
  });

  it('handles a key with an empty value', () => {
    const result = parse('empty=');
    assert.equal(result['empty'], '');
  });

  it('ignores empty segments (e.g. trailing &)', () => {
    const result = parse('a=1&&b=2&');
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
    assert.equal(Object.keys(result).length, 2);
  });
});

// ─── stringify ────────────────────────────────────────────────────────────────

describe('stringify', () => {
  it('converts a flat object to a query string', () => {
    const result = stringify({ foo: '1', bar: '2' });
    assert.ok(result.includes('foo=1'));
    assert.ok(result.includes('bar=2'));
    assert.ok(result.includes('&'));
  });

  it('converts array values to repeated pairs', () => {
    const result = stringify({ a: ['1', '2', '3'] });
    assert.equal(result, 'a=1&a=2&a=3');
  });

  it('percent-encodes keys and values with special characters', () => {
    const result = stringify({ 'hello world': 'foo bar' });
    assert.ok(result.includes('hello%20world=foo%20bar'));
  });

  it('returns empty string for empty object', () => {
    assert.equal(stringify({}), '');
  });

  it('handles a value that is an empty string', () => {
    const result = stringify({ empty: '' });
    assert.equal(result, 'empty=');
  });

  it('round-trips with parse', () => {
    const original = { foo: '1', bar: ['2', '3'] };
    const qs = stringify(original);
    const parsed = parse(qs);
    assert.deepEqual(parsed, original);
  });

  it('encodes & and = in values', () => {
    const result = stringify({ key: 'a=1&b=2' });
    assert.ok(!result.includes('a=1&b=2'), 'raw & and = should be encoded');
  });

  it('handles numeric-like string values correctly', () => {
    const result = stringify({ n: '42' });
    assert.equal(result, 'n=42');
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('get', () => {
  it('returns the value for a present key', () => {
    assert.equal(get('foo=1&bar=2', 'foo'), '1');
  });

  it('returns null for an absent key', () => {
    assert.equal(get('foo=1&bar=2', 'baz'), null);
  });

  it('returns an array when the key appears multiple times', () => {
    assert.deepEqual(get('a=1&a=2', 'a'), ['1', '2']);
  });

  it('works with a leading ? in the query string', () => {
    assert.equal(get('?key=val', 'key'), 'val');
  });

  it('returns null for an empty query string', () => {
    assert.equal(get('', 'foo'), null);
  });

  it('returns empty string for a key with no value', () => {
    assert.equal(get('flag=', 'flag'), '');
  });

  it('returns empty string for a bare flag (no =)', () => {
    assert.equal(get('flag', 'flag'), '');
  });

  it('decodes percent-encoded key names', () => {
    assert.equal(get('hello%20world=yes', 'hello world'), 'yes');
  });
});

// ─── set ──────────────────────────────────────────────────────────────────────

describe('set', () => {
  it('sets a new key-value pair', () => {
    const result = set('foo=1', 'bar', '2');
    const parsed = parse(result);
    assert.equal(parsed['foo'], '1');
    assert.equal(parsed['bar'], '2');
  });

  it('replaces an existing key', () => {
    const result = set('foo=old&bar=2', 'foo', 'new');
    const parsed = parse(result);
    assert.equal(parsed['foo'], 'new');
  });

  it('replaces all existing values for a multi-value key', () => {
    const result = set('a=1&a=2&a=3', 'a', 'only');
    const parsed = parse(result);
    assert.equal(parsed['a'], 'only');
  });

  it('works on an empty query string', () => {
    const result = set('', 'key', 'val');
    assert.equal(result, 'key=val');
  });

  it('encodes special characters in the value', () => {
    const result = set('', 'key', 'hello world');
    assert.ok(result.includes('hello%20world'));
  });

  it('preserves other keys unchanged', () => {
    const result = set('a=1&b=2&c=3', 'b', '99');
    const parsed = parse(result);
    assert.equal(parsed['a'], '1');
    assert.equal(parsed['b'], '99');
    assert.equal(parsed['c'], '3');
  });

  it('can set a key to an empty string', () => {
    const result = set('foo=old', 'foo', '');
    assert.equal(parse(result)['foo'], '');
  });

  it('round-trips: set then get returns the same value', () => {
    const qs = set('x=1', 'y', 'hello');
    assert.equal(get(qs, 'y'), 'hello');
  });
});

// ─── append ───────────────────────────────────────────────────────────────────

describe('append', () => {
  it('adds a new key when the key is absent', () => {
    const result = parse(append('foo=1', 'bar', '2'));
    assert.equal(result['foo'], '1');
    assert.equal(result['bar'], '2');
  });

  it('creates an array when appending to an existing single value', () => {
    const result = parse(append('a=1', 'a', '2'));
    assert.deepEqual(result['a'], ['1', '2']);
  });

  it('grows the array when appending to an existing multi-value key', () => {
    const result = parse(append('a=1&a=2', 'a', '3'));
    assert.deepEqual(result['a'], ['1', '2', '3']);
  });

  it('works on an empty query string', () => {
    const result = append('', 'key', 'val');
    assert.equal(parse(result)['key'], 'val');
  });

  it('does not affect other keys', () => {
    const result = parse(append('x=10&y=20', 'y', '30'));
    assert.equal(result['x'], '10');
    assert.deepEqual(result['y'], ['20', '30']);
  });

  it('appended value is accessible via get', () => {
    const qs = append('q=first', 'q', 'second');
    const val = get(qs, 'q');
    assert.ok(Array.isArray(val));
    assert.ok(val.includes('first'));
    assert.ok(val.includes('second'));
  });

  it('encodes special characters in the appended value', () => {
    const result = append('', 'k', 'a b');
    assert.ok(result.includes('a%20b'));
  });

  it('preserves existing order of keys', () => {
    const result = append('a=1&b=2', 'a', '3');
    assert.ok(result.startsWith('a=1'));
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes a present key', () => {
    const result = parse(remove('foo=1&bar=2', 'foo'));
    assert.equal(result['foo'], undefined);
    assert.equal(result['bar'], '2');
  });

  it('removes all values when the key is multi-valued', () => {
    const result = parse(remove('a=1&a=2&b=3', 'a'));
    assert.equal(result['a'], undefined);
    assert.equal(result['b'], '3');
  });

  it('returns the original string (without ?) when key is absent', () => {
    const result = remove('foo=1&bar=2', 'baz');
    assert.deepEqual(parse(result), parse('foo=1&bar=2'));
  });

  it('returns empty string when removing the only key', () => {
    const result = remove('only=key', 'only');
    assert.equal(result, '');
  });

  it('works on an empty query string without throwing', () => {
    const result = remove('', 'key');
    assert.equal(result, '');
  });

  it('removes percent-encoded key by decoded name', () => {
    const result = parse(remove('hello%20world=yes&other=no', 'hello world'));
    assert.equal(result['hello world'], undefined);
    assert.equal(result['other'], 'no');
  });

  it('does not affect other keys', () => {
    const result = parse(remove('a=1&b=2&c=3', 'b'));
    assert.equal(result['a'], '1');
    assert.equal(result['b'], undefined);
    assert.equal(result['c'], '3');
  });

  it('result is accessible correctly via get after removal', () => {
    const qs = remove('x=1&y=2', 'x');
    assert.equal(get(qs, 'x'), null);
    assert.equal(get(qs, 'y'), '2');
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('combines two non-overlapping query strings', () => {
    const result = parse(merge('a=1&b=2', 'c=3&d=4'));
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
    assert.equal(result['c'], '3');
    assert.equal(result['d'], '4');
  });

  it('overrides let values in the base with those from overrides', () => {
    const result = parse(merge('a=base&b=2', 'a=override'));
    assert.equal(result['a'], 'override');
    assert.equal(result['b'], '2');
  });

  it('handles empty base', () => {
    const result = parse(merge('', 'a=1&b=2'));
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
  });

  it('handles empty overrides', () => {
    const result = parse(merge('a=1&b=2', ''));
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
  });

  it('handles both empty strings', () => {
    assert.equal(merge('', ''), '');
  });

  it('works when overrides have leading ?', () => {
    const result = parse(merge('a=1', '?b=2'));
    assert.equal(result['a'], '1');
    assert.equal(result['b'], '2');
  });

  it('overrides multi-value key with single string from overrides', () => {
    const result = parse(merge('a=1&a=2', 'a=only'));
    assert.equal(result['a'], 'only');
  });

  it('result is a valid query string (parseable)', () => {
    const qs = merge('x=1&y=old', 'y=new&z=3');
    const parsed = parse(qs);
    assert.equal(typeof parsed, 'object');
    assert.equal(parsed['y'], 'new');
  });
});
