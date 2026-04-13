// ─── Unit Tests: ImageCapture API ────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock ImageCapture ────────────────────────────────────────────────────────
// ImageCapture is NOT available in Node.js — provide a mock before module import.

class MockImageCapture {
  constructor(track) { this.track = track; }
  async takePhoto(opts) { return new Blob(['fake-photo'], { type: 'image/jpeg' }); }
  async grabFrame() { return { width: 640, height: 480, close() {} }; }
  async getPhotoCapabilities() { return { fillLightMode: ['off'], imageHeight: { min: 0, max: 1080 } }; }
}

globalThis.ImageCapture = MockImageCapture;

import {
  isImageCaptureSupported,
  createImageCapture,
  takePhoto,
  grabFrame,
  getPhotoCapabilities,
} from '../../app/modules/image-capture.js';

// ─── Mock track helper ────────────────────────────────────────────────────────

function mockTrack() {
  return { readyState: 'live', stop() { this.readyState = 'ended'; } };
}

// ─── afterEach: restore ImageCapture ─────────────────────────────────────────

afterEach(() => {
  globalThis.ImageCapture = MockImageCapture;
});

// ─── isImageCaptureSupported ──────────────────────────────────────────────────

describe('isImageCaptureSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isImageCaptureSupported(), 'boolean');
  });

  it('returns true when ImageCapture is present', () => {
    assert.equal(isImageCaptureSupported(), true);
  });

  it('returns false when ImageCapture is absent', () => {
    delete globalThis.ImageCapture;
    assert.equal(isImageCaptureSupported(), false);
  });
});

// ─── createImageCapture ───────────────────────────────────────────────────────

describe('createImageCapture', () => {
  it('returns an ImageCapture instance when supported', () => {
    const track = mockTrack();
    const capture = createImageCapture(track);
    assert.ok(capture !== null);
    assert.ok(capture instanceof MockImageCapture);
  });

  it('capture instance holds the track reference', () => {
    const track = mockTrack();
    const capture = createImageCapture(track);
    assert.equal(capture.track, track);
  });

  it('returns null when ImageCapture is unsupported', () => {
    delete globalThis.ImageCapture;
    const track = mockTrack();
    const result = createImageCapture(track);
    assert.equal(result, null);
  });

  it('returns null when ImageCapture constructor throws', () => {
    globalThis.ImageCapture = class {
      constructor() { throw new Error('constructor failed'); }
    };
    const track = mockTrack();
    const result = createImageCapture(track);
    assert.equal(result, null);
  });
});

// ─── takePhoto ────────────────────────────────────────────────────────────────

describe('takePhoto', () => {
  it('returns a Blob when supported', async () => {
    const track = mockTrack();
    const result = await takePhoto(track);
    assert.ok(result instanceof Blob);
  });

  it('returns null when ImageCapture is unsupported', async () => {
    delete globalThis.ImageCapture;
    const track = mockTrack();
    const result = await takePhoto(track);
    assert.equal(result, null);
  });

  it('returns null when takePhoto rejects', async () => {
    globalThis.ImageCapture = class {
      constructor(track) { this.track = track; }
      async takePhoto() { throw new Error('camera busy'); }
    };
    const track = mockTrack();
    const result = await takePhoto(track);
    assert.equal(result, null);
  });

  it('passes options to the underlying takePhoto call', async () => {
    let receivedOpts;
    globalThis.ImageCapture = class {
      constructor(track) { this.track = track; }
      async takePhoto(opts) {
        receivedOpts = opts;
        return new Blob(['data'], { type: 'image/jpeg' });
      }
    };
    const track = mockTrack();
    await takePhoto(track, { imageWidth: 1280, imageHeight: 720 });
    assert.deepEqual(receivedOpts, { imageWidth: 1280, imageHeight: 720 });
  });
});

// ─── grabFrame ────────────────────────────────────────────────────────────────

describe('grabFrame', () => {
  it('returns an ImageBitmap-like object when supported', async () => {
    const track = mockTrack();
    const result = await grabFrame(track);
    assert.ok(result !== null);
    assert.equal(result.width, 640);
    assert.equal(result.height, 480);
  });

  it('returns null when ImageCapture is unsupported', async () => {
    delete globalThis.ImageCapture;
    const track = mockTrack();
    const result = await grabFrame(track);
    assert.equal(result, null);
  });

  it('returns null when grabFrame rejects', async () => {
    globalThis.ImageCapture = class {
      constructor(track) { this.track = track; }
      async grabFrame() { throw new Error('grab failed'); }
    };
    const track = mockTrack();
    const result = await grabFrame(track);
    assert.equal(result, null);
  });
});

// ─── getPhotoCapabilities ─────────────────────────────────────────────────────

describe('getPhotoCapabilities', () => {
  it('returns capabilities object when supported', async () => {
    const track = mockTrack();
    const result = await getPhotoCapabilities(track);
    assert.ok(result !== null);
    assert.ok(Array.isArray(result.fillLightMode));
    assert.equal(typeof result.imageHeight, 'object');
  });

  it('returns null when ImageCapture is unsupported', async () => {
    delete globalThis.ImageCapture;
    const track = mockTrack();
    const result = await getPhotoCapabilities(track);
    assert.equal(result, null);
  });

  it('returns null when getPhotoCapabilities rejects', async () => {
    globalThis.ImageCapture = class {
      constructor(track) { this.track = track; }
      async getPhotoCapabilities() { throw new Error('not supported'); }
    };
    const track = mockTrack();
    const result = await getPhotoCapabilities(track);
    assert.equal(result, null);
  });

  it('capabilities include expected fields', async () => {
    const track = mockTrack();
    const caps = await getPhotoCapabilities(track);
    assert.ok('fillLightMode' in caps);
    assert.ok('imageHeight' in caps);
    assert.equal(caps.imageHeight.min, 0);
    assert.equal(caps.imageHeight.max, 1080);
  });
});
