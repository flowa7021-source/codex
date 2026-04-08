// ─── Unit Tests: EyeDropper API ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isEyeDropperSupported,
  pickColor,
  pickColorHex,
  hexToRgb,
  rgbToHex,
} from '../../app/modules/eye-dropper.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Install a mock EyeDropper on globalThis. */
function installMockEyeDropper(impl = {}) {
  globalThis.EyeDropper = class EyeDropper {
    open() {
      return Promise.resolve({ sRGBHex: '#aabbcc' });
    }
    ...impl
  };
}

/** Remove mock EyeDropper from globalThis. */
function removeMockEyeDropper() {
  delete globalThis.EyeDropper;
}

// ─── beforeEach / afterEach ───────────────────────────────────────────────────

beforeEach(() => {
  removeMockEyeDropper();
});

afterEach(() => {
  removeMockEyeDropper();
});

// ─── isEyeDropperSupported ────────────────────────────────────────────────────

describe('isEyeDropperSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isEyeDropperSupported(), 'boolean');
  });

  it('returns false when EyeDropper is absent', () => {
    // EyeDropper not present (removed in beforeEach)
    assert.equal(isEyeDropperSupported(), false);
  });

  it('returns true when EyeDropper is present', () => {
    globalThis.EyeDropper = class EyeDropper {
      open() { return Promise.resolve({ sRGBHex: '#aabbcc' }); }
    };
    assert.equal(isEyeDropperSupported(), true);
  });
});

// ─── pickColor ────────────────────────────────────────────────────────────────

describe('pickColor', () => {
  it('returns null when EyeDropper is unsupported', async () => {
    // EyeDropper not present
    const result = await pickColor();
    assert.equal(result, null);
  });

  it('returns a ColorResult from mock EyeDropper', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() { return Promise.resolve({ sRGBHex: '#aabbcc' }); }
    };
    const result = await pickColor();
    assert.ok(result !== null);
    assert.equal(result.sRGBHex, '#aabbcc');
  });

  it('returns null on AbortError (user cancels)', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() {
        const err = new Error('User cancelled');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
    };
    const result = await pickColor();
    assert.equal(result, null);
  });

  it('returns null when open() rejects with a generic error', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() { return Promise.reject(new Error('hardware failure')); }
    };
    const result = await pickColor();
    assert.equal(result, null);
  });

  it('passes signal to EyeDropper.open()', async () => {
    let capturedSignal = undefined;
    globalThis.EyeDropper = class EyeDropper {
      open(opts) {
        capturedSignal = opts?.signal;
        return Promise.resolve({ sRGBHex: '#112233' });
      }
    };
    const controller = new AbortController();
    await pickColor(controller.signal);
    assert.equal(capturedSignal, controller.signal);
  });

  it('returns the correct sRGBHex value from mock', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() { return Promise.resolve({ sRGBHex: '#ff0000' }); }
    };
    const result = await pickColor();
    assert.equal(result?.sRGBHex, '#ff0000');
  });
});

// ─── pickColorHex ─────────────────────────────────────────────────────────────

describe('pickColorHex', () => {
  it('returns null when EyeDropper is unsupported', async () => {
    const result = await pickColorHex();
    assert.equal(result, null);
  });

  it('returns the hex string from mock', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() { return Promise.resolve({ sRGBHex: '#aabbcc' }); }
    };
    const result = await pickColorHex();
    assert.equal(result, '#aabbcc');
  });

  it('returns null on AbortError', async () => {
    globalThis.EyeDropper = class EyeDropper {
      open() {
        const err = new Error('User aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
    };
    const result = await pickColorHex();
    assert.equal(result, null);
  });
});

// ─── hexToRgb ─────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses #ff0000 to { r:255, g:0, b:0 }', () => {
    assert.deepEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses short form #f00 to { r:255, g:0, b:0 }', () => {
    assert.deepEqual(hexToRgb('#f00'), { r: 255, g: 0, b: 0 });
  });

  it('parses #00ff00 to { r:0, g:255, b:0 }', () => {
    assert.deepEqual(hexToRgb('#00ff00'), { r: 0, g: 255, b: 0 });
  });

  it('parses #0000ff to { r:0, g:0, b:255 }', () => {
    assert.deepEqual(hexToRgb('#0000ff'), { r: 0, g: 0, b: 255 });
  });

  it('parses uppercase #FF0000 to { r:255, g:0, b:0 }', () => {
    assert.deepEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses mixed case #aAbBcC', () => {
    const result = hexToRgb('#aAbBcC');
    assert.ok(result !== null);
    assert.equal(result.r, 0xaa);
    assert.equal(result.g, 0xbb);
    assert.equal(result.b, 0xcc);
  });

  it('returns null for invalid hex string "notacolor"', () => {
    assert.equal(hexToRgb('notacolor'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(hexToRgb(''), null);
  });

  it('returns null for too-short hex "#12"', () => {
    assert.equal(hexToRgb('#12'), null);
  });

  it('returns null for too-long hex "#1234567"', () => {
    assert.equal(hexToRgb('#1234567'), null);
  });

  it('parses #000000 to { r:0, g:0, b:0 }', () => {
    assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  });

  it('parses #ffffff to { r:255, g:255, b:255 }', () => {
    assert.deepEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 });
  });
});

// ─── rgbToHex ─────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts 255,0,0 to "#ff0000"', () => {
    assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  });

  it('converts 0,0,0 to "#000000"', () => {
    assert.equal(rgbToHex(0, 0, 0), '#000000');
  });

  it('converts 255,255,255 to "#ffffff"', () => {
    assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  });

  it('converts 170,187,204 to "#aabbcc"', () => {
    assert.equal(rgbToHex(170, 187, 204), '#aabbcc');
  });

  it('clamps values above 255', () => {
    assert.equal(rgbToHex(300, 0, 0), '#ff0000');
  });

  it('clamps values below 0', () => {
    assert.equal(rgbToHex(-10, 0, 0), '#000000');
  });
});
