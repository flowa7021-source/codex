// ─── Unit Tests: Loaders ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPdfjsLib,
  preloadPdfRuntime,
} from '../../app/modules/loaders.js';

describe('getPdfjsLib', () => {
  it('is a function', () => {
    assert.equal(typeof getPdfjsLib, 'function');
  });

  it('returns null before any PDF is loaded', () => {
    const lib = getPdfjsLib();
    assert.equal(lib, null);
  });
});

describe('preloadPdfRuntime', () => {
  it('is a function', () => {
    assert.equal(typeof preloadPdfRuntime, 'function');
  });

  it('does not throw when called', () => {
    // preloadPdfRuntime schedules an async task; should not throw synchronously
    assert.doesNotThrow(() => {
      preloadPdfRuntime();
    });
  });

  it('can be called multiple times without error', () => {
    assert.doesNotThrow(() => {
      preloadPdfRuntime();
      preloadPdfRuntime();
    });
  });
});
