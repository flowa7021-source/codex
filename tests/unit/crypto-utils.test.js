// ─── Unit Tests: crypto-utils ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateUUID,
  randomBytes,
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  sha256,
  sha1,
  constantTimeEqual,
} from '../../app/modules/crypto-utils.js';

// ─── generateUUID() ──────────────────────────────────────────────────────────

describe('generateUUID()', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = generateUUID();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('matches the general 36-character UUID pattern', () => {
    const uuid = generateUUID();
    assert.match(uuid, /^[0-9a-f-]{36}$/);
  });

  it('returns unique values on repeated calls', () => {
    const uuids = new Set(Array.from({ length: 10 }, () => generateUUID()));
    assert.equal(uuids.size, 10);
  });
});

// ─── randomBytes() ───────────────────────────────────────────────────────────

describe('randomBytes()', () => {
  it('returns a Uint8Array', () => {
    const bytes = randomBytes(16);
    assert.ok(bytes instanceof Uint8Array);
  });

  it('returns array of correct length', () => {
    assert.equal(randomBytes(0).length, 0);
    assert.equal(randomBytes(1).length, 1);
    assert.equal(randomBytes(32).length, 32);
    assert.equal(randomBytes(100).length, 100);
  });

  it('produces different values on repeated calls', () => {
    const a = randomBytes(16);
    const b = randomBytes(16);
    // Very unlikely to be equal
    const equal = a.every((byte, i) => byte === b[i]);
    assert.ok(!equal);
  });
});

// ─── bytesToHex() / hexToBytes() ─────────────────────────────────────────────

describe('bytesToHex()', () => {
  it('encodes all-zero bytes to all-zero hex', () => {
    assert.equal(bytesToHex(new Uint8Array([0, 0, 0])), '000000');
  });

  it('encodes [255] to "ff"', () => {
    assert.equal(bytesToHex(new Uint8Array([255])), 'ff');
  });

  it('encodes [0, 1, 254, 255] correctly', () => {
    assert.equal(bytesToHex(new Uint8Array([0, 1, 254, 255])), '0001feff');
  });

  it('returns empty string for empty array', () => {
    assert.equal(bytesToHex(new Uint8Array([])), '');
  });
});

describe('hexToBytes()', () => {
  it('decodes "ff" to [255]', () => {
    assert.deepEqual(hexToBytes('ff'), new Uint8Array([255]));
  });

  it('decodes "0001feff" correctly', () => {
    assert.deepEqual(hexToBytes('0001feff'), new Uint8Array([0, 1, 254, 255]));
  });

  it('decodes empty string to empty array', () => {
    assert.deepEqual(hexToBytes(''), new Uint8Array([]));
  });

  it('throws on odd-length hex string', () => {
    assert.throws(() => hexToBytes('abc'), /Invalid hex/);
  });
});

describe('bytesToHex / hexToBytes round-trip', () => {
  it('round-trips random bytes', () => {
    const original = new Uint8Array([10, 20, 128, 200, 255, 0, 1]);
    const hex = bytesToHex(original);
    const recovered = hexToBytes(hex);
    assert.deepEqual(recovered, original);
  });

  it('round-trips all-zero bytes', () => {
    const original = new Uint8Array(8);
    const hex = bytesToHex(original);
    assert.deepEqual(hexToBytes(hex), original);
  });
});

// ─── bytesToBase64() / base64ToBytes() ───────────────────────────────────────

describe('bytesToBase64()', () => {
  it('encodes [72, 101, 108, 108, 111] ("Hello") to base64', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    assert.equal(bytesToBase64(bytes), 'SGVsbG8=');
  });

  it('encodes empty array to empty string', () => {
    assert.equal(bytesToBase64(new Uint8Array([])), '');
  });
});

describe('base64ToBytes()', () => {
  it('decodes "SGVsbG8=" to [72, 101, 108, 108, 111]', () => {
    const expected = new Uint8Array([72, 101, 108, 108, 111]);
    assert.deepEqual(base64ToBytes('SGVsbG8='), expected);
  });

  it('decodes empty string to empty array', () => {
    assert.deepEqual(base64ToBytes(''), new Uint8Array([]));
  });
});

describe('bytesToBase64 / base64ToBytes round-trip', () => {
  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 200, 255]);
    const b64 = bytesToBase64(original);
    const recovered = base64ToBytes(b64);
    assert.deepEqual(recovered, original);
  });

  it('round-trips 32 random-ish bytes', () => {
    const original = new Uint8Array(32).map((_, i) => (i * 37 + 11) % 256);
    const b64 = bytesToBase64(original);
    assert.deepEqual(base64ToBytes(b64), original);
  });
});

// ─── sha256() ────────────────────────────────────────────────────────────────

describe('sha256()', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await sha256('hello');
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('hashes empty string correctly', async () => {
    const hash = await sha256('');
    assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes "hello" correctly', async () => {
    const hash = await sha256('hello');
    assert.equal(hash, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('different inputs produce different hashes', async () => {
    const h1 = await sha256('foo');
    const h2 = await sha256('bar');
    assert.notEqual(h1, h2);
  });
});

// ─── sha1() ──────────────────────────────────────────────────────────────────

describe('sha1()', () => {
  it('returns a 40-character hex string', async () => {
    const hash = await sha1('hello');
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 40);
    assert.match(hash, /^[0-9a-f]{40}$/);
  });

  it('hashes empty string correctly', async () => {
    const hash = await sha1('');
    assert.equal(hash, 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('hashes "hello" correctly', async () => {
    const hash = await sha1('hello');
    assert.equal(hash, 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('different inputs produce different hashes', async () => {
    const h1 = await sha1('foo');
    const h2 = await sha1('bar');
    assert.notEqual(h1, h2);
  });
});

// ─── constantTimeEqual() ─────────────────────────────────────────────────────

describe('constantTimeEqual()', () => {
  it('returns true for identical arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    assert.ok(constantTimeEqual(a, b));
  });

  it('returns true for empty arrays', () => {
    assert.ok(constantTimeEqual(new Uint8Array([]), new Uint8Array([])));
  });

  it('returns false when bytes differ', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    assert.ok(!constantTimeEqual(a, b));
  });

  it('returns false when all bytes differ', () => {
    const a = new Uint8Array([0, 0, 0]);
    const b = new Uint8Array([1, 2, 3]);
    assert.ok(!constantTimeEqual(a, b));
  });

  it('returns false for arrays of different lengths', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    assert.ok(!constantTimeEqual(a, b));
  });

  it('returns false when one array is empty', () => {
    const a = new Uint8Array([]);
    const b = new Uint8Array([0]);
    assert.ok(!constantTimeEqual(a, b));
  });
});
