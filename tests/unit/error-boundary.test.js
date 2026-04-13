// ─── Unit Tests: Error Boundary ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AppError,
  tryCatch,
  tryCatchAsync,
  withRetry,
  withFallback,
  withTimeout,
} from '../../app/modules/error-boundary.js';

// ─── AppError ────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('sets message, code, and name', () => {
    const err = new AppError('not found', 'NOT_FOUND');
    assert.equal(err.message, 'not found');
    assert.equal(err.code, 'NOT_FOUND');
    assert.equal(err.name, 'AppError');
  });

  it('is an instance of Error', () => {
    assert.ok(new AppError('x', 'X') instanceof Error);
  });

  it('stores optional context', () => {
    const err = new AppError('x', 'X', { key: 'val' });
    assert.deepEqual(err.context, { key: 'val' });
  });

  it('toJSON includes basic fields', () => {
    const err = new AppError('bad', 'ERR');
    const json = err.toJSON();
    assert.equal(json.message, 'bad');
    assert.equal(json.code, 'ERR');
    assert.equal(json.name, 'AppError');
  });

  it('toJSON includes context when present', () => {
    const err = new AppError('x', 'X', { id: 1 });
    assert.deepEqual(err.toJSON().context, { id: 1 });
  });

  it('toJSON includes cause chain', () => {
    const cause = new Error('root');
    const err = new AppError('outer', 'OUTER', undefined, cause);
    const json = err.toJSON();
    assert.ok(json.cause);
    assert.equal(json.cause.message, 'root');
  });
});

// ─── tryCatch ────────────────────────────────────────────────────────────────

describe('tryCatch', () => {
  it('returns Ok on success', () => {
    const result = tryCatch(() => 42);
    assert.equal(result.ok, true);
    assert.equal(result.unwrap(), 42);
  });

  it('returns Err on throw', () => {
    const result = tryCatch(() => { throw new Error('boom'); });
    assert.equal(result.ok, false);
    assert.throws(() => result.unwrap(), /boom/);
  });

  it('wraps non-Error throws', () => {
    const result = tryCatch(() => { throw 'string error'; });
    assert.equal(result.ok, false);
  });
});

// ─── tryCatchAsync ───────────────────────────────────────────────────────────

describe('tryCatchAsync', () => {
  it('returns Ok on resolved promise', async () => {
    const result = await tryCatchAsync(() => Promise.resolve(7));
    assert.equal(result.ok, true);
    assert.equal(result.unwrap(), 7);
  });

  it('returns Err on rejected promise', async () => {
    const result = await tryCatchAsync(() => Promise.reject(new Error('fail')));
    assert.equal(result.ok, false);
  });
});

// ─── withRetry ───────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    let calls = 0;
    const val = await withRetry(async () => { calls++; return 99; }, { maxAttempts: 3 });
    assert.equal(val, 99);
    assert.equal(calls, 1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const val = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return 'done';
    }, { maxAttempts: 5, delay: 0 });
    assert.equal(val, 'done');
    assert.equal(calls, 3);
  });

  it('throws after all attempts exhausted', async () => {
    await assert.rejects(
      withRetry(async () => { throw new Error('always'); }, { maxAttempts: 2, delay: 0 }),
      /always/,
    );
  });

  it('shouldRetry can abort early', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw new Error('fatal');
      }, {
        maxAttempts: 10,
        shouldRetry: () => false,
      }),
      /fatal/,
    );
    assert.equal(calls, 1);
  });
});

// ─── withFallback ────────────────────────────────────────────────────────────

describe('withFallback', () => {
  it('returns primary result when it succeeds', async () => {
    const val = await withFallback(
      () => Promise.resolve('primary'),
      () => Promise.resolve('fallback'),
    );
    assert.equal(val, 'primary');
  });

  it('uses fallback when primary fails', async () => {
    const val = await withFallback(
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('fallback'),
    );
    assert.equal(val, 'fallback');
  });
});

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves if fn finishes in time', async () => {
    const val = await withTimeout(() => Promise.resolve(5), 1000);
    assert.equal(val, 5);
  });

  it('rejects with timeout error when fn is too slow', async () => {
    await assert.rejects(
      withTimeout(
        () => new Promise(resolve => setTimeout(resolve, 500)),
        10,
      ),
      /timed out/i,
    );
  });
});
