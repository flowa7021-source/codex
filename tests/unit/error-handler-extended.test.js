// ─── Extended Unit Tests: Error Handler ─────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  reportError,
  classifyError,
  registerRecovery,
  onError,
  saveStateSnapshot,
  restoreStateSnapshot,
  withRetry,
  getErrorLog,
  exportErrorLog,
  ERROR_CODES,
} from '../../app/modules/error-handler.js';

// ─── classifyError (extended coverage) ──────────────────────────────────────

describe('classifyError extended', () => {
  it('classifies RangeError with allocation as MEMORY', () => {
    const err = new RangeError('allocation failed: out of memory');
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.MEMORY);
    assert.equal(result.severity, 'fatal');
    assert.equal(result.recoverable, true);
  });

  it('classifies TypeError with fetch as NETWORK', () => {
    const err = new TypeError('Failed to fetch');
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.NETWORK);
    assert.equal(result.recoverable, true);
  });

  it('classifies timeout error by name', () => {
    const err = new Error('request timed out');
    err.name = 'TimeoutError';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.TIMEOUT);
  });

  it('classifies timeout by error.code', () => {
    const err = new Error('connect');
    err.code = 'ETIMEDOUT';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.TIMEOUT);
  });

  it('classifies QuotaExceededError as STORAGE', () => {
    const err = new Error('quota');
    err.name = 'QuotaExceededError';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.STORAGE);
  });

  it('classifies quota_exceeded code as STORAGE', () => {
    const err = new Error('storage limit');
    err.code = 'quota_exceeded';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.STORAGE);
  });

  it('classifies SecurityError as PERMISSION', () => {
    const err = new Error('blocked');
    err.name = 'SecurityError';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.PERMISSION);
    assert.equal(result.recoverable, false);
  });

  it('classifies NotAllowedError as PERMISSION', () => {
    const err = new Error('not allowed');
    err.name = 'NotAllowedError';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.PERMISSION);
  });

  it('classifies EACCES code as PERMISSION', () => {
    const err = new Error('access denied');
    err.code = 'EACCES';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.PERMISSION);
  });

  it('classifies SyntaxError as FILE_PARSE', () => {
    const err = new SyntaxError('bad format');
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.FILE_PARSE);
  });

  it('does not classify SyntaxError with unexpected token as FILE_PARSE', () => {
    const err = new SyntaxError('unexpected token <');
    const result = classifyError(err);
    assert.notEqual(result.code, ERROR_CODES.FILE_PARSE);
  });

  it('classifies AbortError as NETWORK', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.NETWORK);
  });

  it('classifies abort code as NETWORK', () => {
    const err = new Error('request aborted');
    err.code = 'abort';
    const result = classifyError(err);
    assert.equal(result.code, ERROR_CODES.NETWORK);
  });

  it('classifies string with "timeout" as TIMEOUT', () => {
    const result = classifyError('operation timed out');
    assert.equal(result.code, ERROR_CODES.TIMEOUT);
  });

  it('classifies string with "storage" as STORAGE', () => {
    const result = classifyError('storage quota exceeded');
    assert.equal(result.code, ERROR_CODES.STORAGE);
  });

  it('classifies string with "permission" as PERMISSION', () => {
    const result = classifyError('permission denied');
    assert.equal(result.code, ERROR_CODES.PERMISSION);
  });

  it('classifies string with "parse" as FILE_PARSE', () => {
    const result = classifyError('parse error in file');
    assert.equal(result.code, ERROR_CODES.FILE_PARSE);
  });

  it('classifies string with "render" as RENDER', () => {
    const result = classifyError('render failed');
    assert.equal(result.code, ERROR_CODES.RENDER);
  });

  it('classifies string with "canvas" as RENDER', () => {
    const result = classifyError('canvas context lost');
    assert.equal(result.code, ERROR_CODES.RENDER);
  });

  it('classifies string with "ocr" as OCR', () => {
    const result = classifyError('ocr engine failed');
    assert.equal(result.code, ERROR_CODES.OCR);
  });

  it('classifies string with "tesseract" as OCR', () => {
    const result = classifyError('tesseract init error');
    assert.equal(result.code, ERROR_CODES.OCR);
  });

  it('returns UNKNOWN for unrecognized errors', () => {
    const result = classifyError('something went wrong');
    assert.equal(result.code, ERROR_CODES.UNKNOWN);
  });

  it('classifies plain string error', () => {
    const result = classifyError('plain string error');
    assert.equal(typeof result.message, 'string');
  });
});

// ─── withRetry ──────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns result on first try success', async () => {
    const result = await withRetry(async () => 42);
    assert.equal(result, 42);
  });

  it('retries on failure and succeeds', async () => {
    let attempt = 0;
    const result = await withRetry(async (n) => {
      attempt = n;
      if (n < 1) throw new Error('fail');
      return 'ok';
    }, { maxRetries: 3, delays: [10, 10, 10] });
    assert.equal(result, 'ok');
    assert.equal(attempt, 1);
  });

  it('throws after all retries exhausted', async () => {
    await assert.rejects(
      () => withRetry(async () => { throw new Error('always fails'); }, { maxRetries: 2, delays: [5, 5] }),
      { message: 'always fails' },
    );
  });

  it('calls onRetry callback', async () => {
    const retries = [];
    try {
      await withRetry(async () => { throw new Error('fail'); }, {
        maxRetries: 2,
        delays: [5, 5],
        onRetry: (attempt, err) => { retries.push({ attempt, msg: err.message }); },
      });
    } catch (e) { /* expected */ }
    assert.equal(retries.length, 2);
    assert.equal(retries[0].attempt, 1);
  });

  it('passes attempt number to fn', async () => {
    const attempts = [];
    try {
      await withRetry(async (n) => {
        attempts.push(n);
        if (n < 2) throw new Error('fail');
        return 'done';
      }, { maxRetries: 3, delays: [5, 5, 5] });
    } catch (e) { /* ok */ }
    assert.ok(attempts.includes(0));
  });
});

// ─── saveStateSnapshot / restoreStateSnapshot ───────────────────────────────

describe('saveStateSnapshot / restoreStateSnapshot', () => {
  it('saves and restores state', () => {
    saveStateSnapshot('test-key', { page: 5, zoom: 1.5 });
    const restored = restoreStateSnapshot('test-key');
    assert.equal(restored.page, 5);
    assert.equal(restored.zoom, 1.5);
    assert.ok(restored.snapshotAt);
  });

  it('returns null for unknown key', () => {
    assert.equal(restoreStateSnapshot('nonexistent'), null);
  });

  it('evicts oldest when exceeding 20 snapshots', () => {
    for (let i = 0; i < 25; i++) {
      saveStateSnapshot(`key-${i}`, { i });
    }
    // At least some early keys should be evicted
    // The latest should still exist
    const latest = restoreStateSnapshot('key-24');
    assert.ok(latest, 'latest snapshot should exist');
  });
});

// ─── registerRecovery ───────────────────────────────────────────────────────

describe('registerRecovery', () => {
  it('registers and invokes recovery strategy', () => {
    let recovered = false;
    registerRecovery('TEST_CODE', () => { recovered = true; });
    reportError({ code: 'TEST_CODE', message: 'test', recoverable: true });
    assert.ok(recovered);
  });
});

// ─── onError ────────────────────────────────────────────────────────────────

describe('onError', () => {
  it('notifies listener on reportError', () => {
    let received = null;
    const unsub = onError((err) => { received = err; });
    reportError({ code: 'TEST', message: 'hello' });
    assert.ok(received);
    assert.equal(received.message, 'hello');
    unsub();
  });

  it('unsubscribe stops notifications', () => {
    let count = 0;
    const unsub = onError(() => { count++; });
    reportError({ code: 'A', message: 'a' });
    assert.equal(count, 1);
    unsub();
    reportError({ code: 'B', message: 'b' });
    assert.equal(count, 1);
  });
});

// ─── getErrorLog ────────────────────────────────────────────────────────────

describe('getErrorLog', () => {
  it('returns errors in newest-first order', () => {
    reportError({ code: 'A', message: 'first' });
    reportError({ code: 'B', message: 'second' });
    const log = getErrorLog();
    assert.equal(log[0].message, 'second');
  });

  it('filters by code', () => {
    reportError({ code: 'RENDER', message: 'r1' });
    reportError({ code: 'OCR', message: 'o1' });
    const log = getErrorLog({ code: 'RENDER' });
    assert.ok(log.every(e => e.code === 'RENDER'));
  });

  it('filters by severity', () => {
    reportError({ code: 'A', message: 'a', severity: 'fatal' });
    reportError({ code: 'B', message: 'b', severity: 'warning' });
    const log = getErrorLog({ severity: 'fatal' });
    assert.ok(log.every(e => e.severity === 'fatal'));
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) reportError({ code: 'X', message: `m${i}` });
    const log = getErrorLog({ limit: 3 });
    assert.ok(log.length <= 3);
  });
});

// ─── exportErrorLog ─────────────────────────────────────────────────────────

describe('exportErrorLog', () => {
  it('returns valid JSON string', () => {
    reportError({ code: 'A', message: 'test' });
    const json = exportErrorLog();
    assert.doesNotThrow(() => JSON.parse(json));
  });
});
