import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initOcrRegionDeps } from '../../app/modules/ocr-region.js';

describe('initOcrRegionDeps', () => {
  it('accepts a deps object without error', () => {
    initOcrRegionDeps({ renderTextLayer: async () => {} });
  });

  it('works with empty deps', () => {
    initOcrRegionDeps({});
  });

  it('overwrites previous deps', () => {
    let called = false;
    initOcrRegionDeps({ renderTextLayer: async () => { called = true; } });
    // Should not throw
    assert.equal(called, false);
  });
});

describe('ocr-region module exports', () => {
  it('exports runOcrOnRectNow', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.runOcrOnRectNow, 'function');
  });

  it('exports runOcrOnRect', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.runOcrOnRect, 'function');
  });

  it('exports runOcrForCurrentPage', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.runOcrForCurrentPage, 'function');
  });

  it('exports extractTextForPage', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.extractTextForPage, 'function');
  });

  it('exports scheduleBackgroundOcrScan', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.scheduleBackgroundOcrScan, 'function');
  });

  it('exports startBackgroundOcrScan', async () => {
    const mod = await import('../../app/modules/ocr-region.js');
    assert.equal(typeof mod.startBackgroundOcrScan, 'function');
  });
});

describe('runOcrOnRectNow guard', () => {
  it('returns early when state.adapter is null', async () => {
    const { state } = await import('../../app/modules/state.js');
    const { runOcrOnRectNow } = await import('../../app/modules/ocr-region.js');
    const origAdapter = state.adapter;
    state.adapter = null;
    await runOcrOnRectNow({ x: 0, y: 0, w: 100, h: 100 });
    state.adapter = origAdapter;
    // Should not throw — just returns
  });

  it('returns early when rect is null', async () => {
    const { runOcrOnRectNow } = await import('../../app/modules/ocr-region.js');
    await runOcrOnRectNow(null);
  });
});

describe('extractTextForPage guard', () => {
  it('returns empty string when no adapter', async () => {
    const { state } = await import('../../app/modules/state.js');
    const { extractTextForPage } = await import('../../app/modules/ocr-region.js');
    const origAdapter = state.adapter;
    state.adapter = null;
    const result = await extractTextForPage(1);
    assert.equal(result, '');
    state.adapter = origAdapter;
  });
});
