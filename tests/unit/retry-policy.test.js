// ─── Unit Tests: RetryPolicy ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  withRetry,
  calcDelay,
  RetryPolicy,
} from '../../app/modules/retry-policy.js';

// ─── calcDelay ────────────────────────────────────────────────────────────────

describe('calcDelay – fixed', () => {
  it('returns baseDelay regardless of attempt', () => {
    const opts = { backoff: 'fixed', baseDelay: 200, maxDelay: 30_000 };
    assert.equal(calcDelay(0, opts), 200);
    assert.equal(calcDelay(1, opts), 200);
    assert.equal(calcDelay(5, opts), 200);
  });

  it('clamps to maxDelay', () => {
    const opts = { backoff: 'fixed', baseDelay: 500, maxDelay: 100 };
    assert.equal(calcDelay(0, opts), 100);
  });
});

describe('calcDelay – linear', () => {
  it('returns baseDelay * (attempt + 1)', () => {
    const opts = { backoff: 'linear', baseDelay: 100, maxDelay: 30_000 };
    assert.equal(calcDelay(0, opts), 100);  // 100 * 1
    assert.equal(calcDelay(1, opts), 200);  // 100 * 2
    assert.equal(calcDelay(4, opts), 500);  // 100 * 5
  });

  it('clamps to maxDelay', () => {
    const opts = { backoff: 'linear', baseDelay: 100, maxDelay: 250 };
    assert.equal(calcDelay(0, opts), 100);
    assert.equal(calcDelay(1, opts), 200);
    assert.equal(calcDelay(2, opts), 250); // 300 clamped to 250
  });
});

describe('calcDelay – exponential', () => {
  it('returns baseDelay * 2^attempt', () => {
    const opts = { backoff: 'exponential', baseDelay: 100, maxDelay: 30_000 };
    assert.equal(calcDelay(0, opts), 100);   // 100 * 1
    assert.equal(calcDelay(1, opts), 200);   // 100 * 2
    assert.equal(calcDelay(2, opts), 400);   // 100 * 4
    assert.equal(calcDelay(3, opts), 800);   // 100 * 8
    assert.equal(calcDelay(4, opts), 1600);  // 100 * 16
  });

  it('clamps to maxDelay', () => {
    const opts = { backoff: 'exponential', baseDelay: 100, maxDelay: 500 };
    assert.equal(calcDelay(0, opts), 100);
    assert.equal(calcDelay(1, opts), 200);
    assert.equal(calcDelay(2, opts), 400);
    assert.equal(calcDelay(3, opts), 500); // 800 clamped to 500
    assert.equal(calcDelay(10, opts), 500);
  });

  it('defaults to exponential when backoff is not specified', () => {
    const opts = { baseDelay: 100, maxDelay: 30_000 };
    assert.equal(calcDelay(0, opts), 100);
    assert.equal(calcDelay(2, opts), 400);
  });
});

describe('calcDelay – jitter', () => {
  it('with jitter=false returns deterministic value', () => {
    const opts = { backoff: 'fixed', baseDelay: 200, maxDelay: 30_000, jitter: false };
    assert.equal(calcDelay(0, opts), 200);
  });

  it('with jitter=true returns value in [baseDelay*0.5, baseDelay]', () => {
    const opts = { backoff: 'fixed', baseDelay: 200, maxDelay: 30_000, jitter: true };
    for (let i = 0; i < 20; i++) {
      const delay = calcDelay(0, opts);
      assert.ok(delay >= 100, `delay ${delay} should be >= 100`);
      assert.ok(delay <= 200, `delay ${delay} should be <= 200`);
    }
  });
});

describe('calcDelay – defaults', () => {
  it('uses default baseDelay of 100 when not specified', () => {
    assert.equal(calcDelay(0, {}), 100);
  });

  it('uses default maxDelay of 30000 when not specified', () => {
    // attempt 100 with exponential — should be clamped to 30000
    assert.equal(calcDelay(100, { baseDelay: 100 }), 30_000);
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe('withRetry – success on first attempt', () => {
  it('returns value and attempts=1', async () => {
    const result = await withRetry(() => Promise.resolve(42), {
      maxAttempts: 3,
      baseDelay: 0,
    });
    assert.equal(result.value, 42);
    assert.equal(result.attempts, 1);
  });
});

describe('withRetry – success after failures', () => {
  it('succeeds on second attempt', async () => {
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        if (calls < 2) return Promise.reject(new Error('fail'));
        return Promise.resolve('ok');
      },
      { maxAttempts: 3, baseDelay: 0 },
    );
    assert.equal(result.value, 'ok');
    assert.equal(result.attempts, 2);
  });

  it('succeeds on third attempt', async () => {
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        if (calls < 3) return Promise.reject(new Error(`fail ${calls}`));
        return Promise.resolve('success');
      },
      { maxAttempts: 3, baseDelay: 0 },
    );
    assert.equal(result.value, 'success');
    assert.equal(result.attempts, 3);
  });
});

describe('withRetry – exhausts all attempts', () => {
  it('throws after maxAttempts', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          () => {
            calls += 1;
            return Promise.reject(new Error('always fails'));
          },
          { maxAttempts: 3, baseDelay: 0 },
        ),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'always fails');
        return true;
      },
    );
    assert.equal(calls, 3);
  });

  it('throws after maxAttempts=1 with no retries', async () => {
    await assert.rejects(
      () => withRetry(() => Promise.reject(new Error('nope')), { maxAttempts: 1, baseDelay: 0 }),
      /nope/,
    );
  });
});

describe('withRetry – default options', () => {
  it('defaults to maxAttempts=3', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(() => {
          calls += 1;
          return Promise.reject(new Error('fail'));
        }, { baseDelay: 0 }),
    );
    assert.equal(calls, 3);
  });
});

// ─── retryIf predicate ────────────────────────────────────────────────────────

describe('withRetry – retryIf predicate', () => {
  it('retries when retryIf returns true', async () => {
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        if (calls < 2) return Promise.reject(new Error('retryable'));
        return Promise.resolve('done');
      },
      {
        maxAttempts: 3,
        baseDelay: 0,
        retryIf: (err) => err instanceof Error && err.message === 'retryable',
      },
    );
    assert.equal(result.value, 'done');
    assert.equal(calls, 2);
  });

  it('stops immediately when retryIf returns false', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          () => {
            calls += 1;
            return Promise.reject(new Error('fatal'));
          },
          {
            maxAttempts: 5,
            baseDelay: 0,
            retryIf: () => false,
          },
        ),
      /fatal/,
    );
    // Should have stopped after first attempt
    assert.equal(calls, 1);
  });

  it('does not retry non-matching errors', async () => {
    let calls = 0;
    const isRetryable = (err) =>
      err instanceof Error && err.message.startsWith('retry');

    await assert.rejects(
      () =>
        withRetry(
          () => {
            calls += 1;
            return Promise.reject(new Error('fatal-error'));
          },
          { maxAttempts: 3, baseDelay: 0, retryIf: isRetryable },
        ),
      /fatal-error/,
    );
    assert.equal(calls, 1);
  });
});

// ─── RetryPolicy class ────────────────────────────────────────────────────────

describe('RetryPolicy – constructor / options getter', () => {
  it('exposes resolved options', () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      baseDelay: 200,
      maxDelay: 10_000,
      backoff: 'linear',
      jitter: true,
    });
    const opts = policy.options;
    assert.equal(opts.maxAttempts, 5);
    assert.equal(opts.baseDelay, 200);
    assert.equal(opts.maxDelay, 10_000);
    assert.equal(opts.backoff, 'linear');
    assert.equal(opts.jitter, true);
  });

  it('uses correct defaults when no options provided', () => {
    const policy = new RetryPolicy();
    const opts = policy.options;
    assert.equal(opts.maxAttempts, 3);
    assert.equal(opts.baseDelay, 100);
    assert.equal(opts.maxDelay, 30_000);
    assert.equal(opts.backoff, 'exponential');
    assert.equal(opts.jitter, false);
    assert.equal(opts.retryIf, undefined);
  });
});

describe('RetryPolicy – execute', () => {
  it('succeeds on first attempt', async () => {
    const policy = new RetryPolicy({ baseDelay: 0 });
    const result = await policy.execute(() => Promise.resolve('hello'));
    assert.equal(result.value, 'hello');
    assert.equal(result.attempts, 1);
  });

  it('succeeds after one failure', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 0 });
    let calls = 0;
    const result = await policy.execute(() => {
      calls += 1;
      if (calls < 2) return Promise.reject(new Error('oops'));
      return Promise.resolve('recovered');
    });
    assert.equal(result.value, 'recovered');
    assert.equal(result.attempts, 2);
  });

  it('throws after all attempts exhausted', async () => {
    const policy = new RetryPolicy({ maxAttempts: 2, baseDelay: 0 });
    let calls = 0;
    await assert.rejects(
      () =>
        policy.execute(() => {
          calls += 1;
          return Promise.reject(new Error('boom'));
        }),
      /boom/,
    );
    assert.equal(calls, 2);
  });

  it('honours retryIf predicate', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      baseDelay: 0,
      retryIf: (err) => err instanceof Error && err.message === 'retry-me',
    });
    let calls = 0;
    await assert.rejects(
      () =>
        policy.execute(() => {
          calls += 1;
          return Promise.reject(new Error('no-retry'));
        }),
      /no-retry/,
    );
    assert.equal(calls, 1);
  });

  it('options getter returns a copy (mutation does not affect policy)', () => {
    const policy = new RetryPolicy({ maxAttempts: 3 });
    const opts = policy.options;
    opts.maxAttempts = 999;
    assert.equal(policy.options.maxAttempts, 3);
  });
});
