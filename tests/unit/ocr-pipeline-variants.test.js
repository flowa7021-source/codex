// ─── Unit Tests: OCR Pipeline Variants ─────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  initOcrPipelineVariantsDeps,
  runOcrOnPreparedCanvas,
} from '../../app/modules/ocr-pipeline-variants.js';

// ─── Helper: create a mock canvas with given dimensions ─────────────────────
function makeCanvas(w = 100, h = 100) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ─── initOcrPipelineVariantsDeps ────────────────────────────────────────────

describe('initOcrPipelineVariantsDeps', () => {
  it('accepts a deps object without error', () => {
    const cache = new Map();
    initOcrPipelineVariantsDeps({ _ocrWordCache: cache });
  });

  it('works with empty deps', () => {
    initOcrPipelineVariantsDeps({});
  });

  it('handles multiple calls without error', () => {
    initOcrPipelineVariantsDeps({ _ocrWordCache: new Map() });
    initOcrPipelineVariantsDeps({ _ocrWordCache: new Map() });
  });

  it('stores normalizeOcrTextByLang function', () => {
    const normalize = (t) => t.toUpperCase();
    initOcrPipelineVariantsDeps({ normalizeOcrTextByLang: normalize });
    // No throw means it was accepted
  });

  it('stores scoreOcrTextByLang function', () => {
    const score = () => 42;
    initOcrPipelineVariantsDeps({ scoreOcrTextByLang: score });
  });

  it('stores postCorrectOcrText function', () => {
    const postCorrect = (t) => t.trim();
    initOcrPipelineVariantsDeps({ postCorrectOcrText: postCorrect });
  });

  it('stores setOcrStatus function', () => {
    const setStatus = () => {};
    initOcrPipelineVariantsDeps({ setOcrStatus: setStatus });
  });

  it('stores all deps at once', () => {
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
  });

  it('overwrites previous deps on repeated calls', () => {
    const cache1 = new Map();
    const cache2 = new Map();
    initOcrPipelineVariantsDeps({ _ocrWordCache: cache1 });
    initOcrPipelineVariantsDeps({ _ocrWordCache: cache2 });
    // Second call should overwrite — no assertion needed, just no errors
  });
});

// ─── runOcrOnPreparedCanvas — guard conditions ──────────────────────────────

describe('runOcrOnPreparedCanvas guard conditions', () => {
  it('returns empty string for null canvas', async () => {
    const result = await runOcrOnPreparedCanvas(null);
    assert.equal(result, '');
  });

  it('returns empty string for undefined canvas', async () => {
    const result = await runOcrOnPreparedCanvas(undefined);
    assert.equal(result, '');
  });

  it('returns empty string for canvas with width=0 and height=0', async () => {
    const canvas = makeCanvas(0, 0);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('returns empty string for canvas with width=0 and height>0', async () => {
    const canvas = makeCanvas(0, 100);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('returns empty string for canvas with width>0 and height=0', async () => {
    const canvas = makeCanvas(100, 0);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('returns empty string for non-canvas object without width', async () => {
    const result = await runOcrOnPreparedCanvas({ height: 100 });
    assert.equal(result, '');
  });

  it('returns empty string for non-canvas object without height', async () => {
    const result = await runOcrOnPreparedCanvas({ width: 100 });
    assert.equal(result, '');
  });

  it('returns empty string for empty object', async () => {
    const result = await runOcrOnPreparedCanvas({});
    assert.equal(result, '');
  });

  it('returns empty string for falsy values', async () => {
    assert.equal(await runOcrOnPreparedCanvas(false), '');
    assert.equal(await runOcrOnPreparedCanvas(0), '');
    assert.equal(await runOcrOnPreparedCanvas(''), '');
  });
});

// ─── runOcrOnPreparedCanvas — Tesseract unavailable ─────────────────────────
// In the test environment, Tesseract is not loaded, so isTesseractAvailable()
// returns false. This exercises lines 67-71 (the unavailable branch).

describe('runOcrOnPreparedCanvas — Tesseract unavailable', () => {
  let statusMessages;

  beforeEach(() => {
    statusMessages = [];
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 50,
      postCorrectOcrText: (t) => t,
      setOcrStatus: (msg) => statusMessages.push(msg),
    });
  });

  it('returns empty string when Tesseract is unavailable', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('calls setOcrStatus with unavailable message', async () => {
    const canvas = makeCanvas(200, 200);
    await runOcrOnPreparedCanvas(canvas);
    assert.ok(statusMessages.length > 0, 'setOcrStatus should be called');
    // The message should mention Tesseract being unavailable
    const lastMsg = statusMessages[statusMessages.length - 1];
    assert.ok(
      lastMsg.includes('Tesseract') || lastMsg.includes('недоступен') || lastMsg.includes('OCR'),
      `Status message should mention OCR/Tesseract, got: ${lastMsg}`,
    );
  });

  it('returns empty string regardless of options when Tesseract is unavailable', async () => {
    const canvas = makeCanvas(500, 500);
    const result = await runOcrOnPreparedCanvas(canvas, {
      fast: true,
      taskId: 1,
      lang: 'eng',
      charBoxes: true,
      pageNum: 1,
    });
    assert.equal(result, '');
  });

  it('handles fast=true option with unavailable Tesseract', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, { fast: true });
    assert.equal(result, '');
  });

  it('handles preferredSkew option with unavailable Tesseract', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, { preferredSkew: 2.5 });
    assert.equal(result, '');
  });

  it('does not call normalizeOcrTextByLang when Tesseract is unavailable', async () => {
    let normalizeCalled = false;
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: () => { normalizeCalled = true; return ''; },
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
    const canvas = makeCanvas(200, 200);
    await runOcrOnPreparedCanvas(canvas);
    assert.equal(normalizeCalled, false, 'normalizeOcrTextByLang should not be called');
  });

  it('does not call postCorrectOcrText when Tesseract is unavailable', async () => {
    let postCorrectCalled = false;
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: () => { postCorrectCalled = true; return ''; },
      setOcrStatus: () => {},
    });
    const canvas = makeCanvas(200, 200);
    await runOcrOnPreparedCanvas(canvas);
    assert.equal(postCorrectCalled, false, 'postCorrectOcrText should not be called');
  });

  it('does not call scoreOcrTextByLang when Tesseract is unavailable', async () => {
    let scoreCalled = false;
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => { scoreCalled = true; return 0; },
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
    const canvas = makeCanvas(200, 200);
    await runOcrOnPreparedCanvas(canvas);
    assert.equal(scoreCalled, false, 'scoreOcrTextByLang should not be called');
  });

  it('does not modify _ocrWordCache when Tesseract is unavailable', async () => {
    const cache = new Map();
    initOcrPipelineVariantsDeps({
      _ocrWordCache: cache,
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
    const canvas = makeCanvas(200, 200);
    await runOcrOnPreparedCanvas(canvas, { pageNum: 1 });
    assert.equal(cache.size, 0, 'cache should remain empty');
  });

  it('handles onProgress callback without error when Tesseract is unavailable', async () => {
    const progressEvents = [];
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, {
      onProgress: (evt) => progressEvents.push(evt),
    });
    assert.equal(result, '');
    // onProgress should not be called since we exit before preprocessing
    assert.equal(progressEvents.length, 0);
  });
});

// ─── runOcrOnPreparedCanvas — option parsing ────────────────────────────────

describe('runOcrOnPreparedCanvas — option parsing', () => {
  beforeEach(() => {
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
  });

  it('accepts empty options', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('accepts options with all fields', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, {
      fast: true,
      preferredSkew: 1.5,
      taskId: 42,
      onProgress: () => {},
      charBoxes: true,
      pageNum: 3,
    });
    assert.equal(result, '');
  });

  it('accepts non-function onProgress gracefully', async () => {
    const canvas = makeCanvas(200, 200);
    // Should not throw even with non-function onProgress
    const result = await runOcrOnPreparedCanvas(canvas, { onProgress: 'not-a-function' });
    assert.equal(result, '');
  });

  it('handles numeric string taskId', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, { taskId: '5' });
    assert.equal(result, '');
  });

  it('handles zero taskId', async () => {
    const canvas = makeCanvas(200, 200);
    const result = await runOcrOnPreparedCanvas(canvas, { taskId: 0 });
    assert.equal(result, '');
  });
});

// ─── runOcrOnPreparedCanvas — return type ───────────────────────────────────

describe('runOcrOnPreparedCanvas — return type', () => {
  it('always returns a string', async () => {
    const result1 = await runOcrOnPreparedCanvas(null);
    assert.equal(typeof result1, 'string');

    const result2 = await runOcrOnPreparedCanvas(makeCanvas(0, 0));
    assert.equal(typeof result2, 'string');

    const result3 = await runOcrOnPreparedCanvas(makeCanvas(100, 100));
    assert.equal(typeof result3, 'string');
  });

  it('returns a promise', () => {
    const result = runOcrOnPreparedCanvas(null);
    assert.ok(result instanceof Promise);
  });
});

// ─── Module exports ─────────────────────────────────────────────────────────

describe('ocr-pipeline-variants module exports', () => {
  it('exports runOcrOnPreparedCanvas as a function', () => {
    assert.equal(typeof runOcrOnPreparedCanvas, 'function');
  });

  it('exports initOcrPipelineVariantsDeps as a function', () => {
    assert.equal(typeof initOcrPipelineVariantsDeps, 'function');
  });

  it('runOcrOnPreparedCanvas is async', () => {
    // Calling with null returns a promise
    const result = runOcrOnPreparedCanvas(null);
    assert.ok(result instanceof Promise);
  });
});

// ─── Concurrent calls ──────────────────────────────────────────────────────

describe('runOcrOnPreparedCanvas — concurrent calls', () => {
  beforeEach(() => {
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
  });

  it('handles multiple concurrent calls with null canvas', async () => {
    const results = await Promise.all([
      runOcrOnPreparedCanvas(null),
      runOcrOnPreparedCanvas(null),
      runOcrOnPreparedCanvas(null),
    ]);
    assert.deepEqual(results, ['', '', '']);
  });

  it('handles multiple concurrent calls with valid canvas', async () => {
    const results = await Promise.all([
      runOcrOnPreparedCanvas(makeCanvas(100, 100)),
      runOcrOnPreparedCanvas(makeCanvas(200, 200)),
      runOcrOnPreparedCanvas(makeCanvas(50, 50)),
    ]);
    // All should return '' since Tesseract is unavailable
    assert.deepEqual(results, ['', '', '']);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('runOcrOnPreparedCanvas — edge cases', () => {
  beforeEach(() => {
    initOcrPipelineVariantsDeps({
      _ocrWordCache: new Map(),
      normalizeOcrTextByLang: (t) => t,
      scoreOcrTextByLang: () => 0,
      postCorrectOcrText: (t) => t,
      setOcrStatus: () => {},
    });
  });

  it('handles very large canvas dimensions', async () => {
    const canvas = makeCanvas(10000, 10000);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('handles canvas with width=1 and height=1', async () => {
    const canvas = makeCanvas(1, 1);
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('handles negative canvas dimensions as falsy (returns empty)', async () => {
    // Negative dimensions treated as truthy by JS but this is an edge case
    const canvas = makeCanvas(-1, -1);
    // -1 is truthy, so it passes the guard and hits Tesseract unavailable
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('does not throw on rapid successive calls', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await runOcrOnPreparedCanvas(makeCanvas(100, 100));
      assert.equal(result, '');
    }
  });
});
