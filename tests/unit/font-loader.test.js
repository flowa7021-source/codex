// ─── Unit Tests: Font Loader API ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isFontLoadingSupported,
  waitForFont,
  waitForFonts,
  isFontLoaded,
  onFontLoad,
} from '../../app/modules/font-loader.js';

// ─── Mock FontFaceSet ─────────────────────────────────────────────────────────

/** Build a fresh mock document.fonts object for each test. */
function createFontsMock(overrides = {}) {
  const listeners = {};
  return {
    load: async () => [],
    check: () => false,
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
    },
    /** Helper: fire a 'loadingdone' event with the given font faces. */
    _fire(type, fontfaces = []) {
      for (const fn of (listeners[type] || [])) {
        fn({ fontfaces });
      }
    },
    _listeners: listeners,
    ...overrides,
  };
}

// ─── beforeEach: reset document.fonts ────────────────────────────────────────

beforeEach(() => {
  document.fonts = createFontsMock();
});

// ─── isFontLoadingSupported ───────────────────────────────────────────────────

describe('isFontLoadingSupported', () => {
  it('returns a boolean', () => {
    const result = isFontLoadingSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when document.fonts is present', () => {
    assert.equal(isFontLoadingSupported(), true);
  });

  it('returns false when document.fonts is absent', () => {
    const orig = document.fonts;
    delete document.fonts;
    assert.equal(isFontLoadingSupported(), false);
    document.fonts = orig;
  });
});

// ─── waitForFont ──────────────────────────────────────────────────────────────

describe('waitForFont', () => {
  it('resolves with an object having family and loaded properties', async () => {
    document.fonts = createFontsMock({ load: async () => [] });
    const result = await waitForFont('Arial');
    assert.equal(typeof result.family, 'string');
    assert.equal(typeof result.loaded, 'boolean');
  });

  it('returns loaded: true when fonts.load resolves successfully', async () => {
    document.fonts = createFontsMock({ load: async () => [{ family: 'Arial' }] });
    const result = await waitForFont('Arial');
    assert.equal(result.family, 'Arial');
    assert.equal(result.loaded, true);
  });

  it('returns loaded: false on timeout', async () => {
    // fonts.load never resolves within the timeout
    document.fonts = createFontsMock({
      load: () => new Promise(() => {}), // never resolves
    });
    const result = await waitForFont('SlowFont', { timeout: 20 });
    assert.equal(result.family, 'SlowFont');
    assert.equal(result.loaded, false);
    assert.ok(typeof result.error === 'string' && result.error.length > 0);
  });

  it('returns loaded: false when fonts.load rejects', async () => {
    document.fonts = createFontsMock({
      load: async () => { throw new Error('load failed'); },
    });
    const result = await waitForFont('BadFont');
    assert.equal(result.family, 'BadFont');
    assert.equal(result.loaded, false);
    assert.ok(result.error.includes('load failed'));
  });

  it('returns loaded: false when API is not supported', async () => {
    const orig = document.fonts;
    delete document.fonts;
    const result = await waitForFont('Arial');
    assert.equal(result.loaded, false);
    assert.ok(typeof result.error === 'string');
    document.fonts = orig;
  });

  it('passes weight and style options in the font descriptor', async () => {
    let capturedDescriptor = '';
    document.fonts = createFontsMock({
      load: async (desc) => { capturedDescriptor = desc; return []; },
    });
    await waitForFont('Roboto', { weight: '700', style: 'italic' });
    assert.ok(capturedDescriptor.includes('700'), `Expected weight in descriptor: "${capturedDescriptor}"`);
    assert.ok(capturedDescriptor.includes('italic'), `Expected style in descriptor: "${capturedDescriptor}"`);
    assert.ok(capturedDescriptor.includes('Roboto'), `Expected family in descriptor: "${capturedDescriptor}"`);
  });
});

// ─── waitForFonts ─────────────────────────────────────────────────────────────

describe('waitForFonts', () => {
  it('returns empty array for empty input', async () => {
    const result = await waitForFonts([]);
    assert.deepEqual(result, []);
  });

  it('returns array of results for multiple families', async () => {
    document.fonts = createFontsMock({ load: async () => [] });
    const result = await waitForFonts(['Arial', 'Georgia']);
    assert.equal(result.length, 2);
    assert.equal(result[0].family, 'Arial');
    assert.equal(result[1].family, 'Georgia');
  });

  it('each result has loaded property', async () => {
    document.fonts = createFontsMock({ load: async () => [] });
    const result = await waitForFonts(['FontA', 'FontB']);
    for (const r of result) {
      assert.equal(typeof r.loaded, 'boolean');
    }
  });

  it('results preserve input order', async () => {
    document.fonts = createFontsMock({ load: async () => [] });
    const families = ['Courier', 'Verdana', 'Helvetica'];
    const result = await waitForFonts(families);
    assert.equal(result.length, families.length);
    for (let i = 0; i < families.length; i++) {
      assert.equal(result[i].family, families[i]);
    }
  });
});

// ─── isFontLoaded ─────────────────────────────────────────────────────────────

describe('isFontLoaded', () => {
  it('returns a boolean', () => {
    const result = isFontLoaded('Arial');
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when document.fonts.check returns false', () => {
    document.fonts = createFontsMock({ check: () => false });
    assert.equal(isFontLoaded('Arial'), false);
  });

  it('returns true when document.fonts.check returns true', () => {
    document.fonts = createFontsMock({ check: () => true });
    assert.equal(isFontLoaded('Arial'), true);
  });

  it('returns false when API is absent', () => {
    const orig = document.fonts;
    delete document.fonts;
    assert.equal(isFontLoaded('Arial'), false);
    document.fonts = orig;
  });

  it('returns false when check throws', () => {
    document.fonts = createFontsMock({ check: () => { throw new Error('check error'); } });
    assert.equal(isFontLoaded('Arial'), false);
  });
});

// ─── onFontLoad ───────────────────────────────────────────────────────────────

describe('onFontLoad', () => {
  it('returns a function (unsubscribe)', () => {
    const unsub = onFontLoad(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('calls handler when loadingdone event fires', () => {
    const mock = createFontsMock();
    document.fonts = mock;
    const received = [];
    onFontLoad((face) => received.push(face));
    mock._fire('loadingdone', [{ family: 'Arial' }]);
    assert.equal(received.length, 1);
    assert.equal(received[0].family, 'Arial');
  });

  it('calls handler for each font face in the event', () => {
    const mock = createFontsMock();
    document.fonts = mock;
    const received = [];
    onFontLoad((face) => received.push(face.family));
    mock._fire('loadingdone', [{ family: 'Arial' }, { family: 'Georgia' }]);
    assert.equal(received.length, 2);
    assert.ok(received.includes('Arial'));
    assert.ok(received.includes('Georgia'));
  });

  it('unsubscribing prevents handler calls', () => {
    const mock = createFontsMock();
    document.fonts = mock;
    const received = [];
    const unsub = onFontLoad((face) => received.push(face));
    mock._fire('loadingdone', [{ family: 'Arial' }]);
    assert.equal(received.length, 1);
    unsub();
    mock._fire('loadingdone', [{ family: 'Roboto' }]);
    assert.equal(received.length, 1, 'handler should not fire after unsubscribe');
  });

  it('returns a no-op unsubscribe function when API is not supported', () => {
    const orig = document.fonts;
    delete document.fonts;
    let unsub;
    assert.doesNotThrow(() => { unsub = onFontLoad(() => {}); });
    assert.equal(typeof unsub, 'function');
    assert.doesNotThrow(() => unsub());
    document.fonts = orig;
  });

  it('multiple subscribers each receive events independently', () => {
    const mock = createFontsMock();
    document.fonts = mock;
    const received1 = [];
    const received2 = [];
    onFontLoad((face) => received1.push(face.family));
    onFontLoad((face) => received2.push(face.family));
    mock._fire('loadingdone', [{ family: 'TestFont' }]);
    assert.equal(received1.length, 1);
    assert.equal(received2.length, 1);
  });
});
