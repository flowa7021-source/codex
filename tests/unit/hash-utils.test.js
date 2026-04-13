// ─── Unit Tests: hash-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  djb2,
  sdbm,
  fnv1a32,
  murmur3,
  djb2Bytes,
  fnv1a32Bytes,
  adler32,
  fletcher16,
  hashCode,
  simpleHash,
  consistentHash,
  RollingHash,
  multiHash,
} from '../../app/modules/hash-utils.js';

// ─── djb2() ──────────────────────────────────────────────────────────────────

describe('djb2()', () => {
  it('returns 5381 for empty string (seed value)', () => {
    assert.equal(djb2(''), 5381);
  });

  it('matches known value for "hello"', () => {
    assert.equal(djb2('hello'), 0xa9cede7);
  });

  it('matches known value for "abc"', () => {
    assert.equal(djb2('abc'), 0xb873285);
  });

  it('is deterministic', () => {
    assert.equal(djb2('hello world'), djb2('hello world'));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = djb2('test');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('avalanche: "hello" and "Hello" produce different hashes', () => {
    assert.notEqual(djb2('hello'), djb2('Hello'));
  });

  it('avalanche: similar strings differ', () => {
    assert.notEqual(djb2('hello'), djb2('helo'));
    assert.notEqual(djb2('abc'), djb2('abd'));
  });

  it('handles single character', () => {
    const v = djb2('a');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('handles a long string', () => {
    const long = 'a'.repeat(10000);
    const v = djb2(long);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── sdbm() ──────────────────────────────────────────────────────────────────

describe('sdbm()', () => {
  it('returns 0 for empty string', () => {
    assert.equal(sdbm(''), 0);
  });

  it('matches known value for "hello"', () => {
    assert.equal(sdbm('hello'), 0x28d19932);
  });

  it('matches known value for "abc"', () => {
    assert.equal(sdbm('abc'), 0x3025f862);
  });

  it('is deterministic', () => {
    assert.equal(sdbm('test string'), sdbm('test string'));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = sdbm('hello');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('avalanche: "hello" and "Hello" produce different hashes', () => {
    assert.notEqual(sdbm('hello'), sdbm('Hello'));
  });

  it('produces different values for different inputs', () => {
    assert.notEqual(sdbm('foo'), sdbm('bar'));
  });
});

// ─── fnv1a32() ───────────────────────────────────────────────────────────────

describe('fnv1a32()', () => {
  it('returns the FNV offset basis for empty string', () => {
    assert.equal(fnv1a32(''), 0x811c9dc5);
  });

  it('matches known value for "hello"', () => {
    assert.equal(fnv1a32('hello'), 0x4f9f2cab);
  });

  it('matches known value for "abc"', () => {
    assert.equal(fnv1a32('abc'), 0x1a47e90b);
  });

  it('matches known value for "foobar"', () => {
    assert.equal(fnv1a32('foobar'), 0xbf9cf968);
  });

  it('is deterministic', () => {
    assert.equal(fnv1a32('hello world'), fnv1a32('hello world'));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = fnv1a32('test');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('avalanche: single-character change differs', () => {
    assert.notEqual(fnv1a32('hello'), fnv1a32('helo'));
  });

  it('handles single character', () => {
    const v = fnv1a32('a');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── murmur3() ───────────────────────────────────────────────────────────────

describe('murmur3()', () => {
  it('returns 0 for empty string with seed 0', () => {
    assert.equal(murmur3(''), 0);
  });

  it('matches known value for "hello" with seed 0', () => {
    assert.equal(murmur3('hello'), 0xbc834fd4);
  });

  it('matches known value for "abc"', () => {
    assert.equal(murmur3('abc'), 0x754fe870);
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = murmur3('hello');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('is deterministic with the same seed', () => {
    assert.equal(murmur3('hello', 42), murmur3('hello', 42));
  });

  it('different seeds produce different hashes for the same string', () => {
    assert.notEqual(murmur3('hello', 0), murmur3('hello', 1));
  });

  it('avalanche: "hello" and "Hello" differ', () => {
    assert.notEqual(murmur3('hello'), murmur3('Hello'));
  });

  it('handles odd-length string (single remaining char)', () => {
    const v = murmur3('a');
    assert.equal(v, 0x3c2569b2);
  });

  it('handles a long string', () => {
    const long = 'x'.repeat(5000);
    const v = murmur3(long);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── djb2Bytes() ─────────────────────────────────────────────────────────────

describe('djb2Bytes()', () => {
  it('returns 5381 for empty byte array (seed value)', () => {
    assert.equal(djb2Bytes(new Uint8Array([])), 5381);
  });

  it('matches djb2() on ASCII "hello" bytes', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    assert.equal(djb2Bytes(bytes), 0xa9cede7);
  });

  it('is deterministic', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    assert.equal(djb2Bytes(data), djb2Bytes(data));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = djb2Bytes(new Uint8Array([0xff, 0x00, 0xab]));
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('different byte arrays produce different hashes', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 4]);
    assert.notEqual(djb2Bytes(a), djb2Bytes(b));
  });
});

// ─── fnv1a32Bytes() ──────────────────────────────────────────────────────────

describe('fnv1a32Bytes()', () => {
  it('returns FNV offset basis for empty byte array', () => {
    assert.equal(fnv1a32Bytes(new Uint8Array([])), 0x811c9dc5);
  });

  it('matches fnv1a32() on ASCII "hello" bytes', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    assert.equal(fnv1a32Bytes(bytes), 0x4f9f2cab);
  });

  it('is deterministic', () => {
    const data = new Uint8Array([10, 20, 30]);
    assert.equal(fnv1a32Bytes(data), fnv1a32Bytes(data));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = fnv1a32Bytes(new Uint8Array([0, 255, 128]));
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('different byte arrays produce different hashes', () => {
    const a = new Uint8Array([65, 66, 67]); // "ABC"
    const b = new Uint8Array([65, 66, 68]); // "ABD"
    assert.notEqual(fnv1a32Bytes(a), fnv1a32Bytes(b));
  });
});

// ─── adler32() ───────────────────────────────────────────────────────────────

describe('adler32()', () => {
  it('returns 1 for empty string (a=1, b=0)', () => {
    assert.equal(adler32(''), 1);
  });

  it('matches known value for "abc"', () => {
    assert.equal(adler32('abc'), 0x24d0127);
  });

  it('returns 1 for empty Uint8Array', () => {
    assert.equal(adler32(new Uint8Array([])), 1);
  });

  it('accepts a Uint8Array and returns a non-negative integer', () => {
    const v = adler32(new Uint8Array([1, 2, 3]));
    assert.ok(Number.isInteger(v) && v >= 0);
  });

  it('is deterministic for strings', () => {
    assert.equal(adler32('hello world'), adler32('hello world'));
  });

  it('is deterministic for byte arrays', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]);
    assert.equal(adler32(data), adler32(data));
  });

  it('different inputs produce different checksums', () => {
    assert.notEqual(adler32('hello'), adler32('world'));
  });

  it('returns a 32-bit unsigned value', () => {
    const v = adler32('The quick brown fox jumps over the lazy dog');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── fletcher16() ────────────────────────────────────────────────────────────

describe('fletcher16()', () => {
  it('returns 0 for empty array', () => {
    assert.equal(fletcher16([]), 0);
  });

  it('returns 0 for all-zero input', () => {
    assert.equal(fletcher16([0, 0, 0]), 0);
  });

  it('matches known value for [1, 2, 3]', () => {
    assert.equal(fletcher16([1, 2, 3]), 0xa06);
  });

  it('accepts Uint8Array input', () => {
    const data = new Uint8Array([1, 2, 3]);
    assert.equal(fletcher16(data), 0xa06);
  });

  it('is deterministic', () => {
    const data = [10, 20, 30, 40];
    assert.equal(fletcher16(data), fletcher16(data));
  });

  it('returns a non-negative integer fitting in 16 bits', () => {
    const v = fletcher16([100, 200, 150, 50]);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffff);
  });

  it('different inputs produce different checksums', () => {
    assert.notEqual(fletcher16([1, 2, 3]), fletcher16([1, 2, 4]));
  });
});

// ─── hashCode() ──────────────────────────────────────────────────────────────

describe('hashCode()', () => {
  it('returns 0 for empty string', () => {
    assert.equal(hashCode(''), 0);
  });

  it('matches known Java-style hashCode for "hello"', () => {
    assert.equal(hashCode('hello'), 99162322);
  });

  it('is deterministic', () => {
    assert.equal(hashCode('test'), hashCode('test'));
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = hashCode('some string');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('avalanche: "hello" and "Hello" differ', () => {
    assert.notEqual(hashCode('hello'), hashCode('Hello'));
  });

  it('handles single character', () => {
    const v = hashCode('a');
    assert.ok(Number.isInteger(v) && v >= 0);
  });
});

// ─── simpleHash() ─────────────────────────────────────────────────────────────

describe('simpleHash()', () => {
  it('returns an 8-character hex string', () => {
    const h = simpleHash('hello');
    assert.equal(h.length, 8);
    assert.match(h, /^[0-9a-f]{8}$/);
  });

  it('matches known value for "hello"', () => {
    assert.equal(simpleHash('hello'), '4f9f2cab');
  });

  it('matches known value for empty string', () => {
    assert.equal(simpleHash(''), '811c9dc5');
  });

  it('is deterministic', () => {
    assert.equal(simpleHash('abc'), simpleHash('abc'));
  });

  it('produces different values for different inputs', () => {
    assert.notEqual(simpleHash('foo'), simpleHash('bar'));
  });

  it('pads to 8 chars when hex value is short', () => {
    // All results must be exactly 8 chars
    for (const s of ['a', 'b', 'c', '1', 'Z']) {
      assert.equal(simpleHash(s).length, 8);
    }
  });
});

// ─── consistentHash() ────────────────────────────────────────────────────────

describe('consistentHash()', () => {
  it('returns a value in [0, buckets) for various bucket counts', () => {
    for (let b = 1; b <= 20; b++) {
      const idx = consistentHash('my-key', b);
      assert.ok(idx >= 0 && idx < b, `Expected 0 <= ${idx} < ${b}`);
    }
  });

  it('returns 0 for buckets=1', () => {
    assert.equal(consistentHash('anything', 1), 0);
  });

  it('returns 0 for buckets<=0 (safe fallback)', () => {
    assert.equal(consistentHash('key', 0), 0);
    assert.equal(consistentHash('key', -5), 0);
  });

  it('is deterministic for the same key and bucket count', () => {
    assert.equal(consistentHash('stable-key', 10), consistentHash('stable-key', 10));
  });

  it('matches known bucket for "key" with 10 buckets', () => {
    assert.equal(consistentHash('key', 10), 2);
  });

  it('distributes 1000 keys across 10 buckets — all buckets used', () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 1000; i++) {
      counts[consistentHash(`key-${i}`, 10)]++;
    }
    for (const c of counts) {
      assert.ok(c > 0, `A bucket received 0 keys out of 1000: ${counts}`);
    }
  });

  it('different keys can map to different buckets', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      seen.add(consistentHash(`item-${i}`, 5));
    }
    assert.ok(seen.size > 1, 'All keys mapped to the same bucket');
  });
});

// ─── RollingHash ─────────────────────────────────────────────────────────────

describe('RollingHash', () => {
  it('hash("") returns 0', () => {
    const rh = new RollingHash();
    assert.equal(rh.hash(''), 0);
  });

  it('hash("abc") matches known polynomial value', () => {
    const rh = new RollingHash();
    assert.equal(rh.hash('abc'), 96354);
  });

  it('hash is deterministic — same result on two instances', () => {
    const rh1 = new RollingHash();
    const rh2 = new RollingHash();
    assert.equal(rh1.hash('hello'), rh2.hash('hello'));
  });

  it('hash("hello") matches Java-style hashCode("hello")', () => {
    // Both use base-31, so hash("hello") should equal hashCode("hello")
    const rh = new RollingHash(31, 1_000_000_007);
    assert.equal(rh.hash('hello'), 99162322);
  });

  it('different strings produce different hashes', () => {
    const rh1 = new RollingHash();
    const rh2 = new RollingHash();
    assert.notEqual(rh1.hash('abc'), rh2.hash('xyz'));
  });

  it('rolling update matches direct hash of the new window', () => {
    // Window "abc" -> roll out 'a', roll in 'd' -> should equal hash("bcd")
    const rh = new RollingHash();
    rh.hash('abc');
    const rolledHash = rh.update('a', 'd', 3);

    const rh2 = new RollingHash();
    const directHash = rh2.hash('bcd');

    assert.equal(rolledHash, directHash);
  });

  it('rolling update returns a non-negative integer', () => {
    const rh = new RollingHash();
    rh.hash('hello');
    const v = rh.update('h', 'x', 5);
    assert.ok(Number.isInteger(v) && v >= 0);
  });

  it('custom base and mod are respected', () => {
    const rh = new RollingHash(37, 999983);
    const v = rh.hash('test');
    assert.ok(v >= 0 && v < 999983);
  });

  it('sequential rolling matches hash of each new window', () => {
    // Slide a window of size 3 over "abcde": abc -> bcd -> cde
    const text = 'abcde';
    const winSize = 3;
    const rh = new RollingHash();
    rh.hash(text.slice(0, winSize));

    for (let i = 1; i + winSize <= text.length; i++) {
      const rolled = rh.update(text[i - 1], text[i + winSize - 1], winSize);
      const rh2 = new RollingHash();
      const direct = rh2.hash(text.slice(i, i + winSize));
      assert.equal(rolled, direct, `Mismatch at window "${text.slice(i, i + winSize)}"`);
    }
  });
});

// ─── multiHash() ──────────────────────────────────────────────────────────────

describe('multiHash()', () => {
  it('returns an array of the requested count', () => {
    assert.equal(multiHash('hello', 3, 100).length, 3);
    assert.equal(multiHash('hello', 7, 64).length, 7);
  });

  it('all positions are in [0, size)', () => {
    const size = 100;
    for (const pos of multiHash('hello', 5, size)) {
      assert.ok(pos >= 0 && pos < size, `Position ${pos} out of range [0, ${size})`);
    }
  });

  it('matches known values for "hello", count=3, size=100', () => {
    assert.deepEqual(multiHash('hello', 3, 100), [23, 2, 81]);
  });

  it('matches known values for "hello", count=5, size=64', () => {
    assert.deepEqual(multiHash('hello', 5, 64), [43, 18, 57, 32, 7]);
  });

  it('returns empty array for count=0', () => {
    assert.deepEqual(multiHash('hello', 0, 100), []);
  });

  it('is deterministic', () => {
    assert.deepEqual(multiHash('abc', 4, 256), multiHash('abc', 4, 256));
  });

  it('different strings produce different position sets', () => {
    const h1 = multiHash('hello', 3, 100);
    const h2 = multiHash('world', 3, 100);
    assert.notDeepEqual(h1, h2);
  });

  it('all positions use size as the modulus bound', () => {
    const size = 17; // prime, good stress test
    for (const pos of multiHash('stress test', 10, size)) {
      assert.ok(pos >= 0 && pos < size);
    }
  });

  it('matches known values for empty string, count=3, size=10', () => {
    assert.deepEqual(multiHash('', 3, 10), [1, 2, 3]);
  });
});
