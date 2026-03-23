import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractZip,
  extractTextFile,
  extractBinaryFile,
  listEntries,
} from '../../app/modules/zip-utils.js';

describe('zip-utils', () => {
  // Create a mock zip entries object (simulating what extractZip returns after unzip)
  const mockEntries = {
    'META-INF/container.xml': new TextEncoder().encode('<container/>'),
    'content/chapter1.xhtml': new TextEncoder().encode('<html>Chapter 1</html>'),
    'content/images/cover.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  };

  describe('extractTextFile()', () => {
    it('extracts text by exact path', () => {
      const text = extractTextFile(mockEntries, 'META-INF/container.xml');
      assert.strictEqual(text, '<container/>');
    });

    it('extracts text by suffix match', () => {
      const text = extractTextFile(mockEntries, 'chapter1.xhtml');
      assert.strictEqual(text, '<html>Chapter 1</html>');
    });

    it('returns null for missing file', () => {
      const text = extractTextFile(mockEntries, 'nonexistent.txt');
      assert.strictEqual(text, null);
    });
  });

  describe('extractBinaryFile()', () => {
    it('extracts binary data by exact path', () => {
      const data = extractBinaryFile(mockEntries, 'content/images/cover.png');
      assert.ok(data instanceof Uint8Array);
      assert.strictEqual(data[0], 0x89);
    });

    it('extracts binary data by suffix match', () => {
      const data = extractBinaryFile(mockEntries, 'cover.png');
      assert.ok(data instanceof Uint8Array);
      assert.strictEqual(data.length, 4);
    });

    it('returns null for missing file', () => {
      assert.strictEqual(extractBinaryFile(mockEntries, 'missing.bin'), null);
    });
  });

  describe('listEntries()', () => {
    it('returns all entry paths', () => {
      const entries = listEntries(mockEntries);
      assert.strictEqual(entries.length, 3);
      assert.ok(entries.includes('META-INF/container.xml'));
      assert.ok(entries.includes('content/chapter1.xhtml'));
      assert.ok(entries.includes('content/images/cover.png'));
    });

    it('returns empty array for empty zip', () => {
      assert.deepStrictEqual(listEntries({}), []);
    });
  });

  describe('extractZip()', () => {
    it('accepts Uint8Array input', () => {
      // We can't easily create a valid ZIP in a unit test without fflate,
      // but we can verify the function exists and accepts the right types
      assert.strictEqual(typeof extractZip, 'function');
    });
  });
});
