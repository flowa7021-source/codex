import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
} from '../../app/modules/sync-encryption.js';

describe('sync-encryption', () => {
  describe('generateSalt()', () => {
    it('returns a 16-byte Uint8Array', () => {
      const salt = generateSalt();
      assert.ok(salt instanceof Uint8Array);
      assert.strictEqual(salt.length, 16);
    });

    it('returns different salts on each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      // Extremely unlikely to be equal
      const equal = salt1.every((b, i) => b === salt2[i]);
      assert.strictEqual(equal, false);
    });
  });

  describe('deriveKey()', () => {
    it('derives a CryptoKey from passphrase and salt', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-passphrase', salt);
      assert.ok(key);
      assert.strictEqual(key.type, 'secret');
    });

    it('throws when passphrase is empty', async () => {
      const salt = generateSalt();
      await assert.rejects(
        () => deriveKey('', salt),
        { message: 'Passphrase is required' },
      );
    });

    it('throws when salt is wrong size', async () => {
      await assert.rejects(
        () => deriveKey('test', new Uint8Array(8)),
        { message: 'Salt must be 16 bytes' },
      );
    });
  });

  describe('encrypt() / decrypt() round-trip', () => {
    it('encrypts and decrypts a string', async () => {
      const salt = generateSalt();
      const key = await deriveKey('my-secret', salt);
      const encrypted = await encrypt('Hello, World!', key);

      assert.ok(encrypted.iv instanceof Uint8Array);
      assert.strictEqual(encrypted.iv.length, 12);
      assert.ok(encrypted.ciphertext instanceof Uint8Array);
      assert.ok(encrypted.ciphertext.length > 0);

      const decrypted = await decrypt(encrypted, key);
      const text = new TextDecoder().decode(decrypted);
      assert.strictEqual(text, 'Hello, World!');
    });

    it('encrypts and decrypts a Uint8Array', async () => {
      const salt = generateSalt();
      const key = await deriveKey('my-secret', salt);
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encrypt(original, key);
      const decrypted = await decrypt(encrypted, key);
      const result = new Uint8Array(decrypted);
      assert.deepStrictEqual([...result], [1, 2, 3, 4, 5]);
    });

    it('encrypts and decrypts an ArrayBuffer', async () => {
      const salt = generateSalt();
      const key = await deriveKey('my-secret', salt);
      const original = new Uint8Array([10, 20, 30]).buffer;
      const encrypted = await encrypt(original, key);
      const decrypted = await decrypt(encrypted, key);
      const result = new Uint8Array(decrypted);
      assert.deepStrictEqual([...result], [10, 20, 30]);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const salt = generateSalt();
      const key = await deriveKey('my-secret', salt);
      const enc1 = await encrypt('same data', key);
      const enc2 = await encrypt('same data', key);
      // IVs should differ
      const ivsEqual = enc1.iv.every((b, i) => b === enc2.iv[i]);
      assert.strictEqual(ivsEqual, false);
    });

    it('fails to decrypt with wrong key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('correct-password', salt);
      const key2 = await deriveKey('wrong-password', salt);
      const encrypted = await encrypt('secret', key1);
      await assert.rejects(() => decrypt(encrypted, key2));
    });
  });
});
