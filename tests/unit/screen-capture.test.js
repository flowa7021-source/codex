// ─── Unit Tests: Screen Capture API ──────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isScreenCaptureSupported,
  startScreenCapture,
  stopCapture,
  captureFrame,
  isStreamActive,
} from '../../app/modules/screen-capture.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockTrack(active = true) {
  return {
    readyState: active ? 'live' : 'ended',
    stop() { this.readyState = 'ended'; },
  };
}

function mockStream(tracks = []) {
  const _tracks = tracks.length ? tracks : [mockTrack()];
  return {
    active: true,
    getTracks() { return _tracks; },
    getVideoTracks() { return _tracks; },
  };
}

// ─── beforeEach / afterEach: reset navigator.mediaDevices ────────────────────

beforeEach(() => {
  if (!globalThis.navigator.mediaDevices) {
    globalThis.navigator.mediaDevices = {};
  }
  globalThis.navigator.mediaDevices.getDisplayMedia = async (opts) => mockStream();
});

afterEach(() => {
  delete globalThis.navigator.mediaDevices;
});

// ─── isScreenCaptureSupported ─────────────────────────────────────────────────

describe('isScreenCaptureSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isScreenCaptureSupported(), 'boolean');
  });

  it('returns true when mediaDevices and getDisplayMedia are present', () => {
    assert.equal(isScreenCaptureSupported(), true);
  });

  it('returns false when mediaDevices is absent', () => {
    delete globalThis.navigator.mediaDevices;
    assert.equal(isScreenCaptureSupported(), false);
  });

  it('returns false when getDisplayMedia is absent from mediaDevices', () => {
    globalThis.navigator.mediaDevices = {};
    assert.equal(isScreenCaptureSupported(), false);
  });
});

// ─── startScreenCapture ───────────────────────────────────────────────────────

describe('startScreenCapture', () => {
  it('returns a MediaStream when getDisplayMedia resolves', async () => {
    const stream = await startScreenCapture();
    assert.ok(stream !== null);
    assert.equal(typeof stream.getTracks, 'function');
  });

  it('returns null when getDisplayMedia rejects', async () => {
    globalThis.navigator.mediaDevices.getDisplayMedia = async () => {
      throw new Error('Permission denied');
    };
    const result = await startScreenCapture();
    assert.equal(result, null);
  });

  it('returns null when screen capture is unsupported', async () => {
    delete globalThis.navigator.mediaDevices;
    const result = await startScreenCapture();
    assert.equal(result, null);
  });

  it('passes options to getDisplayMedia', async () => {
    let receivedOpts;
    globalThis.navigator.mediaDevices.getDisplayMedia = async (opts) => {
      receivedOpts = opts;
      return mockStream();
    };
    await startScreenCapture({ video: true, audio: false });
    assert.deepEqual(receivedOpts, { video: true, audio: false });
  });

  it('uses default options { video: true } when none provided', async () => {
    let receivedOpts;
    globalThis.navigator.mediaDevices.getDisplayMedia = async (opts) => {
      receivedOpts = opts;
      return mockStream();
    };
    await startScreenCapture();
    assert.deepEqual(receivedOpts, { video: true });
  });
});

// ─── stopCapture ──────────────────────────────────────────────────────────────

describe('stopCapture', () => {
  it('calls stop() on all tracks in the stream', () => {
    const track1 = mockTrack();
    const track2 = mockTrack();
    const stream = mockStream([track1, track2]);
    stopCapture(stream);
    assert.equal(track1.readyState, 'ended');
    assert.equal(track2.readyState, 'ended');
  });

  it('calls stop() on a single track', () => {
    const track = mockTrack();
    const stream = mockStream([track]);
    stopCapture(stream);
    assert.equal(track.readyState, 'ended');
  });

  it('does not throw when stream has no tracks', () => {
    const emptyStream = {
      active: false,
      getTracks() { return []; },
      getVideoTracks() { return []; },
    };
    assert.doesNotThrow(() => stopCapture(emptyStream));
  });
});

// ─── isStreamActive ───────────────────────────────────────────────────────────

describe('isStreamActive', () => {
  it('returns true when stream.active is true', () => {
    const stream = mockStream();
    stream.active = true;
    assert.equal(isStreamActive(stream), true);
  });

  it('returns false when stream.active is false and all tracks are ended', () => {
    const track = mockTrack(false);
    const stream = {
      active: false,
      getTracks() { return [track]; },
    };
    assert.equal(isStreamActive(stream), false);
  });

  it('returns true when stream.active is false but a track is live', () => {
    const liveTrack = mockTrack(true);
    const stream = {
      active: false,
      getTracks() { return [liveTrack]; },
    };
    assert.equal(isStreamActive(stream), true);
  });

  it('returns false when stream has no tracks and active is false', () => {
    const stream = {
      active: false,
      getTracks() { return []; },
    };
    assert.equal(isStreamActive(stream), false);
  });
});

// ─── captureFrame ─────────────────────────────────────────────────────────────

describe('captureFrame', () => {
  it('returns null when video setup fails (onerror fires)', async () => {
    // Override document.createElement to simulate a video that errors
    const origCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'video') {
        // Make play() reject so the promise rejects and we fall into catch → null
        el.play = () => Promise.reject(new Error('play failed'));
        el.srcObject = null;
        el.onloadedmetadata = null;
        el.onerror = null;
        // Simulate srcObject assignment triggering onerror asynchronously
        Object.defineProperty(el, 'srcObject', {
          set(v) {
            queueMicrotask(() => { if (el.onerror) el.onerror(new Error('no stream')); });
          },
          get() { return null; },
          configurable: true,
        });
      }
      return el;
    };

    const stream = mockStream();
    const result = await captureFrame(stream);
    assert.equal(result, null);

    globalThis.document.createElement = origCreateElement;
  });

  it('returns null when canvas.toBlob returns null', async () => {
    const origCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'video') {
        el.videoWidth = 0;
        el.videoHeight = 0;
        el.width = 0;
        el.height = 0;
        el.play = () => Promise.resolve();
        Object.defineProperty(el, 'srcObject', {
          set(v) {
            queueMicrotask(() => { if (el.onloadedmetadata) el.onloadedmetadata(); });
          },
          get() { return null; },
          configurable: true,
        });
      }
      if (tag === 'canvas') {
        el.toBlob = (cb) => cb(null);
      }
      return el;
    };

    const stream = mockStream();
    const result = await captureFrame(stream);
    assert.equal(result, null);

    globalThis.document.createElement = origCreateElement;
  });

  it('returns a Blob on success', async () => {
    const origCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'video') {
        el.videoWidth = 640;
        el.videoHeight = 480;
        el.width = 640;
        el.height = 480;
        el.play = () => Promise.resolve();
        Object.defineProperty(el, 'srcObject', {
          set(v) {
            queueMicrotask(() => { if (el.onloadedmetadata) el.onloadedmetadata(); });
          },
          get() { return null; },
          configurable: true,
        });
      }
      if (tag === 'canvas') {
        el.toBlob = (cb) => cb(new Blob(['screenshot'], { type: 'image/png' }));
      }
      return el;
    };

    const stream = mockStream();
    const result = await captureFrame(stream);
    assert.ok(result instanceof Blob);

    globalThis.document.createElement = origCreateElement;
  });
});
