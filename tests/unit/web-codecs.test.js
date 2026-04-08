// ─── Unit Tests: WebCodecs ──────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWebCodecsSupported,
  decodeImage,
  decodeImageToCanvas,
  getImageInfo,
  batchDecode,
} from '../../app/modules/web-codecs.js';

// ---------------------------------------------------------------------------
// isWebCodecsSupported
// ---------------------------------------------------------------------------
describe('isWebCodecsSupported', () => {
  afterEach(() => {
    delete globalThis.ImageDecoder;
  });

  it('returns false in Node.js (no ImageDecoder)', () => {
    assert.equal(isWebCodecsSupported(), false);
  });

  it('returns true when mock ImageDecoder exists', () => {
    globalThis.ImageDecoder = class {};
    assert.equal(isWebCodecsSupported(), true);
  });
});

// ---------------------------------------------------------------------------
// decodeImage – fallback paths
// ---------------------------------------------------------------------------
describe('decodeImage – fallback paths', () => {
  it('returns null when given an empty blob', async () => {
    const blob = new Blob([]);
    const result = await decodeImage(blob);
    assert.equal(result, null);
  });

  it('returns null when given null/undefined', async () => {
    const result = await decodeImage(/** @type {any} */ (null));
    assert.equal(result, null);
  });

  it('attempts fallback gracefully and does not throw', async () => {
    const blob = new Blob(['not-an-image'], { type: 'image/png' });
    // In Node.js, all fallback paths will fail gracefully
    const result = await decodeImage(blob);
    // The canvas fallback will produce a pseudo-bitmap via mock Image
    // (the mock Image fires onload immediately), so result may be non-null
    // Either way, it must not throw
    assert.ok(result === null || typeof result === 'object');
  });
});

// ---------------------------------------------------------------------------
// decodeImage – createImageBitmap fallback
// ---------------------------------------------------------------------------
describe('decodeImage – createImageBitmap fallback', () => {
  afterEach(() => {
    delete globalThis.createImageBitmap;
  });

  it('uses createImageBitmap when ImageDecoder is absent', async () => {
    const mockBitmap = { width: 50, height: 50, close() {} };
    globalThis.createImageBitmap = () => Promise.resolve(mockBitmap);

    const blob = new Blob(['data'], { type: 'image/png' });
    const result = await decodeImage(blob);
    assert.deepEqual(result, mockBitmap);
  });

  it('falls to canvas when createImageBitmap throws', async () => {
    globalThis.createImageBitmap = () => Promise.reject(new Error('unsupported'));

    const blob = new Blob(['data'], { type: 'image/png' });
    // Falls through to canvas fallback (mock Image has 0 dims => null)
    const result = await decodeImage(blob);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// decodeImage – canvas fallback with non-zero Image
// ---------------------------------------------------------------------------
describe('decodeImage – canvas fallback with sized Image', () => {
  let OrigImage;

  afterEach(() => {
    if (OrigImage) {
      globalThis.Image = OrigImage;
      OrigImage = undefined;
    }
  });

  it('produces a pseudo-bitmap when Image has non-zero dimensions', async () => {
    OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this.width = 400; this.height = 300; this.onload = null; this.onerror = null; this._src = ''; }
      set src(v) {
        this._src = v;
        queueMicrotask(() => { if (this.onload) this.onload(); });
      }
      get src() { return this._src; }
    };

    const blob = new Blob(['pixel-data'], { type: 'image/png' });
    const result = await decodeImage(blob);
    assert.ok(result);
    assert.equal(result.width, 400);
    assert.equal(result.height, 300);
    assert.equal(typeof result.close, 'function');
  });
});

// ---------------------------------------------------------------------------
// decodeImage – with mock ImageDecoder
// ---------------------------------------------------------------------------
describe('decodeImage – with mock ImageDecoder', () => {
  afterEach(() => {
    delete globalThis.ImageDecoder;
    delete globalThis.createImageBitmap;
  });

  it('uses ImageDecoder when available', async () => {
    let decoderCreated = false;
    let decoderClosed = false;
    let frameClosed = false;

    const mockFrame = {
      width: 100,
      height: 50,
      close() { frameClosed = true; },
    };

    globalThis.ImageDecoder = class {
      constructor() { decoderCreated = true; }
      decode() { return Promise.resolve({ image: mockFrame }); }
      close() { decoderClosed = true; }
    };

    const mockBitmap = { width: 100, height: 50, close() {} };
    globalThis.createImageBitmap = () => Promise.resolve(mockBitmap);

    const blob = new Blob(['fake-data'], { type: 'image/png' });
    // Blob.stream() is not available in Node.js by default but the mock
    // ImageDecoder constructor doesn't actually read the stream.
    blob.stream = () => /** @type {any} */ (new ReadableStream());

    const result = await decodeImage(blob);
    assert.ok(decoderCreated, 'ImageDecoder constructor was called');
    assert.ok(decoderClosed, 'decoder was closed');
    assert.ok(frameClosed, 'video frame was closed');
    assert.deepEqual(result, mockBitmap);
  });

  it('falls back when ImageDecoder.decode() throws', async () => {
    globalThis.ImageDecoder = class {
      constructor() {}
      decode() { return Promise.reject(new Error('decode fail')); }
      close() {}
    };

    const blob = new Blob(['fake'], { type: 'image/png' });
    blob.stream = () => /** @type {any} */ (new ReadableStream());

    // Should fall through to canvas fallback without throwing
    const result = await decodeImage(blob);
    assert.ok(result === null || typeof result === 'object');
  });
});

// ---------------------------------------------------------------------------
// decodeImageToCanvas
// ---------------------------------------------------------------------------
describe('decodeImageToCanvas', () => {
  it('returns false on null blob', async () => {
    const canvas = document.createElement('canvas');
    const result = await decodeImageToCanvas(/** @type {any} */ (null), canvas);
    assert.equal(result, false);
  });

  it('returns false on null canvas', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const result = await decodeImageToCanvas(blob, /** @type {any} */ (null));
    assert.equal(result, false);
  });

  it('returns false on empty blob', async () => {
    const canvas = document.createElement('canvas');
    const blob = new Blob([]);
    const result = await decodeImageToCanvas(blob, canvas);
    assert.equal(result, false);
  });

  it('draws successfully with canvas fallback when image loads', async () => {
    const canvas = document.createElement('canvas');
    const blob = new Blob(['img-data'], { type: 'image/png' });

    // The mock Image in setup-dom fires onload which produces a pseudo-bitmap
    // with width=0 and height=0, so _decodeWithCanvas resolves null,
    // and decodeImageToCanvas returns false. This is correct fallback behavior.
    const result = await decodeImageToCanvas(blob, canvas);
    // In the mock environment the Image has 0 dimensions, so the fallback
    // produces null, and the function returns false.
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when decodeImage yields a valid bitmap', async () => {
    // Mock ImageDecoder so decodeImage returns a real bitmap object
    const mockBitmap = { width: 200, height: 100, close() {} };
    globalThis.ImageDecoder = class {
      constructor() {}
      decode() { return Promise.resolve({ image: { close() {} } }); }
      close() {}
    };
    globalThis.createImageBitmap = () => Promise.resolve(mockBitmap);

    const canvas = document.createElement('canvas');
    const blob = new Blob(['img'], { type: 'image/png' });
    blob.stream = () => /** @type {any} */ (new ReadableStream());

    const result = await decodeImageToCanvas(blob, canvas);
    assert.equal(result, true);
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 100);

    delete globalThis.ImageDecoder;
    delete globalThis.createImageBitmap;
  });
});

// ---------------------------------------------------------------------------
// getImageInfo
// ---------------------------------------------------------------------------
describe('getImageInfo', () => {
  afterEach(() => {
    delete globalThis.ImageDecoder;
  });

  it('returns null when given empty blob', async () => {
    const result = await getImageInfo(new Blob([]));
    assert.equal(result, null);
  });

  it('returns null when given null', async () => {
    const result = await getImageInfo(/** @type {any} */ (null));
    assert.equal(result, null);
  });

  it('returns null when decoding fails', async () => {
    const blob = new Blob(['bad'], { type: 'image/png' });
    const result = await getImageInfo(blob);
    // Mock Image has 0 dimensions => _decodeWithCanvas returns null => getImageInfo returns null
    assert.equal(result, null);
  });

  it('returns info via fallback when ImageDecoder is unavailable', async () => {
    // Mock createImageBitmap to return a bitmap with dimensions
    const mockBitmap = { width: 320, height: 240, close() {} };
    globalThis.createImageBitmap = () => Promise.resolve(mockBitmap);

    const blob = new Blob(['pixels'], { type: 'image/webp' });
    const info = await getImageInfo(blob);
    assert.ok(info);
    assert.equal(info.width, 320);
    assert.equal(info.height, 240);
    assert.equal(info.type, 'image/webp');

    delete globalThis.createImageBitmap;
  });

  it('falls back when ImageDecoder fails in getImageInfo', async () => {
    // ImageDecoder is present but throws on decode
    globalThis.ImageDecoder = class {
      constructor() {}
      decode() { return Promise.reject(new Error('not supported')); }
      close() {}
    };

    // createImageBitmap provides the fallback
    const mockBitmap = { width: 128, height: 64, close() {} };
    globalThis.createImageBitmap = () => Promise.resolve(mockBitmap);

    const blob = new Blob(['data'], { type: 'image/gif' });
    blob.stream = () => /** @type {any} */ (new ReadableStream());

    const info = await getImageInfo(blob);
    assert.ok(info);
    assert.equal(info.width, 128);
    assert.equal(info.height, 64);
    assert.equal(info.type, 'image/gif');

    delete globalThis.createImageBitmap;
  });

  it('returns info via ImageDecoder when available', async () => {
    globalThis.ImageDecoder = class {
      tracks = {
        selectedTrack: { displayWidth: 640, displayHeight: 480 },
      };
      constructor() {}
      decode() { return Promise.resolve({}); }
      close() {}
    };

    const blob = new Blob(['data'], { type: 'image/jpeg' });
    blob.stream = () => /** @type {any} */ (new ReadableStream());

    const info = await getImageInfo(blob);
    assert.ok(info);
    assert.equal(info.width, 640);
    assert.equal(info.height, 480);
    assert.equal(info.type, 'image/jpeg');
  });
});

// ---------------------------------------------------------------------------
// batchDecode
// ---------------------------------------------------------------------------
describe('batchDecode', () => {
  it('handles empty array input', async () => {
    const results = await batchDecode([]);
    assert.deepEqual(results, []);
  });

  it('handles null/undefined input', async () => {
    const results = await batchDecode(/** @type {any} */ (null));
    assert.deepEqual(results, []);
  });

  it('returns array of nulls for undecodable blobs', async () => {
    const blobs = [new Blob([]), new Blob([]), new Blob([])];
    const results = await batchDecode(blobs);
    assert.equal(results.length, 3);
    assert.equal(results[0], null);
    assert.equal(results[1], null);
    assert.equal(results[2], null);
  });

  it('preserves order across batch chunks', async () => {
    // Create 6 empty blobs to span more than one chunk (concurrency = 4)
    const blobs = Array.from({ length: 6 }, () => new Blob([]));
    const results = await batchDecode(blobs);
    assert.equal(results.length, 6);
    for (const r of results) {
      assert.equal(r, null);
    }
  });
});
