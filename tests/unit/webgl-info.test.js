// ─── Unit Tests: WebGL Capability Detection ───────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWebGLSupported,
  isWebGL2Supported,
  getWebGLRendererInfo,
  getMaxTextureSize,
  getWebGLCapabilities,
} from '../../app/modules/webgl-info.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let origCreateElement;

beforeEach(() => {
  origCreateElement = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = (tag) => {
    if (tag === 'canvas') {
      return {
        getContext(type) {
          if (type === 'webgl' || type === 'webgl2') {
            return {
              getExtension(name) {
                if (name === 'WEBGL_debug_renderer_info') {
                  return {
                    UNMASKED_RENDERER_WEBGL: 37446,
                    UNMASKED_VENDOR_WEBGL: 37445,
                  };
                }
                return null;
              },
              getParameter(param) {
                if (param === 37446) return 'NVIDIA GeForce RTX 3080';
                if (param === 37445) return 'NVIDIA';
                if (param === 3379) return 16384; // MAX_TEXTURE_SIZE
                return null;
              },
              MAX_TEXTURE_SIZE: 3379,
            };
          }
          return null;
        },
      };
    }
    return origCreateElement(tag);
  };
});

afterEach(() => {
  globalThis.document.createElement = origCreateElement;
});

// ─── isWebGLSupported ─────────────────────────────────────────────────────────

describe('isWebGLSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isWebGLSupported(), 'boolean');
  });

  it('returns true when webgl context is available', () => {
    assert.equal(isWebGLSupported(), true);
  });

  it('returns false when webgl context is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { getContext() { return null; } };
      }
      return origCreateElement(tag);
    };
    assert.equal(isWebGLSupported(), false);
  });

  it('returns false when createElement throws', () => {
    globalThis.document.createElement = () => { throw new Error('no canvas'); };
    assert.equal(isWebGLSupported(), false);
  });
});

// ─── isWebGL2Supported ────────────────────────────────────────────────────────

describe('isWebGL2Supported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isWebGL2Supported(), 'boolean');
  });

  it('returns true when webgl2 context is available', () => {
    assert.equal(isWebGL2Supported(), true);
  });

  it('returns false when webgl2 context is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return {
          getContext(type) {
            if (type === 'webgl2') return null;
            return {};
          },
        };
      }
      return origCreateElement(tag);
    };
    assert.equal(isWebGL2Supported(), false);
  });

  it('returns false when createElement throws', () => {
    globalThis.document.createElement = () => { throw new Error('no canvas'); };
    assert.equal(isWebGL2Supported(), false);
  });
});

// ─── getWebGLRendererInfo ─────────────────────────────────────────────────────

describe('getWebGLRendererInfo', () => {
  it('returns an object with renderer and vendor strings', () => {
    const info = getWebGLRendererInfo();
    assert.ok(info !== null);
    assert.equal(typeof info.renderer, 'string');
    assert.equal(typeof info.vendor, 'string');
  });

  it('returns correct renderer name from mock', () => {
    const info = getWebGLRendererInfo();
    assert.equal(info?.renderer, 'NVIDIA GeForce RTX 3080');
  });

  it('returns correct vendor name from mock', () => {
    const info = getWebGLRendererInfo();
    assert.equal(info?.vendor, 'NVIDIA');
  });

  it('returns null when webgl context is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { getContext() { return null; } };
      }
      return origCreateElement(tag);
    };
    assert.equal(getWebGLRendererInfo(), null);
  });

  it('returns null when WEBGL_debug_renderer_info extension is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return {
          getContext(type) {
            if (type === 'webgl') {
              return { getExtension() { return null; } };
            }
            return null;
          },
        };
      }
      return origCreateElement(tag);
    };
    assert.equal(getWebGLRendererInfo(), null);
  });

  it('returns null when createElement throws', () => {
    globalThis.document.createElement = () => { throw new Error('no canvas'); };
    assert.equal(getWebGLRendererInfo(), null);
  });
});

// ─── getMaxTextureSize ────────────────────────────────────────────────────────

describe('getMaxTextureSize', () => {
  it('returns a number', () => {
    assert.equal(typeof getMaxTextureSize(), 'number');
  });

  it('returns a positive number when WebGL is available', () => {
    assert.ok(getMaxTextureSize() > 0);
  });

  it('returns 16384 from mock', () => {
    assert.equal(getMaxTextureSize(), 16384);
  });

  it('returns 0 when webgl context is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { getContext() { return null; } };
      }
      return origCreateElement(tag);
    };
    assert.equal(getMaxTextureSize(), 0);
  });

  it('returns 0 when createElement throws', () => {
    globalThis.document.createElement = () => { throw new Error('no canvas'); };
    assert.equal(getMaxTextureSize(), 0);
  });
});

// ─── getWebGLCapabilities ─────────────────────────────────────────────────────

describe('getWebGLCapabilities', () => {
  it('returns an object', () => {
    const caps = getWebGLCapabilities();
    assert.ok(typeof caps === 'object' && caps !== null);
  });

  it('returns supported field as boolean', () => {
    const caps = getWebGLCapabilities();
    assert.equal(typeof caps.supported, 'boolean');
  });

  it('returns webgl2 field as boolean', () => {
    const caps = getWebGLCapabilities();
    assert.equal(typeof caps.webgl2, 'boolean');
  });

  it('returns renderer as string when WebGL is available', () => {
    const caps = getWebGLCapabilities();
    assert.equal(typeof caps.renderer, 'string');
  });

  it('returns vendor as string when WebGL is available', () => {
    const caps = getWebGLCapabilities();
    assert.equal(typeof caps.vendor, 'string');
  });

  it('returns maxTextureSize as a positive number when WebGL is available', () => {
    const caps = getWebGLCapabilities();
    assert.ok(typeof caps.maxTextureSize === 'number');
    assert.ok(caps.maxTextureSize > 0);
  });

  it('returns correct values from mock', () => {
    const caps = getWebGLCapabilities();
    assert.equal(caps.supported, true);
    assert.equal(caps.webgl2, true);
    assert.equal(caps.renderer, 'NVIDIA GeForce RTX 3080');
    assert.equal(caps.vendor, 'NVIDIA');
    assert.equal(caps.maxTextureSize, 16384);
  });

  it('returns null renderer and vendor when WebGL is absent', () => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { getContext() { return null; } };
      }
      return origCreateElement(tag);
    };
    const caps = getWebGLCapabilities();
    assert.equal(caps.supported, false);
    assert.equal(caps.renderer, null);
    assert.equal(caps.vendor, null);
    assert.equal(caps.maxTextureSize, 0);
  });

  it('returns object with exactly the expected keys', () => {
    const caps = getWebGLCapabilities();
    const keys = Object.keys(caps).sort();
    assert.deepEqual(keys, ['maxTextureSize', 'renderer', 'supported', 'vendor', 'webgl2']);
  });
});
