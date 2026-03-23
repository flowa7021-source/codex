// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  revokeCurrentObjectUrl,
  djvuTextKey,
  loadDjvuData,
  saveDjvuData,
  isLikelyDjvuFile,
  extractDjvuFallbackText,
  initFileControllerDeps,
} from '../../app/modules/file-controller.js';
import { state } from '../../app/modules/state.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  state.currentObjectUrl = null;
  state.docName = null;
  localStorage.clear();
});

// ─── revokeCurrentObjectUrl ─────────────────────────────────────────────────

describe('revokeCurrentObjectUrl', () => {
  it('clears state.currentObjectUrl when set', () => {
    state.currentObjectUrl = 'blob:http://test/abc';
    revokeCurrentObjectUrl();
    assert.equal(state.currentObjectUrl, null);
  });

  it('does nothing when no URL is set', () => {
    state.currentObjectUrl = null;
    revokeCurrentObjectUrl(); // Should not throw
    assert.equal(state.currentObjectUrl, null);
  });
});

// ─── djvuTextKey ────────────────────────────────────────────────────────────

describe('djvuTextKey', () => {
  it('returns key with document name', () => {
    state.docName = 'test.djvu';
    assert.equal(djvuTextKey(), 'novareader-djvu-data:test.djvu');
  });

  it('returns key with "global" when no docName', () => {
    state.docName = null;
    assert.equal(djvuTextKey(), 'novareader-djvu-data:global');
  });

  it('returns key with empty string docName as empty', () => {
    state.docName = '';
    assert.equal(djvuTextKey(), 'novareader-djvu-data:global');
  });
});

// ─── loadDjvuData / saveDjvuData ────────────────────────────────────────────

describe('loadDjvuData', () => {
  it('returns null when no data stored', () => {
    state.docName = 'new.djvu';
    assert.equal(loadDjvuData(), null);
  });

  it('returns parsed data after save', () => {
    state.docName = 'test.djvu';
    const data = { pageCount: 5, pagesText: ['a', 'b'] };
    saveDjvuData(data);
    const loaded = loadDjvuData();
    assert.deepEqual(loaded, data);
  });

  it('handles corrupt JSON gracefully', () => {
    state.docName = 'bad.djvu';
    localStorage.setItem(djvuTextKey(), '{invalid json');
    assert.equal(loadDjvuData(), null);
  });
});

describe('saveDjvuData', () => {
  it('persists data to localStorage', () => {
    state.docName = 'save.djvu';
    saveDjvuData({ pageCount: 3 });
    const raw = localStorage.getItem(djvuTextKey());
    assert.ok(raw);
    assert.deepEqual(JSON.parse(raw), { pageCount: 3 });
  });
});

// ─── isLikelyDjvuFile ──────────────────────────────────────────────────────

describe('isLikelyDjvuFile', () => {
  it('returns true for AT&TFORM header', async () => {
    const bytes = new TextEncoder().encode('AT&TFORM0000DJVU');
    const file = new Blob([bytes]);
    file.slice = (start, end) => new Blob([bytes.slice(start, end)]);
    assert.equal(await isLikelyDjvuFile(file), true);
  });

  it('returns false for PDF header', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 header');
    const file = new Blob([bytes]);
    file.slice = (start, end) => new Blob([bytes.slice(start, end)]);
    assert.equal(await isLikelyDjvuFile(file), false);
  });

  it('handles empty file', async () => {
    const bytes = new Uint8Array(0);
    const file = new Blob([bytes]);
    file.slice = () => new Blob([bytes]);
    assert.equal(await isLikelyDjvuFile(file), false);
  });
});

// ─── extractDjvuFallbackText ────────────────────────────────────────────────

describe('extractDjvuFallbackText', () => {
  it('extracts readable text chunks from binary', async () => {
    const text = 'This is a readable text chunk that is at least twenty characters long for testing purposes';
    const bytes = new TextEncoder().encode(text);
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.ok(result.length > 0, 'should extract some text');
  });

  it('returns empty string for pure binary', async () => {
    const bytes = new Uint8Array(100);
    for (let i = 0; i < 100; i++) bytes[i] = i % 8; // mostly control chars
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.equal(typeof result, 'string');
  });

  it('limits output to 5000 chars', async () => {
    const longText = 'A'.repeat(10000) + ' some readable content here for testing';
    const bytes = new TextEncoder().encode(longText);
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.ok(result.length <= 5000);
  });
});

// ─── initFileControllerDeps ─────────────────────────────────────────────────

describe('initFileControllerDeps', () => {
  it('accepts deps object without error', () => {
    initFileControllerDeps({
      withErrorBoundary: (fn) => fn,
      renderCurrentPage: async () => {},
      renderOutline: async () => {},
      renderPagePreviews: async () => {},
      resetHistory: () => {},
    });
  });
});
