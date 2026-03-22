// ─── Unit Tests: TesseractAdapter ───────────────────────────────────────────
// Tests pure/synchronous exported functions that don't require the actual
// Tesseract.js WASM engine.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getRecommendedPoolSize,
  getTesseractStatus,
  resetTesseractAvailability,
  isTesseractPoolReady,
  getAvailableTesseractLangs,
} from '../../app/modules/tesseract-adapter.js';

// ── getRecommendedPoolSize ──────────────────────────────────────────────────

describe('getRecommendedPoolSize', () => {
  it('returns a number between 2 and 4', () => {
    const size = getRecommendedPoolSize();
    assert.ok(typeof size === 'number');
    assert.ok(size >= 2);
    assert.ok(size <= 4);
  });

  it('returns at least 2 even with low hardwareConcurrency', () => {
    const orig = navigator.hardwareConcurrency;
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 1, configurable: true });
    try {
      const size = getRecommendedPoolSize();
      assert.ok(size >= 2);
    } finally {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: orig, configurable: true });
    }
  });

  it('caps at 4 even with many cores', () => {
    const orig = navigator.hardwareConcurrency;
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 32, configurable: true });
    try {
      const size = getRecommendedPoolSize();
      assert.ok(size <= 4);
    } finally {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: orig, configurable: true });
    }
  });
});

// ── getTesseractStatus ──────────────────────────────────────────────────────

describe('getTesseractStatus', () => {
  it('returns an object with expected properties', () => {
    const status = getTesseractStatus();
    assert.equal(typeof status, 'object');
    assert.equal(typeof status.ready, 'boolean');
    assert.ok('lang' in status);
    assert.ok('available' in status);
    assert.equal(typeof status.initFailCount, 'number');
    assert.equal(typeof status.lastError, 'string');
    assert.equal(typeof status.poolReady, 'boolean');
    assert.equal(typeof status.poolSize, 'number');
  });

  it('reports not ready when no worker is initialized', () => {
    const status = getTesseractStatus();
    assert.equal(status.ready, false);
    assert.equal(status.lang, null);
  });
});

// ── isTesseractPoolReady ────────────────────────────────────────────────────

describe('isTesseractPoolReady', () => {
  it('returns false when no pool is initialized', () => {
    assert.equal(isTesseractPoolReady(), false);
  });
});

// ── resetTesseractAvailability ──────────────────────────────────────────────

describe('resetTesseractAvailability', () => {
  it('does not throw', () => {
    resetTesseractAvailability();
    // After reset, status should reflect cleared fail count
    const status = getTesseractStatus();
    assert.equal(status.initFailCount, 0);
    assert.equal(status.lastError, '');
  });

  it('can be called multiple times safely', () => {
    resetTesseractAvailability();
    resetTesseractAvailability();
    resetTesseractAvailability();
    assert.equal(getTesseractStatus().initFailCount, 0);
  });
});

// ── getAvailableTesseractLangs ──────────────────────────────────────────────

describe('getAvailableTesseractLangs', () => {
  it('returns an array of language codes', () => {
    const langs = getAvailableTesseractLangs();
    assert.ok(Array.isArray(langs));
    assert.ok(langs.length > 0);
  });

  it('includes common languages', () => {
    const langs = getAvailableTesseractLangs();
    assert.ok(langs.includes('rus'));
    assert.ok(langs.includes('eng'));
    assert.ok(langs.includes('deu'));
    assert.ok(langs.includes('fra'));
    assert.ok(langs.includes('spa'));
  });

  it('includes CJK languages', () => {
    const langs = getAvailableTesseractLangs();
    assert.ok(langs.includes('chi_sim'));
    assert.ok(langs.includes('chi_tra'));
    assert.ok(langs.includes('jpn'));
    assert.ok(langs.includes('kor'));
  });

  it('includes auto mode', () => {
    const langs = getAvailableTesseractLangs();
    assert.ok(langs.includes('auto'));
  });

  it('all entries are strings', () => {
    const langs = getAvailableTesseractLangs();
    for (const lang of langs) {
      assert.equal(typeof lang, 'string');
    }
  });
});

// ── isTesseractAvailable ────────────────────────────────────────────────────

describe('isTesseractAvailable', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    assert.equal(typeof mod.isTesseractAvailable, 'function');
  });
});

// ── initTesseract ───────────────────────────────────────────────────────────

describe('initTesseract', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    assert.equal(typeof mod.initTesseract, 'function');
  });
});

// ── terminateTesseract ──────────────────────────────────────────────────────

describe('terminateTesseract', () => {
  it('does not throw when no worker exists', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    // Should not throw
    await mod.terminateTesseract();
  });
});

// ── terminateTesseractPool ──────────────────────────────────────────────────

describe('terminateTesseractPool', () => {
  it('does not throw when no pool exists', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    await mod.terminateTesseractPool();
    assert.equal(isTesseractPoolReady(), false);
  });
});

// ── recognizeTesseract ──────────────────────────────────────────────────────

describe('recognizeTesseract', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    assert.equal(typeof mod.recognizeTesseract, 'function');
  });
});

// ── recognizeWithBoxes ──────────────────────────────────────────────────────

describe('recognizeWithBoxes', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    assert.equal(typeof mod.recognizeWithBoxes, 'function');
  });
});

// ── recognizeWithPool ───────────────────────────────────────────────────────

describe('recognizeWithPool', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/tesseract-adapter.js');
    assert.equal(typeof mod.recognizeWithPool, 'function');
  });
});
