// ─── Unit Tests: Error Handler ──────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock window to prevent initErrorHandler from crashing if accidentally called
globalThis.window = globalThis.window || { addEventListener: () => {} };

import {
  classifyError,
  reportError,
  registerRecovery,
  onError,
  saveStateSnapshot,
  restoreStateSnapshot,
  withRetry,
  getErrorLog,
  ERROR_CODES,
} from '../../app/modules/error-handler.js';

describe('ERROR_CODES', () => {
  it('has expected error codes', () => {
    assert.ok(ERROR_CODES.FILE_LOAD);
    assert.ok(ERROR_CODES.RENDER);
    assert.ok(ERROR_CODES.OCR);
    assert.ok(ERROR_CODES.MEMORY);
    assert.ok(ERROR_CODES.NETWORK);
    assert.ok(ERROR_CODES.UNKNOWN);
  });
});

describe('classifyError', () => {
  it('classifies memory errors', () => {
    const result = classifyError('Out of memory');
    assert.equal(result.code, 'MEMORY');
    assert.equal(result.severity, 'fatal');
    assert.equal(result.recoverable, true);
  });

  it('classifies network errors', () => {
    const result = classifyError('Failed to fetch resource');
    assert.equal(result.code, 'NETWORK');
    assert.equal(result.recoverable, true);
  });

  it('classifies timeout errors', () => {
    const result = classifyError('Operation timed out');
    assert.equal(result.code, 'TIMEOUT');
  });

  it('classifies storage errors', () => {
    const result = classifyError('quota exceeded');
    assert.equal(result.code, 'STORAGE');
    assert.equal(result.severity, 'warning');
  });

  it('classifies permission errors', () => {
    const result = classifyError('CORS policy blocked');
    assert.equal(result.code, 'PERMISSION');
    assert.equal(result.recoverable, false);
  });

  it('classifies parse errors', () => {
    const result = classifyError('Invalid PDF structure');
    assert.equal(result.code, 'FILE_PARSE');
  });

  it('classifies render errors', () => {
    const result = classifyError('Canvas draw error');
    assert.equal(result.code, 'RENDER');
  });

  it('classifies OCR errors', () => {
    const result = classifyError('Tesseract worker failed');
    assert.equal(result.code, 'OCR');
  });

  it('returns UNKNOWN for unrecognized errors', () => {
    const result = classifyError('Something weird happened');
    assert.equal(result.code, 'UNKNOWN');
  });

  it('handles Error objects', () => {
    const err = new Error('Out of memory allocation');
    const result = classifyError(err);
    assert.equal(result.code, 'MEMORY');
  });
});

describe('reportError', () => {
  it('adds error to the log', () => {
    const before = getErrorLog().length;
    reportError({ code: 'TEST', message: 'test error', context: 'unit-test' });
    const after = getErrorLog().length;
    assert.ok(after > before);
  });

  it('notifies listeners', () => {
    const received = [];
    const unsub = onError((err) => received.push(err));
    reportError({ code: 'TEST', message: 'listener test' });
    unsub();
    assert.ok(received.length > 0);
    assert.equal(received[received.length - 1].code, 'TEST');
  });

  it('triggers recovery strategies', () => {
    let recovered = false;
    registerRecovery('RECOVERABLE_TEST', () => { recovered = true; });
    reportError({ code: 'RECOVERABLE_TEST', message: 'test', recoverable: true });
    assert.ok(recovered);
  });
});

describe('onError', () => {
  it('returns unsubscribe function', () => {
    const events = [];
    const unsub = onError((err) => events.push(err));
    reportError({ code: 'A', message: 'a' });
    unsub();
    reportError({ code: 'B', message: 'b' });
    // Should only have A, not B
    assert.ok(events.every(e => e.code !== 'B'));
  });
});

describe('saveStateSnapshot / restoreStateSnapshot', () => {
  it('saves and restores a snapshot', () => {
    saveStateSnapshot('test', { page: 5, zoom: 1.5 });
    const restored = restoreStateSnapshot('test');
    assert.equal(restored.page, 5);
    assert.equal(restored.zoom, 1.5);
    assert.ok(restored.snapshotAt > 0);
  });

  it('returns null for unknown key', () => {
    assert.equal(restoreStateSnapshot('nonexistent_key_xyz'), null);
  });
});

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    let calls = 0;
    const result = await withRetry(() => { calls++; return 'ok'; }, { delays: [10] });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('retries on failure then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(() => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'success';
    }, { maxRetries: 3, delays: [10, 10, 10] });
    assert.equal(result, 'success');
    assert.equal(calls, 3);
  });

  it('throws after max retries exceeded', async () => {
    await assert.rejects(
      () => withRetry(() => { throw new Error('always fails'); }, { maxRetries: 2, delays: [10, 10] }),
      { message: 'always fails' }
    );
  });

  it('calls onRetry callback', async () => {
    const retries = [];
    try {
      await withRetry(() => { throw new Error('fail'); }, {
        maxRetries: 2,
        delays: [10, 10],
        onRetry: (attempt, err) => retries.push(attempt),
      });
    } catch { /* expected */ }
    assert.deepEqual(retries, [1, 2]);
  });
});

describe('getErrorLog', () => {
  it('returns errors newest first', () => {
    reportError({ code: 'FIRST', message: 'first' });
    reportError({ code: 'SECOND', message: 'second' });
    const log = getErrorLog();
    const secondIdx = log.findIndex(e => e.code === 'SECOND');
    const firstIdx = log.findIndex(e => e.code === 'FIRST');
    assert.ok(secondIdx < firstIdx, 'newest should be first');
  });

  it('filters by code', () => {
    reportError({ code: 'FILTER_TEST', message: 'test' });
    const filtered = getErrorLog({ code: 'FILTER_TEST' });
    assert.ok(filtered.every(e => e.code === 'FILTER_TEST'));
  });

  it('respects limit', () => {
    const log = getErrorLog({ limit: 3 });
    assert.ok(log.length <= 3);
  });
});
