// ─── Unit Tests: Hashing Utilities ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hash,
  hmac,
  verifyHmac,
  hashPassword,
  verifyPassword,
  generateSalt,
  checksum,
} from '../../app/modules/hashing.js';

// ─── hash() ──────────────────────────────────────────────────────────────────

describe('hash()', () => {
  it('produces a 64-char hex string for sha256', () => {
    const result = hash('hello');
    assert.equal(typeof result, 'string');
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it('returns the known sha256 digest for "hello"', () => {
    // echo -n hello | sha256sum
    const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    assert.equal(hash('hello'), expected);
  });

  it('accepts a Buffer as input', () => {
    const bufResult = hash(Buffer.from('hello'));
    const strResult = hash('hello');
    assert.equal(bufResult, strResult);
  });

  it('uses sha512 when specified', () => {
    const result = hash('hello', 'sha512');
    assert.equal(result.length, 128);
  });

  it('uses md5 when specified', () => {
    const result = hash('hello', 'md5');
    assert.equal(result.length, 32);
  });

  it('produces different digests for different inputs', () => {
    assert.notEqual(hash('foo'), hash('bar'));
  });
});

// ─── hmac() ───────────────────────────────────────────────────────────────────

describe('hmac()', () => {
  it('returns a 64-char hex string for sha256', () => {
    const result = hmac('secret', 'message');
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it('is deterministic for the same key + data', () => {
    assert.equal(hmac('key', 'data'), hmac('key', 'data'));
  });

  it('differs when the key differs', () => {
    assert.notEqual(hmac('key1', 'data'), hmac('key2', 'data'));
  });

  it('differs when the data differs', () => {
    assert.notEqual(hmac('key', 'data1'), hmac('key', 'data2'));
  });

  it('accepts Buffer key and data', () => {
    const a = hmac(Buffer.from('key'), Buffer.from('data'));
    const b = hmac('key', 'data');
    assert.equal(a, b);
  });
});

// ─── verifyHmac() ─────────────────────────────────────────────────────────────

describe('verifyHmac()', () => {
  it('returns true for a correct HMAC', () => {
    const tag = hmac('secret', 'payload');
    assert.equal(verifyHmac('secret', 'payload', tag), true);
  });

  it('returns false for a wrong HMAC', () => {
    const tag = hmac('secret', 'payload');
    assert.equal(verifyHmac('secret', 'payload', 'ff'.repeat(32)), false);
  });

  it('returns false when data is tampered', () => {
    const tag = hmac('secret', 'payload');
    assert.equal(verifyHmac('secret', 'tampered', tag), false);
  });

  it('returns false when key is wrong', () => {
    const tag = hmac('secret', 'payload');
    assert.equal(verifyHmac('wrong-secret', 'payload', tag), false);
  });
});

// ─── generateSalt() ───────────────────────────────────────────────────────────

describe('generateSalt()', () => {
  it('returns a non-empty hex string', () => {
    const salt = generateSalt();
    assert.equal(typeof salt, 'string');
    assert.ok(salt.length > 0);
    assert.match(salt, /^[0-9a-f]+$/);
  });

  it('default length produces 32 hex chars (16 bytes)', () => {
    assert.equal(generateSalt().length, 32);
  });

  it('custom byte count changes the output length', () => {
    assert.equal(generateSalt(32).length, 64);
  });

  it('generates different salts each call', () => {
    assert.notEqual(generateSalt(), generateSalt());
  });
});

// ─── hashPassword() & verifyPassword() ───────────────────────────────────────

describe('hashPassword() + verifyPassword()', () => {
  it('returns hash and salt strings', async () => {
    const result = await hashPassword('my-password');
    assert.equal(typeof result.hash, 'string');
    assert.equal(typeof result.salt, 'string');
    assert.ok(result.hash.length > 0);
    assert.ok(result.salt.length > 0);
  });

  it('verifyPassword returns true for the correct password', async () => {
    const { hash: h, salt } = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('correct-horse-battery-staple', h, salt);
    assert.equal(ok, true);
  });

  it('verifyPassword returns false for a wrong password', async () => {
    const { hash: h, salt } = await hashPassword('correct');
    const ok = await verifyPassword('incorrect', h, salt);
    assert.equal(ok, false);
  });

  it('accepts an explicit salt', async () => {
    const salt = generateSalt();
    const r1 = await hashPassword('pw', salt);
    const r2 = await hashPassword('pw', salt);
    assert.equal(r1.hash, r2.hash);
    assert.equal(r1.salt, salt);
  });

  it('different salts produce different hashes for the same password', async () => {
    const r1 = await hashPassword('pw');
    const r2 = await hashPassword('pw');
    // Salt should differ (extremely unlikely to collide)
    assert.notEqual(r1.salt, r2.salt);
    assert.notEqual(r1.hash, r2.hash);
  });
});

// ─── checksum() ───────────────────────────────────────────────────────────────

describe('checksum()', () => {
  it('returns a 64-char hex sha256 string', () => {
    const cs = checksum(Buffer.from('data'));
    assert.equal(cs.length, 64);
    assert.match(cs, /^[0-9a-f]+$/);
  });

  it('is equivalent to hash(data, "sha256")', () => {
    const data = Buffer.from('test data');
    assert.equal(checksum(data), hash(data, 'sha256'));
  });

  it('accepts a plain string', () => {
    assert.equal(checksum('hello'), hash('hello', 'sha256'));
  });
});
