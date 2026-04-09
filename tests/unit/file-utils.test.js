// ─── Unit Tests: file-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readAsText,
  readAsArrayBuffer,
  blobToBytes,
  textToBlob,
  bytesToBlob,
  getExtension,
  getBasename,
  formatFileSize,
  isFileSizeOk,
} from '../../app/modules/file-utils.js';

// Node 18+ has Blob globally — no mocking needed.

// ─── readAsText ───────────────────────────────────────────────────────────────

describe('readAsText', () => {
  it('reads text from a Blob', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const text = await readAsText(blob);
    assert.equal(text, 'hello world');
  });

  it('reads UTF-8 text correctly', async () => {
    const blob = new Blob(['café ☕'], { type: 'text/plain' });
    const text = await readAsText(blob);
    assert.equal(text, 'café ☕');
  });

  it('reads empty Blob as empty string', async () => {
    const blob = new Blob([], { type: 'text/plain' });
    const text = await readAsText(blob);
    assert.equal(text, '');
  });
});

// ─── readAsArrayBuffer ────────────────────────────────────────────────────────

describe('readAsArrayBuffer', () => {
  it('returns an ArrayBuffer', async () => {
    const blob = new Blob(['abc']);
    const buf = await readAsArrayBuffer(blob);
    assert.ok(buf instanceof ArrayBuffer);
  });

  it('buffer has correct byte length', async () => {
    const blob = new Blob(['hello']);
    const buf = await readAsArrayBuffer(blob);
    assert.equal(buf.byteLength, 5);
  });

  it('buffer contains correct bytes', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const buf = await readAsArrayBuffer(blob);
    const view = new Uint8Array(buf);
    assert.deepEqual(Array.from(view), [1, 2, 3]);
  });
});

// ─── blobToBytes ──────────────────────────────────────────────────────────────

describe('blobToBytes', () => {
  it('returns a Uint8Array', async () => {
    const blob = new Blob(['abc']);
    const bytes = await blobToBytes(blob);
    assert.ok(bytes instanceof Uint8Array);
  });

  it('has correct length', async () => {
    const blob = new Blob(['hello']);
    const bytes = await blobToBytes(blob);
    assert.equal(bytes.length, 5);
  });

  it('contains correct byte values', async () => {
    const input = new Uint8Array([10, 20, 30, 40]);
    const blob = new Blob([input]);
    const bytes = await blobToBytes(blob);
    assert.deepEqual(Array.from(bytes), [10, 20, 30, 40]);
  });

  it('handles empty Blob', async () => {
    const blob = new Blob([]);
    const bytes = await blobToBytes(blob);
    assert.equal(bytes.length, 0);
  });
});

// ─── textToBlob ───────────────────────────────────────────────────────────────

describe('textToBlob', () => {
  it('creates a Blob from text', () => {
    const blob = textToBlob('hello');
    assert.ok(blob instanceof Blob);
  });

  it('created Blob has correct size', () => {
    const blob = textToBlob('hello');
    assert.equal(blob.size, 5);
  });

  it('uses text/plain as default MIME type', () => {
    const blob = textToBlob('test');
    assert.equal(blob.type, 'text/plain');
  });

  it('uses provided MIME type', () => {
    const blob = textToBlob('<p>hi</p>', 'text/html');
    assert.equal(blob.type, 'text/html');
  });

  it('roundtrips text correctly', async () => {
    const original = 'roundtrip test';
    const blob = textToBlob(original);
    const result = await readAsText(blob);
    assert.equal(result, original);
  });
});

// ─── bytesToBlob ──────────────────────────────────────────────────────────────

describe('bytesToBlob', () => {
  it('creates a Blob from Uint8Array', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = bytesToBlob(bytes);
    assert.ok(blob instanceof Blob);
  });

  it('created Blob has correct size', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = bytesToBlob(bytes);
    assert.equal(blob.size, 5);
  });

  it('uses application/octet-stream as default MIME type', () => {
    const blob = bytesToBlob(new Uint8Array([0]));
    assert.equal(blob.type, 'application/octet-stream');
  });

  it('uses provided MIME type', () => {
    const blob = bytesToBlob(new Uint8Array([0]), 'image/png');
    assert.equal(blob.type, 'image/png');
  });

  it('roundtrips bytes correctly', async () => {
    const original = new Uint8Array([42, 0, 255, 128]);
    const blob = bytesToBlob(original);
    const result = await blobToBytes(blob);
    assert.deepEqual(Array.from(result), Array.from(original));
  });
});

// ─── getExtension ─────────────────────────────────────────────────────────────

describe('getExtension', () => {
  it("returns 'pdf' for 'file.pdf'", () => {
    assert.equal(getExtension('file.pdf'), 'pdf');
  });

  it("returns 'gz' for 'archive.tar.gz'", () => {
    assert.equal(getExtension('archive.tar.gz'), 'gz');
  });

  it("returns 'jpeg' for 'image.jpeg'", () => {
    assert.equal(getExtension('image.jpeg'), 'jpeg');
  });

  it("returns '' for 'file' (no extension)", () => {
    assert.equal(getExtension('file'), '');
  });

  it("returns '' for '.dotfile'", () => {
    assert.equal(getExtension('.dotfile'), '');
  });

  it("returns '' for empty string", () => {
    assert.equal(getExtension(''), '');
  });

  it("returns '' for 'file.'", () => {
    assert.equal(getExtension('file.'), '');
  });

  it("returns 'js' for 'app.min.js'", () => {
    assert.equal(getExtension('app.min.js'), 'js');
  });
});

// ─── getBasename ──────────────────────────────────────────────────────────────

describe('getBasename', () => {
  it("returns 'file' for 'file.pdf'", () => {
    assert.equal(getBasename('file.pdf'), 'file');
  });

  it("returns 'archive.tar' for 'archive.tar.gz'", () => {
    assert.equal(getBasename('archive.tar.gz'), 'archive.tar');
  });

  it("returns 'file' for 'file' (no extension)", () => {
    assert.equal(getBasename('file'), 'file');
  });

  it("returns '.dotfile' for '.dotfile'", () => {
    assert.equal(getBasename('.dotfile'), '.dotfile');
  });

  it("returns 'app.min' for 'app.min.js'", () => {
    assert.equal(getBasename('app.min.js'), 'app.min');
  });
});

// ─── formatFileSize ───────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it("returns '0 B' for 0 bytes", () => {
    assert.equal(formatFileSize(0), '0 B');
  });

  it("returns '1 KB' for 1024 bytes", () => {
    assert.equal(formatFileSize(1024), '1 KB');
  });

  it("returns '1 MB' for 1048576 bytes", () => {
    assert.equal(formatFileSize(1048576), '1 MB');
  });

  it("returns '1 GB' for 1073741824 bytes", () => {
    assert.equal(formatFileSize(1073741824), '1 GB');
  });

  it("returns '1.5 MB' for 1572864 bytes", () => {
    assert.equal(formatFileSize(1572864), '1.5 MB');
  });

  it("returns '1 B' for 1 byte", () => {
    assert.equal(formatFileSize(1), '1 B');
  });

  it("returns '500 B' for 500 bytes", () => {
    assert.equal(formatFileSize(500), '500 B');
  });

  it("returns '1.5 KB' for 1536 bytes", () => {
    assert.equal(formatFileSize(1536), '1.5 KB');
  });
});

// ─── isFileSizeOk ─────────────────────────────────────────────────────────────

describe('isFileSizeOk', () => {
  it('returns true when file size equals the limit', () => {
    assert.equal(isFileSizeOk({ size: 1000 }, 1000), true);
  });

  it('returns true when file size is within limit', () => {
    assert.equal(isFileSizeOk({ size: 500 }, 1000), true);
  });

  it('returns false when file size exceeds limit', () => {
    assert.equal(isFileSizeOk({ size: 1001 }, 1000), false);
  });

  it('returns true for zero-size file', () => {
    assert.equal(isFileSizeOk({ size: 0 }, 0), true);
  });

  it('returns false when limit is 0 and file is non-empty', () => {
    assert.equal(isFileSizeOk({ size: 1 }, 0), false);
  });

  it('works with large file sizes', () => {
    const tenMB = 10 * 1024 * 1024;
    const fiveMB = 5 * 1024 * 1024;
    assert.equal(isFileSizeOk({ size: fiveMB }, tenMB), true);
    assert.equal(isFileSizeOk({ size: tenMB + 1 }, tenMB), false);
  });
});
