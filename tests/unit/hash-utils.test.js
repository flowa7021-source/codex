// ─── Unit Tests: hash-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  md5,
  sha1,
  sha256,
  sha512,
  hashFile,
  checksum,
  crc32,
  fnv1a,
  murmurhash3,
  consistentHash,
} from '../../app/modules/hash-utils.js';

// ─── md5() ───────────────────────────────────────────────────────────────────

describe('md5()', () => {
  it('returns a 32-character lowercase hex string', () => {
    const h = md5('hello');
    assert.equal(h.length, 32);
    assert.match(h, /^[0-9a-f]{32}$/);
  });

  it('matches the known MD5 of empty string', () => {
    assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  });

  it('matches the known MD5 of "hello"', () => {
    assert.equal(md5('hello'), '5d41402abc4b2a76b9719d911017c592');
  });

  it('matches the known MD5 of "The quick brown fox jumps over the lazy dog"', () => {
    assert.equal(
      md5('The quick brown fox jumps over the lazy dog'),
      '9e107d9d372bb6826bd81d3542a419d6',
    );
  });

  it('is deterministic', () => {
    assert.equal(md5('test'), md5('test'));
  });

  it('produces different hashes for different inputs', () => {
    assert.notEqual(md5('foo'), md5('bar'));
  });

  it('accepts a Buffer as input', () => {
    const h = md5(Buffer.from('hello'));
    assert.equal(h, '5d41402abc4b2a76b9719d911017c592');
  });

  it('accepts an empty Buffer', () => {
    assert.equal(md5(Buffer.alloc(0)), 'd41d8cd98f00b204e9800998ecf8427e');
  });
});

// ─── sha1() ──────────────────────────────────────────────────────────────────

describe('sha1()', () => {
  it('returns a 40-character lowercase hex string', () => {
    const h = sha1('hello');
    assert.equal(h.length, 40);
    assert.match(h, /^[0-9a-f]{40}$/);
  });

  it('matches the known SHA-1 of empty string', () => {
    assert.equal(sha1(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('matches the known SHA-1 of "hello"', () => {
    assert.equal(sha1('hello'), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('matches the known SHA-1 of "abc"', () => {
    assert.equal(sha1('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('is deterministic', () => {
    assert.equal(sha1('hello world'), sha1('hello world'));
  });

  it('produces different hashes for different inputs', () => {
    assert.notEqual(sha1('foo'), sha1('bar'));
  });

  it('accepts a Buffer as input', () => {
    assert.equal(sha1(Buffer.from('hello')), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('accepts an empty Buffer', () => {
    assert.equal(sha1(Buffer.alloc(0)), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });
});

// ─── sha256() ────────────────────────────────────────────────────────────────

describe('sha256()', () => {
  it('returns a 64-character lowercase hex string', () => {
    const h = sha256('hello');
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('matches the known SHA-256 of empty string', () => {
    assert.equal(
      sha256(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the known SHA-256 of "hello"', () => {
    assert.equal(
      sha256('hello'),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('matches the known SHA-256 of "abc"', () => {
    assert.equal(
      sha256('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic', () => {
    assert.equal(sha256('hello world'), sha256('hello world'));
  });

  it('produces different hashes for different inputs', () => {
    assert.notEqual(sha256('foo'), sha256('bar'));
  });

  it('accepts a Buffer as input', () => {
    assert.equal(
      sha256(Buffer.from('hello')),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('accepts an empty Buffer', () => {
    assert.equal(
      sha256(Buffer.alloc(0)),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

// ─── sha512() ────────────────────────────────────────────────────────────────

describe('sha512()', () => {
  it('returns a 128-character lowercase hex string', () => {
    const h = sha512('hello');
    assert.equal(h.length, 128);
    assert.match(h, /^[0-9a-f]{128}$/);
  });

  it('matches the known SHA-512 of empty string', () => {
    assert.equal(
      sha512(''),
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
      '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    );
  });

  it('matches the known SHA-512 of "abc"', () => {
    assert.equal(
      sha512('abc'),
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
      '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('is deterministic', () => {
    assert.equal(sha512('test'), sha512('test'));
  });

  it('produces different hashes for different inputs', () => {
    assert.notEqual(sha512('foo'), sha512('bar'));
  });

  it('accepts a Buffer as input', () => {
    const h = sha512(Buffer.from('abc'));
    assert.equal(h.length, 128);
  });

  it('sha512 and sha256 produce different digests for the same input', () => {
    assert.notEqual(sha512('hello'), sha256('hello'));
  });

  it('accepts an empty Buffer', () => {
    assert.equal(sha512(Buffer.alloc(0)), sha512(''));
  });
});

// ─── hashFile() ──────────────────────────────────────────────────────────────

describe('hashFile()', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'hash-utils-test-'));

  it('hashes a file with SHA-256 by default', async () => {
    const filePath = join(tmpDir, 'file1.txt');
    writeFileSync(filePath, 'hello');
    const h = await hashFile(filePath);
    assert.equal(h, sha256('hello'));
  });

  it('hashes a file with MD5 when requested', async () => {
    const filePath = join(tmpDir, 'file2.txt');
    writeFileSync(filePath, 'hello');
    const h = await hashFile(filePath, 'md5');
    assert.equal(h, md5('hello'));
  });

  it('hashes an empty file', async () => {
    const filePath = join(tmpDir, 'empty.txt');
    writeFileSync(filePath, '');
    const h = await hashFile(filePath);
    assert.equal(h, sha256(''));
  });

  it('returns a lowercase hex string', async () => {
    const filePath = join(tmpDir, 'file3.txt');
    writeFileSync(filePath, 'test content');
    const h = await hashFile(filePath);
    assert.match(h, /^[0-9a-f]+$/);
  });

  it('rejects for a non-existent file', async () => {
    await assert.rejects(hashFile(join(tmpDir, 'nonexistent-xyz.txt')));
  });

  it('hashes binary content correctly', async () => {
    const filePath = join(tmpDir, 'binary.bin');
    const content = Buffer.from([0, 1, 2, 255, 128, 64]);
    writeFileSync(filePath, content);
    const h = await hashFile(filePath);
    assert.equal(h, sha256(content));
  });

  it('returns the same hash on repeated calls for the same file', async () => {
    const filePath = join(tmpDir, 'repeat.txt');
    writeFileSync(filePath, 'deterministic content');
    const h1 = await hashFile(filePath);
    const h2 = await hashFile(filePath);
    assert.equal(h1, h2);
  });

  it('hashes with sha1 algorithm', async () => {
    const filePath = join(tmpDir, 'sha1test.txt');
    writeFileSync(filePath, 'sha1 content');
    const h = await hashFile(filePath, 'sha1');
    assert.equal(h, sha1('sha1 content'));
  });
});

// ─── checksum() ──────────────────────────────────────────────────────────────

describe('checksum()', () => {
  it('defaults to SHA-256', () => {
    assert.equal(checksum('hello'), sha256('hello'));
  });

  it('supports md5 algorithm', () => {
    assert.equal(checksum('hello', 'md5'), md5('hello'));
  });

  it('supports sha1 algorithm', () => {
    assert.equal(checksum('hello', 'sha1'), sha1('hello'));
  });

  it('supports sha512 algorithm', () => {
    assert.equal(checksum('hello', 'sha512'), sha512('hello'));
  });

  it('is deterministic', () => {
    assert.equal(checksum('input'), checksum('input'));
  });

  it('produces different results for different inputs', () => {
    assert.notEqual(checksum('a'), checksum('b'));
  });

  it('returns a lowercase hex string', () => {
    assert.match(checksum('test'), /^[0-9a-f]+$/);
  });

  it('handles empty string', () => {
    assert.equal(checksum(''), sha256(''));
  });
});

// ─── crc32() ─────────────────────────────────────────────────────────────────

describe('crc32()', () => {
  it('returns 0x00000000 for empty string', () => {
    assert.equal(crc32(''), 0x00000000);
  });

  it('matches the well-known CRC32 of "123456789"', () => {
    // Standard CRC32 check value for "123456789" is 0xCBF43926
    assert.equal(crc32('123456789'), 0xcbf43926);
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = crc32('hello');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('is deterministic', () => {
    assert.equal(crc32('hello'), crc32('hello'));
  });

  it('produces different values for different inputs', () => {
    assert.notEqual(crc32('foo'), crc32('bar'));
  });

  it('accepts a Buffer input', () => {
    assert.equal(crc32(Buffer.from('hello')), crc32('hello'));
  });

  it('accepts an empty Buffer', () => {
    assert.equal(crc32(Buffer.alloc(0)), 0);
  });

  it('matches CRC32 of "The quick brown fox jumps over the lazy dog"', () => {
    // Known CRC32: 0x414FA339
    assert.equal(crc32('The quick brown fox jumps over the lazy dog'), 0x414fa339);
  });
});

// ─── fnv1a() ─────────────────────────────────────────────────────────────────

describe('fnv1a()', () => {
  it('returns the FNV offset basis for empty string', () => {
    // FNV-1a of empty string = FNV_OFFSET_BASIS_32 = 0x811c9dc5 = 2166136261
    assert.equal(fnv1a(''), 0x811c9dc5);
  });

  it('matches known FNV-1a 32-bit value for "hello"', () => {
    // Computed: 0x4f9f2cab
    assert.equal(fnv1a('hello'), 0x4f9f2cab);
  });

  it('matches known FNV-1a 32-bit value for "foobar"', () => {
    // Known: 0xbf9cf968
    assert.equal(fnv1a('foobar'), 0xbf9cf968);
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = fnv1a('test');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('is deterministic', () => {
    assert.equal(fnv1a('hello world'), fnv1a('hello world'));
  });

  it('produces different values for different inputs', () => {
    assert.notEqual(fnv1a('foo'), fnv1a('bar'));
  });

  it('returns 0x811c9dc5 for empty string (offset basis)', () => {
    assert.equal(fnv1a(''), 2166136261);
  });

  it('handles single character', () => {
    const v = fnv1a('a');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── murmurhash3() ───────────────────────────────────────────────────────────

describe('murmurhash3()', () => {
  it('returns 0 for empty string with seed 0', () => {
    assert.equal(murmurhash3(''), 0);
  });

  it('returns a non-negative 32-bit integer', () => {
    const v = murmurhash3('hello');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });

  it('is deterministic with same input and seed', () => {
    assert.equal(murmurhash3('hello', 42), murmurhash3('hello', 42));
  });

  it('differs with different seeds for the same input', () => {
    assert.notEqual(murmurhash3('hello', 0), murmurhash3('hello', 1));
  });

  it('produces different values for different inputs', () => {
    assert.notEqual(murmurhash3('foo'), murmurhash3('bar'));
  });

  it('matches known MurmurHash3 value for "hello" with seed 0', () => {
    // Reference value from canonical MurmurHash3_x86_32 implementation
    assert.equal(murmurhash3('hello', 0), 0x248bfa47);
  });

  it('handles input length not divisible by 4', () => {
    // 'ab' = 2 bytes (tail only), 'abc' = 3 bytes (tail only)
    const v2 = murmurhash3('ab');
    const v3 = murmurhash3('abc');
    assert.ok(Number.isInteger(v2) && v2 >= 0);
    assert.ok(Number.isInteger(v3) && v3 >= 0);
    assert.notEqual(v2, v3);
  });

  it('handles input of exactly 4 bytes (one block)', () => {
    const v = murmurhash3('test');
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff);
  });
});

// ─── consistentHash() ────────────────────────────────────────────────────────

describe('consistentHash()', () => {
  it('returns a value in [0, buckets)', () => {
    for (let b = 1; b <= 20; b++) {
      const idx = consistentHash('my-key', b);
      assert.ok(idx >= 0 && idx < b, `Expected 0 <= ${idx} < ${b}`);
    }
  });

  it('always returns 0 with 1 bucket', () => {
    assert.equal(consistentHash('anything', 1), 0);
    assert.equal(consistentHash('other', 1), 0);
  });

  it('is deterministic for the same key + buckets', () => {
    assert.equal(consistentHash('key', 10), consistentHash('key', 10));
  });

  it('distributes keys across buckets', () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 1000; i++) {
      counts[consistentHash(`key-${i}`, 10)]++;
    }
    // Each bucket should see at least 1 key from 1000 samples
    for (const c of counts) assert.ok(c > 0, `Bucket with 0 keys: ${counts}`);
  });

  it('different keys can map to different buckets', () => {
    const buckets = new Set();
    for (let i = 0; i < 20; i++) {
      buckets.add(consistentHash(`key-${i}`, 5));
    }
    assert.ok(buckets.size > 1, 'All keys mapped to the same bucket');
  });

  it('throws RangeError for buckets=0', () => {
    assert.throws(() => consistentHash('k', 0), RangeError);
  });

  it('throws RangeError for negative buckets', () => {
    assert.throws(() => consistentHash('k', -1), RangeError);
  });

  it('throws RangeError for non-integer buckets', () => {
    assert.throws(() => consistentHash('k', 3.5), RangeError);
  });
});
