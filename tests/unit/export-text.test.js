import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initExportTextDeps, importDocxEdits, exportSessionHealthReport } from '../../app/modules/export-text.js';

describe('initExportTextDeps', () => {
  it('is a function', () => {
    assert.equal(typeof initExportTextDeps, 'function');
  });

  it('accepts a deps object without throwing', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({ setOcrStatus: () => {}, getOcrLang: () => 'eng' });
    });
  });

  it('accepts empty object', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({});
    });
  });

  it('accepts partial deps', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({ setOcrStatus: () => {} });
    });
  });
});

describe('importDocxEdits', () => {
  it('is an async function', () => {
    assert.equal(typeof importDocxEdits, 'function');
  });

  it('returns early for null file', async () => {
    // Should not throw
    await importDocxEdits(null);
  });

  it('returns early for undefined file', async () => {
    await importDocxEdits(undefined);
  });
});

describe('exportSessionHealthReport', () => {
  it('is a function', () => {
    assert.equal(typeof exportSessionHealthReport, 'function');
  });
});
