// ─── Unit Tests: crypto-utils ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  md5,
  sha1,
  sha256,
  fnv1a32,
  djb2,
  toBase64,
  fromBase64,
  toHex,
  fromHex,
  xorEncrypt,
  xorDecrypt,
  uuidV4,
  hmacSha256,
  hashPassword,
  verifyPassword,
  crc32,
  adler32,
} from '../../app/modules/crypto-utils.js';

// ─── md5 ─────────────────────────────────────────────────────────────────────

describe('md5', () => {
  it('returns a 32-character lowercase hex string', () => {
    const h = md5('hello');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 32);
    assert.match(h, /^[0-9a-f]{32}$/);
  });

  it('empty string gives known MD5 hash', () => {
    assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  });

  it('"hello" gives known MD5 hash', () => {
    assert.equal(md5('hello'), '5d41402abc4b2a76b9719d911017c592');
  });

  it('"abc" gives known MD5 hash', () => {
    assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  });

  it('is deterministic — same input always same output', () => {
    assert.equal(md5('test'), md5('test'));
  });

  it('different inputs produce different hashes', () => {
    assert.notEqual(md5('foo'), md5('bar'));
  });
});

// ─── sha1 ─────────────────────────────────────────────────────────────────────

describe('sha1', () => {
  it('returns a 40-character lowercase hex string', () => {
    const h = sha1('hello');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 40);
    assert.match(h, /^[0-9a-f]{40}$/);
  });

  it('empty string gives known SHA-1 hash', () => {
    assert.equal(sha1(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('"hello" gives known SHA-1 hash', () => {
    assert.equal(sha1('hello'), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('"abc" gives known SHA-1 hash', () => {
    assert.equal(sha1('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('is deterministic', () => {
    assert.equal(sha1('test'), sha1('test'));
  });

  it('different inputs produce different hashes', () => {
    assert.notEqual(sha1('foo'), sha1('bar'));
  });
});

// ─── sha256 ──────────────────────────────────────────────────────────────────

describe('sha256', () => {
  it('returns a 64-character lowercase hex string', () => {
    const h = sha256('hello');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('empty string gives known SHA-256 hash', () => {
    assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('"hello" gives known SHA-256 hash', () => {
    assert.equal(sha256('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('"abc" gives known SHA-256 hash', () => {
    assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is deterministic', () => {
    assert.equal(sha256('hello world'), sha256('hello world'));
  });

  it('different inputs produce different hashes', () => {
    assert.notEqual(sha256('foo'), sha256('bar'));
  });
});

// ─── fnv1a32 ─────────────────────────────────────────────────────────────────

describe('fnv1a32', () => {
  it('returns a number', () => {
    assert.equal(typeof fnv1a32('hello'), 'number');
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a32('hello');
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it('empty string returns the FNV offset basis (2166136261)', () => {
    assert.equal(fnv1a32(''), 2166136261);
  });

  it('"hello" gives known FNV-1a value', () => {
    assert.equal(fnv1a32('hello'), 1335831723);
  });

  it('is deterministic', () => {
    assert.equal(fnv1a32('test'), fnv1a32('test'));
  });

  it('different inputs produce different hashes', () => {
    assert.notEqual(fnv1a32('foo'), fnv1a32('bar'));
  });
});

// ─── djb2 ────────────────────────────────────────────────────────────────────

describe('djb2', () => {
  it('returns a number', () => {
    assert.equal(typeof djb2('hello'), 'number');
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = djb2('hello');
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it('empty string returns 5381 (djb2 seed)', () => {
    assert.equal(djb2(''), 5381);
  });

  it('"hello" gives known djb2 value', () => {
    assert.equal(djb2('hello'), 178056679);
  });

  it('is deterministic', () => {
    assert.equal(djb2('test'), djb2('test'));
  });

  it('different inputs produce different hashes', () => {
    assert.notEqual(djb2('foo'), djb2('bar'));
  });

  it('fnv1a32 and djb2 produce different values for same input', () => {
    assert.notEqual(fnv1a32('hello'), djb2('hello'));
  });
});

// ─── toBase64 / fromBase64 ───────────────────────────────────────────────────

describe('toBase64', () => {
  it('"hello" encodes to "aGVsbG8="', () => {
    assert.equal(toBase64('hello'), 'aGVsbG8=');
  });

  it('"Man" encodes to "TWFu" (no padding needed)', () => {
    assert.equal(toBase64('Man'), 'TWFu');
  });

  it('empty string encodes to empty string', () => {
    assert.equal(toBase64(''), '');
  });

  it('output contains only valid base64 characters', () => {
    const b64 = toBase64('Hello, World!');
    assert.match(b64, /^[A-Za-z0-9+/=]+$/);
  });
});

describe('fromBase64', () => {
  it('"aGVsbG8=" decodes to "hello"', () => {
    assert.equal(fromBase64('aGVsbG8='), 'hello');
  });

  it('"TWFu" decodes to "Man"', () => {
    assert.equal(fromBase64('TWFu'), 'Man');
  });

  it('empty string decodes to empty string', () => {
    assert.equal(fromBase64(''), '');
  });
});

describe('toBase64 / fromBase64 round-trip', () => {
  it('round-trips ASCII text', () => {
    const original = 'Hello, World!';
    assert.equal(fromBase64(toBase64(original)), original);
  });

  it('round-trips a longer string', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    assert.equal(fromBase64(toBase64(original)), original);
  });

  it('round-trips an empty string', () => {
    assert.equal(fromBase64(toBase64('')), '');
  });
});

// ─── toHex / fromHex ─────────────────────────────────────────────────────────

describe('toHex', () => {
  it('"hello" encodes to "68656c6c6f"', () => {
    assert.equal(toHex('hello'), '68656c6c6f');
  });

  it('empty string encodes to empty string', () => {
    assert.equal(toHex(''), '');
  });

  it('output contains only hex characters', () => {
    assert.match(toHex('Hello, World!'), /^[0-9a-f]+$/);
  });
});

describe('fromHex', () => {
  it('"68656c6c6f" decodes to "hello"', () => {
    assert.equal(fromHex('68656c6c6f'), 'hello');
  });

  it('empty string decodes to empty string', () => {
    assert.equal(fromHex(''), '');
  });

  it('throws on odd-length hex string', () => {
    assert.throws(() => fromHex('abc'), /fromHex/);
  });
});

describe('toHex / fromHex round-trip', () => {
  it('round-trips ASCII text', () => {
    const original = 'Hello, World!';
    assert.equal(fromHex(toHex(original)), original);
  });

  it('round-trips empty string', () => {
    assert.equal(fromHex(toHex('')), '');
  });
});

// ─── xorEncrypt / xorDecrypt ─────────────────────────────────────────────────

describe('xorEncrypt', () => {
  it('returns a hex string', () => {
    const enc = xorEncrypt('hello', 'key');
    assert.match(enc, /^[0-9a-f]+$/);
  });

  it('"hello" with key "key" gives known ciphertext', () => {
    assert.equal(xorEncrypt('hello', 'key'), '030015070a');
  });

  it('throws on empty key', () => {
    assert.throws(() => xorEncrypt('hello', ''), /key/);
  });

  it('different keys produce different ciphertexts', () => {
    assert.notEqual(xorEncrypt('hello', 'key1'), xorEncrypt('hello', 'key2'));
  });
});

describe('xorDecrypt', () => {
  it('decrypts ciphertext back to original', () => {
    const cipher = xorEncrypt('hello', 'key');
    assert.equal(xorDecrypt(cipher, 'key'), 'hello');
  });

  it('throws on empty key', () => {
    assert.throws(() => xorDecrypt('030015070a', ''), /key/);
  });

  it('throws on odd-length hex input', () => {
    assert.throws(() => xorDecrypt('abc', 'key'), /odd/i);
  });
});

describe('xorEncrypt / xorDecrypt round-trip', () => {
  it('round-trips a regular string', () => {
    const plaintext = 'The quick brown fox';
    const key = 'secret';
    assert.equal(xorDecrypt(xorEncrypt(plaintext, key), key), plaintext);
  });

  it('round-trips an empty string', () => {
    assert.equal(xorDecrypt(xorEncrypt('', 'k'), 'k'), '');
  });

  it('XOR is its own inverse — encrypting twice restores the original', () => {
    const plaintext = 'hello';
    const key = 'key';
    const cipher = xorEncrypt(plaintext, key);
    const decrypted = xorDecrypt(cipher, key);
    assert.equal(decrypted, plaintext);
  });
});

// ─── uuidV4 ──────────────────────────────────────────────────────────────────

describe('uuidV4', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = uuidV4();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('has exactly 36 characters', () => {
    assert.equal(uuidV4().length, 36);
  });

  it('version nibble is always "4"', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(uuidV4()[14], '4');
    }
  });

  it('variant nibble is always 8, 9, a, or b', () => {
    for (let i = 0; i < 10; i++) {
      assert.ok(/^[89ab]$/.test(uuidV4()[19]));
    }
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuidV4()));
    assert.equal(ids.size, 100);
  });
});

// ─── hmacSha256 ──────────────────────────────────────────────────────────────

describe('hmacSha256', () => {
  it('returns a 64-character hex string', () => {
    const h = hmacSha256('hello', 'key');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    assert.equal(hmacSha256('hello', 'key'), hmacSha256('hello', 'key'));
  });

  it('different keys produce different MACs', () => {
    assert.notEqual(hmacSha256('hello', 'key1'), hmacSha256('hello', 'key2'));
  });

  it('different messages produce different MACs', () => {
    assert.notEqual(hmacSha256('hello', 'key'), hmacSha256('world', 'key'));
  });

  it('empty message is handled', () => {
    const h = hmacSha256('', 'key');
    assert.equal(h.length, 64);
  });

  it('empty key is handled', () => {
    const h = hmacSha256('hello', '');
    assert.equal(h.length, 64);
  });
});

// ─── hashPassword / verifyPassword ───────────────────────────────────────────

describe('hashPassword', () => {
  it('returns an object with hash and salt properties', () => {
    const result = hashPassword('password123');
    assert.ok(typeof result.hash === 'string');
    assert.ok(typeof result.salt === 'string');
  });

  it('hash is a non-empty hex string', () => {
    const { hash } = hashPassword('secret');
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it('salt is non-empty', () => {
    const { salt } = hashPassword('secret');
    assert.ok(salt.length > 0);
  });

  it('uses provided salt when given', () => {
    const { salt } = hashPassword('pw', 'mysalt');
    assert.equal(salt, 'mysalt');
  });

  it('same password + salt always gives same hash', () => {
    const a = hashPassword('password', 'fixedsalt');
    const b = hashPassword('password', 'fixedsalt');
    assert.equal(a.hash, b.hash);
  });

  it('different passwords give different hashes with same salt', () => {
    const a = hashPassword('password1', 'salt');
    const b = hashPassword('password2', 'salt');
    assert.notEqual(a.hash, b.hash);
  });

  it('same password gives different hashes with different salts', () => {
    const a = hashPassword('password', 'salt1');
    const b = hashPassword('password', 'salt2');
    assert.notEqual(a.hash, b.hash);
  });
});

describe('verifyPassword', () => {
  it('correct password verifies successfully', () => {
    const { hash, salt } = hashPassword('mypassword');
    assert.ok(verifyPassword('mypassword', hash, salt));
  });

  it('wrong password does not verify', () => {
    const { hash, salt } = hashPassword('mypassword');
    assert.ok(!verifyPassword('wrongpassword', hash, salt));
  });

  it('correct password with wrong salt does not verify', () => {
    const { hash } = hashPassword('mypassword', 'salt1');
    assert.ok(!verifyPassword('mypassword', hash, 'salt2'));
  });

  it('empty password verifies with correct hash', () => {
    const { hash, salt } = hashPassword('');
    assert.ok(verifyPassword('', hash, salt));
  });
});

// ─── crc32 ───────────────────────────────────────────────────────────────────

describe('crc32', () => {
  it('returns a number', () => {
    assert.equal(typeof crc32('hello'), 'number');
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = crc32('hello');
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it('empty string returns 0', () => {
    assert.equal(crc32(''), 0);
  });

  it('"hello" gives known CRC-32 value (907060870)', () => {
    assert.equal(crc32('hello'), 907060870);
  });

  it('is deterministic', () => {
    assert.equal(crc32('test'), crc32('test'));
  });

  it('different inputs produce different checksums', () => {
    assert.notEqual(crc32('hello'), crc32('world'));
  });
});

// ─── adler32 ─────────────────────────────────────────────────────────────────

describe('adler32', () => {
  it('returns a number', () => {
    assert.equal(typeof adler32('hello'), 'number');
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = adler32('hello');
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it('empty string returns 1 (Adler-32 initial value)', () => {
    assert.equal(adler32(''), 1);
  });

  it('"hello" gives known Adler-32 value (103547413)', () => {
    assert.equal(adler32('hello'), 103547413);
  });

  it('is deterministic', () => {
    assert.equal(adler32('test'), adler32('test'));
  });

  it('different inputs produce different checksums', () => {
    assert.notEqual(adler32('hello'), adler32('world'));
  });

  it('crc32 and adler32 produce different values for the same input', () => {
    assert.notEqual(crc32('hello'), adler32('hello'));
  });
});
