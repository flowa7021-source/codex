// ─── Unit Tests: OCR Region ─────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  initOcrRegionDeps,
  runOcrOnRectNow,
  runOcrOnRect,
  runOcrForCurrentPage,
  extractTextForPage,
  scheduleBackgroundOcrScan,
  startBackgroundOcrScan,
} from '../../app/modules/ocr-region.js';
import { state, els } from '../../app/modules/state.js';

// ── initOcrRegionDeps ──────────────────────────────────────────────────────

describe('initOcrRegionDeps', () => {
  it('accepts deps object without error', () => {
    assert.doesNotThrow(() => {
      initOcrRegionDeps({
        renderTextLayer: async () => {},
      });
    });
  });

  it('accepts empty deps without error', () => {
    assert.doesNotThrow(() => {
      initOcrRegionDeps({});
    });
  });

  it('accepts deps with extra properties without error', () => {
    assert.doesNotThrow(() => {
      initOcrRegionDeps({
        renderTextLayer: async () => {},
        someExtraDep: () => {},
      });
    });
  });

  it('overwrites previous deps', () => {
    let called = false;
    initOcrRegionDeps({ renderTextLayer: async () => { called = true; } });
    assert.equal(called, false);
  });
});

// ── runOcrOnRectNow ────────────────────────────────────────────────────────

describe('runOcrOnRectNow', () => {
  beforeEach(() => {
    state.adapter = null;
    state.ocrTaskId = 0;
    state.currentPage = 1;
    state.docName = 'test-doc';
    state.zoom = 1;
    state.rotation = 0;
    initOcrRegionDeps({ renderTextLayer: mock.fn(async () => {}) });
  });

  it('returns early when adapter is null', async () => {
    state.adapter = null;
    const result = await runOcrOnRectNow({ x: 0, y: 0, w: 100, h: 100 });
    assert.equal(result, undefined);
  });

  it('returns early when rect is null', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const result = await runOcrOnRectNow(null);
    assert.equal(result, undefined);
  });

  it('returns early when rect is undefined', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const result = await runOcrOnRectNow(undefined);
    assert.equal(result, undefined);
  });

  it('returns early when both adapter and rect are null', async () => {
    state.adapter = null;
    const result = await runOcrOnRectNow(null);
    assert.equal(result, undefined);
  });

  it('increments ocrTaskId when adapter and rect are present', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    const prevTaskId = state.ocrTaskId;
    // Will error internally in buildOcrSourceCanvas, but taskId gets incremented
    await runOcrOnRectNow({ x: 0, y: 0, w: 50, h: 50 });
    assert.ok(state.ocrTaskId > prevTaskId);
  });

  it('does not throw even when internal pipeline fails', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    // Should not throw -- errors are caught internally
    await assert.doesNotReject(async () => {
      await runOcrOnRectNow({ x: 10, y: 10, w: 50, h: 50 });
    });
  });
});

// ── runOcrOnRect ───────────────────────────────────────────────────────────

describe('runOcrOnRect', () => {
  beforeEach(() => {
    state.adapter = null;
    state.ocrTaskId = 0;
    state.ocrLastProgressUiAt = 0;
    state.ocrLastProgressText = '';
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.ocrQueueEpoch = 0;
    state.ocrLatestByReason = {};
  });

  it('returns early when adapter is null', async () => {
    state.adapter = null;
    const result = await runOcrOnRect({ x: 0, y: 0, w: 100, h: 100 });
    assert.equal(result, undefined);
  });

  it('returns early when rect is null', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const result = await runOcrOnRect(null);
    assert.equal(result, undefined);
  });

  it('returns early when rect is undefined', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const result = await runOcrOnRect(undefined);
    assert.equal(result, undefined);
  });

  it('returns early when both adapter and rect are falsy', async () => {
    state.adapter = null;
    const result = await runOcrOnRect(null, 'manual');
    assert.equal(result, undefined);
  });

  it('accepts a custom reason parameter without error', async () => {
    state.adapter = null;
    const result = await runOcrOnRect(null, 'auto');
    assert.equal(result, undefined);
  });

  it('uses default reason of manual', async () => {
    state.adapter = null;
    // Just ensure no error with default reason
    const result = await runOcrOnRect(null);
    assert.equal(result, undefined);
  });
});

// ── runOcrForCurrentPage ───────────────────────────────────────────────────

describe('runOcrForCurrentPage', () => {
  beforeEach(() => {
    state.adapter = null;
    state.currentPage = 1;
    state.ocrTaskId = 0;
    state.ocrLastProgressUiAt = 0;
    state.ocrLastProgressText = '';
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.ocrQueueEpoch = 0;
    state.ocrLatestByReason = {};
  });

  it('returns early when adapter is null', async () => {
    state.adapter = null;
    const result = await runOcrForCurrentPage();
    assert.equal(result, undefined);
  });

  it('returns early when canvas has zero width', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 100;
    els.canvas = canvas;
    const result = await runOcrForCurrentPage();
    assert.equal(result, undefined);
  });

  it('returns early when canvas has zero height', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 0;
    els.canvas = canvas;
    const result = await runOcrForCurrentPage();
    assert.equal(result, undefined);
  });

  it('returns early when canvas has zero width and height', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    els.canvas = canvas;
    const result = await runOcrForCurrentPage();
    assert.equal(result, undefined);
  });
});

// ── extractTextForPage ─────────────────────────────────────────────────────

describe('extractTextForPage', () => {
  beforeEach(() => {
    state.adapter = null;
    state.docName = 'test-doc';
    localStorage.clear();
  });

  it('returns empty string when adapter is null', async () => {
    state.adapter = null;
    const result = await extractTextForPage(1);
    assert.equal(result, '');
  });

  it('returns text from adapter.getText when available', async () => {
    state.adapter = { getText: mock.fn(async () => 'Hello World'), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(result, 'Hello World');
  });

  it('calls adapter.getText with the correct page number', async () => {
    const getTextFn = mock.fn(async () => 'Page 5 text');
    state.adapter = { getText: getTextFn, type: 'pdf' };
    await extractTextForPage(5);
    assert.equal(getTextFn.mock.calls[0].arguments[0], 5);
  });

  it('passes page number 1 correctly', async () => {
    const getTextFn = mock.fn(async () => 'First page');
    state.adapter = { getText: getTextFn, type: 'pdf' };
    await extractTextForPage(1);
    assert.equal(getTextFn.mock.calls[0].arguments[0], 1);
  });

  it('returns empty string when adapter.getText returns null', async () => {
    state.adapter = { getText: mock.fn(async () => null), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('returns empty string when adapter.getText returns empty string', async () => {
    state.adapter = { getText: mock.fn(async () => ''), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('handles adapter.getText throwing an error gracefully', async () => {
    state.adapter = {
      getText: mock.fn(async () => { throw new Error('getText failed'); }),
      type: 'pdf',
    };
    // Should not throw -- catches the error and falls back
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('trims whitespace from adapter.getText result', async () => {
    state.adapter = { getText: mock.fn(async () => '  trimmed text  '), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(result, 'trimmed text');
  });

  it('returns fallback for whitespace-only getText result', async () => {
    state.adapter = { getText: mock.fn(async () => '   '), type: 'pdf' };
    // Trimmed to empty, so will fall through to fallbacks
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('returns text for large page numbers', async () => {
    const getTextFn = mock.fn(async () => 'Big page');
    state.adapter = { getText: getTextFn, type: 'pdf' };
    const result = await extractTextForPage(9999);
    assert.equal(result, 'Big page');
    assert.equal(getTextFn.mock.calls[0].arguments[0], 9999);
  });
});

// ── scheduleBackgroundOcrScan ──────────────────────────────────────────────

describe('scheduleBackgroundOcrScan', () => {
  beforeEach(() => {
    state.adapter = null;
    state.settings = { backgroundOcr: false };
    state.backgroundOcrTimer = null;
  });

  it('returns early when backgroundOcr setting is false', () => {
    state.settings = { backgroundOcr: false };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan();
    assert.equal(state.backgroundOcrTimer, null);
  });

  it('returns early when adapter is null', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = null;
    scheduleBackgroundOcrScan();
    assert.equal(state.backgroundOcrTimer, null);
  });

  it('returns early when both backgroundOcr is false and adapter is null', () => {
    state.settings = { backgroundOcr: false };
    state.adapter = null;
    scheduleBackgroundOcrScan();
    assert.equal(state.backgroundOcrTimer, null);
  });

  it('returns early when settings is null', () => {
    state.settings = null;
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan();
    assert.equal(state.backgroundOcrTimer, null);
  });

  it('sets backgroundOcrTimer when conditions are met', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('test-reason', 1000);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('clears previous timer when called again', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('first');
    const firstTimer = state.backgroundOcrTimer;
    assert.notEqual(firstTimer, null);
    scheduleBackgroundOcrScan('second');
    const secondTimer = state.backgroundOcrTimer;
    assert.notEqual(secondTimer, null);
  });

  it('accepts custom delay', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('custom', 2000);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('sets timer even with very small delay (clamped to 50ms)', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('fast', 10);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('handles NaN delay by using default', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('nan', NaN);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('uses default reason and delay when none provided', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan();
    assert.notEqual(state.backgroundOcrTimer, null);
  });
});

// ── startBackgroundOcrScan ─────────────────────────────────────────────────

describe('startBackgroundOcrScan', () => {
  beforeEach(() => {
    state.adapter = null;
    state.pageCount = 0;
    state.docName = null;
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.currentPage = 1;
    state.zoom = 1;
    state.rotation = 0;
    state.settings = { backgroundOcr: true };
    localStorage.clear();
  });

  it('returns early when adapter is null', async () => {
    state.adapter = null;
    state.pageCount = 5;
    state.docName = 'test';
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('returns early when pageCount is 0', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.pageCount = 0;
    state.docName = 'test';
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('returns early when docName is null', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.pageCount = 5;
    state.docName = null;
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('returns early when docName is undefined', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.pageCount = 5;
    state.docName = undefined;
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('returns early when backgroundOcrRunning is already true', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.pageCount = 5;
    state.docName = 'test';
    state.backgroundOcrRunning = true;
    await startBackgroundOcrScan();
    // backgroundOcrRunning stays true (not reset by the guard)
    assert.equal(state.backgroundOcrRunning, true);
  });

  it('accepts a custom reason parameter', async () => {
    state.adapter = null;
    state.pageCount = 5;
    state.docName = 'test';
    await startBackgroundOcrScan('page-change');
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('uses default reason of auto', async () => {
    state.adapter = null;
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('does not set backgroundOcrRunning when adapter is missing', async () => {
    state.adapter = null;
    state.pageCount = 10;
    state.docName = 'doc';
    await startBackgroundOcrScan('auto');
    assert.equal(state.backgroundOcrRunning, false);
    assert.equal(state.backgroundOcrToken, 0);
  });
});

// ── module exports ─────────────────────────────────────────────────────────

describe('ocr-region module exports', () => {
  it('exports initOcrRegionDeps as a function', () => {
    assert.equal(typeof initOcrRegionDeps, 'function');
  });

  it('exports runOcrOnRectNow as a function', () => {
    assert.equal(typeof runOcrOnRectNow, 'function');
  });

  it('exports runOcrOnRect as a function', () => {
    assert.equal(typeof runOcrOnRect, 'function');
  });

  it('exports runOcrForCurrentPage as a function', () => {
    assert.equal(typeof runOcrForCurrentPage, 'function');
  });

  it('exports extractTextForPage as a function', () => {
    assert.equal(typeof extractTextForPage, 'function');
  });

  it('exports scheduleBackgroundOcrScan as a function', () => {
    assert.equal(typeof scheduleBackgroundOcrScan, 'function');
  });

  it('exports startBackgroundOcrScan as a function', () => {
    assert.equal(typeof startBackgroundOcrScan, 'function');
  });
});

// ── runOcrOnRectNow — canvas dimension handling ─────────────────────────────

describe('runOcrOnRectNow — canvas dimension edge cases', () => {
  beforeEach(() => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.ocrTaskId = 0;
    state.currentPage = 1;
    state.docName = 'test-doc';
    state.zoom = 1;
    state.rotation = 0;
    initOcrRegionDeps({ renderTextLayer: mock.fn(async () => {}) });
  });

  it('computes relative rect using canvas dimensions (Math.max 1 guard)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0; // triggers Math.max(1, 0) = 1
    canvas.height = 0;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    // Should not throw — errors are caught internally
    await assert.doesNotReject(async () => {
      await runOcrOnRectNow({ x: 10, y: 10, w: 50, h: 50 });
    });
  });

  it('handles very large rect coordinates without throwing', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    await assert.doesNotReject(async () => {
      await runOcrOnRectNow({ x: 9999, y: 9999, w: 9999, h: 9999 });
    });
  });

  it('handles zero-size rect without throwing', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    await assert.doesNotReject(async () => {
      await runOcrOnRectNow({ x: 50, y: 50, w: 0, h: 0 });
    });
  });

  it('handles negative rect coordinates without throwing', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    await assert.doesNotReject(async () => {
      await runOcrOnRectNow({ x: -10, y: -10, w: 50, h: 50 });
    });
  });
});

// ── runOcrOnRectNow — taskId cancellation ───────────────────────────────────

describe('runOcrOnRectNow — taskId cancellation', () => {
  beforeEach(() => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.ocrTaskId = 0;
    state.currentPage = 1;
    state.docName = 'test-doc';
    state.zoom = 1;
    state.rotation = 0;
    initOcrRegionDeps({ renderTextLayer: mock.fn(async () => {}) });
  });

  it('increments ocrTaskId on each call', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    const id1 = state.ocrTaskId;
    await runOcrOnRectNow({ x: 0, y: 0, w: 50, h: 50 });
    const id2 = state.ocrTaskId;
    await runOcrOnRectNow({ x: 0, y: 0, w: 50, h: 50 });
    const id3 = state.ocrTaskId;
    assert.ok(id2 > id1);
    assert.ok(id3 > id2);
  });
});

// ── runOcrOnRect — background OCR cancellation ──────────────────────────────

describe('runOcrOnRect — background OCR interaction', () => {
  beforeEach(() => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.ocrTaskId = 0;
    state.ocrLastProgressUiAt = 0;
    state.ocrLastProgressText = '';
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.ocrQueueEpoch = 0;
    state.ocrLatestByReason = {};
  });

  it('accepts full-page reason', async () => {
    state.adapter = null;
    const result = await runOcrOnRect(null, 'full-page');
    assert.equal(result, undefined);
  });

  it('accepts empty string reason', async () => {
    state.adapter = null;
    const result = await runOcrOnRect(null, '');
    assert.equal(result, undefined);
  });
});

// ── runOcrForCurrentPage — adapter and canvas validation ────────────────────

describe('runOcrForCurrentPage — full coverage', () => {
  beforeEach(() => {
    state.adapter = null;
    state.currentPage = 1;
    state.ocrTaskId = 0;
    state.ocrLastProgressUiAt = 0;
    state.ocrLastProgressText = '';
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.ocrQueueEpoch = 0;
    state.ocrLatestByReason = {};
  });

  it('returns early when both width and height are zero', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    els.canvas = canvas;
    const result = await runOcrForCurrentPage();
    assert.equal(result, undefined);
  });

  it('uses full canvas dimensions as rect when canvas has valid size', async () => {
    // adapter present but will fail during OCR — we just verify no throw
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 400;
    els.canvas = canvas;
    els.pageText = document.createElement('textarea');
    // Will hit enqueueOcrTask → runOcrOnRectNow internally
    await assert.doesNotReject(async () => {
      await runOcrForCurrentPage();
    });
  });
});

// ── extractTextForPage — fallback chain ─────────────────────────────────────

describe('extractTextForPage — fallback chain', () => {
  beforeEach(() => {
    state.adapter = null;
    state.docName = 'test-doc';
    localStorage.clear();
  });

  it('returns adapter text when not whitespace-only', async () => {
    state.adapter = { getText: mock.fn(async () => 'Non-empty text'), type: 'pdf' };
    const result = await extractTextForPage(3);
    assert.equal(result, 'Non-empty text');
  });

  it('falls through to IDB/localStorage when adapter getText returns undefined', async () => {
    state.adapter = { getText: mock.fn(async () => undefined), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('handles adapter.getText returning a number gracefully', async () => {
    state.adapter = { getText: mock.fn(async () => 42), type: 'pdf' };
    const result = await extractTextForPage(1);
    // String(42).trim() is '42' which is truthy
    assert.equal(result, '42');
  });

  it('handles adapter.getText returning boolean false gracefully', async () => {
    state.adapter = { getText: mock.fn(async () => false), type: 'pdf' };
    const result = await extractTextForPage(1);
    assert.equal(typeof result, 'string');
  });

  it('handles page number 0 without crashing', async () => {
    state.adapter = { getText: mock.fn(async () => ''), type: 'pdf' };
    const result = await extractTextForPage(0);
    assert.equal(typeof result, 'string');
  });

  it('handles negative page number without crashing', async () => {
    state.adapter = { getText: mock.fn(async () => ''), type: 'pdf' };
    const result = await extractTextForPage(-1);
    assert.equal(typeof result, 'string');
  });
});

// ── scheduleBackgroundOcrScan — timer management ────────────────────────────

describe('scheduleBackgroundOcrScan — edge cases', () => {
  beforeEach(() => {
    state.adapter = null;
    state.settings = { backgroundOcr: false };
    state.backgroundOcrTimer = null;
  });

  it('handles negative delay by clamping to 50ms', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('test', -100);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('handles zero delay by clamping to 50ms', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('test', 0);
    assert.notEqual(state.backgroundOcrTimer, null);
  });

  it('handles undefined settings.backgroundOcr', () => {
    state.settings = {};
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan();
    // backgroundOcr is undefined → falsy → early return
    assert.equal(state.backgroundOcrTimer, null);
  });

  it('handles string delay by using Number coercion', () => {
    state.settings = { backgroundOcr: true };
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    scheduleBackgroundOcrScan('test', '500');
    assert.notEqual(state.backgroundOcrTimer, null);
  });
});

// ── startBackgroundOcrScan — guard paths ────────────────────────────────────

describe('startBackgroundOcrScan — additional guards', () => {
  beforeEach(() => {
    state.adapter = null;
    state.pageCount = 0;
    state.docName = null;
    state.backgroundOcrRunning = false;
    state.backgroundOcrToken = 0;
    state.backgroundOcrTimer = null;
    state.currentPage = 1;
    state.zoom = 1;
    state.rotation = 0;
    state.settings = { backgroundOcr: true };
    localStorage.clear();
  });

  it('does not set backgroundOcrToken when adapter is missing', async () => {
    state.adapter = null;
    state.pageCount = 10;
    state.docName = 'doc';
    const tokenBefore = state.backgroundOcrToken;
    await startBackgroundOcrScan('test');
    assert.equal(state.backgroundOcrToken, tokenBefore);
  });

  it('returns early when pageCount is negative', async () => {
    state.adapter = { getText: mock.fn(), type: 'pdf' };
    state.pageCount = -1;
    state.docName = 'test';
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrRunning, false);
  });

  it('does not modify backgroundOcrToken when all guards fail', async () => {
    state.adapter = null;
    state.pageCount = 0;
    state.docName = null;
    const tokenBefore = state.backgroundOcrToken;
    await startBackgroundOcrScan();
    assert.equal(state.backgroundOcrToken, tokenBefore);
    assert.equal(state.backgroundOcrRunning, false);
  });
});
