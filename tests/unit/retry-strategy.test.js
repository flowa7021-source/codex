// ─── Unit Tests: Retry Strategy ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDelay,
  retry,
  createRetry,
  withTimeout,
  raceTimeout,
} from '../../app/modules/retry-strategy.js';

// ─── computeDelay() ──────────────────────────────────────────────────────────

describe('computeDelay() – fixed', () => {
  it('always returns delayMs regardless of attempt', () => {
    const opts = { delayMs: 100, backoff: 'fixed' };
    assert.equal(computeDelay(1, opts), 100);
    assert.equal(computeDelay(2, opts), 100);
    assert.equal(computeDelay(5, opts), 100);
  });

  it('uses default delayMs (1000) when not specified', () => {
    assert.equal(computeDelay(1, { backoff: 'fixed' }), 1000);
  });
});

describe('computeDelay() – linear', () => {
  it('scales linearly with attempt number', () => {
    const opts = { delayMs: 200, backoff: 'linear' };
    assert.equal(computeDelay(1, opts), 200);
    assert.equal(computeDelay(2, opts), 400);
    assert.equal(computeDelay(3, opts), 600);
  });
});

describe('computeDelay() – exponential', () => {
  it('doubles with each attempt (base * 2^(attempt-1))', () => {
    const opts = { delayMs: 100, backoff: 'exponential' };
    assert.equal(computeDelay(1, opts), 100);   // 100 * 2^0 = 100
    assert.equal(computeDelay(2, opts), 200);   // 100 * 2^1 = 200
    assert.equal(computeDelay(3, opts), 400);   // 100 * 2^2 = 400
    assert.equal(computeDelay(4, opts), 800);   // 100 * 2^3 = 800
  });

  it('is the default backoff strategy', () => {
    assert.equal(computeDelay(1, { delayMs: 100 }), 100);
    assert.equal(computeDelay(2, { delayMs: 100 }), 200);
  });
});

describe('computeDelay() – maxDelayMs cap', () => {
  it('caps at maxDelayMs for fixed backoff', () => {
    assert.equal(computeDelay(1, { delayMs: 500, backoff: 'fixed', maxDelayMs: 100 }), 100);
  });

  it('caps at maxDelayMs for linear backoff', () => {
    assert.equal(computeDelay(10, { delayMs: 100, backoff: 'linear', maxDelayMs: 500 }), 500);
  });

  it('caps at maxDelayMs for exponential backoff', () => {
    assert.equal(computeDelay(20, { delayMs: 100, backoff: 'exponential', maxDelayMs: 1000 }), 1000);
  });

  it('defaults maxDelayMs to 30000', () => {
    // attempt 20: 100 * 2^19 = way over 30000 → capped
    assert.equal(computeDelay(20, { delayMs: 100, backoff: 'exponential' }), 30000);
  });
});

describe('computeDelay() – defaults', () => {
  it('works with empty options object', () => {
    const delay = computeDelay(1, {});
    assert.equal(delay, 1000); // default delayMs=1000, exponential attempt 1
  });

  it('works with no options argument', () => {
    const delay = computeDelay(1);
    assert.equal(delay, 1000);
  });
});

// ─── retry() ─────────────────────────────────────────────────────────────────

describe('retry() – success on first attempt', () => {
  it('resolves with the return value immediately', async () => {
    const result = await retry(() => Promise.resolve(42), {
      maxAttempts: 3,
      delayMs: 1,
    });
    assert.equal(result, 42);
  });

  it('calls fn exactly once when successful', async () => {
    let calls = 0;
    await retry(async () => { calls++; return 'ok'; }, {
      maxAttempts: 3,
      delayMs: 1,
    });
    assert.equal(calls, 1);
  });
});

describe('retry() – retries on failure and eventually resolves', () => {
  it('succeeds on the 2nd attempt', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls < 2) throw new Error('not yet');
      return 'done';
    }, { maxAttempts: 3, delayMs: 1, backoff: 'fixed' });

    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });

  it('succeeds on the last allowed attempt', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'final';
    }, { maxAttempts: 3, delayMs: 1, backoff: 'fixed' });

    assert.equal(result, 'final');
    assert.equal(calls, 3);
  });
});

describe('retry() – throws when all attempts fail', () => {
  it('rejects with the last error after exhausting maxAttempts', async () => {
    let calls = 0;
    const err = new Error('always fails');

    await assert.rejects(
      () => retry(async () => { calls++; throw err; }, {
        maxAttempts: 3,
        delayMs: 1,
        backoff: 'fixed',
      }),
      (thrown) => thrown === err
    );

    assert.equal(calls, 3);
  });

  it('default maxAttempts is 3', async () => {
    let calls = 0;
    await assert.rejects(
      () => retry(async () => { calls++; throw new Error('x'); }, {
        delayMs: 1,
        backoff: 'fixed',
      })
    );
    assert.equal(calls, 3);
  });
});

describe('retry() – shouldRetry', () => {
  it('stops immediately when shouldRetry returns false', async () => {
    let calls = 0;
    const err = new Error('abort');

    await assert.rejects(
      () => retry(async () => { calls++; throw err; }, {
        maxAttempts: 5,
        delayMs: 1,
        backoff: 'fixed',
        shouldRetry: () => false,
      }),
      (thrown) => thrown === err
    );

    assert.equal(calls, 1);
  });

  it('retries while shouldRetry returns true, then stops', async () => {
    let calls = 0;

    await assert.rejects(
      () => retry(async () => { calls++; throw new Error('e'); }, {
        maxAttempts: 5,
        delayMs: 1,
        backoff: 'fixed',
        shouldRetry: (_err, attempt) => attempt < 3,
      })
    );

    // shouldRetry returns false at attempt=3, so we get 3 calls total
    assert.equal(calls, 3);
  });

  it('receives the thrown error and attempt number', async () => {
    const receivedArgs = [];
    const specificError = new Error('specific');

    await assert.rejects(
      () => retry(async () => { throw specificError; }, {
        maxAttempts: 2,
        delayMs: 1,
        backoff: 'fixed',
        shouldRetry: (err, attempt) => {
          receivedArgs.push({ err, attempt });
          return true;
        },
      })
    );

    assert.equal(receivedArgs[0].err, specificError);
    assert.equal(receivedArgs[0].attempt, 1);
  });
});

describe('retry() – onRetry', () => {
  it('called on each retry (not on final failure)', async () => {
    const log = [];

    await assert.rejects(
      () => retry(async () => { throw new Error('fail'); }, {
        maxAttempts: 3,
        delayMs: 1,
        backoff: 'fixed',
        onRetry: (err, attempt) => log.push(attempt),
      })
    );

    // 3 attempts → 2 retries (attempt 1 and 2)
    assert.deepEqual(log, [1, 2]);
  });

  it('not called when fn succeeds on first attempt', async () => {
    const log = [];
    await retry(async () => 'ok', {
      maxAttempts: 3,
      delayMs: 1,
      onRetry: () => log.push(true),
    });
    assert.equal(log.length, 0);
  });

  it('receives the error and attempt number', async () => {
    const log = [];
    const err = new Error('oops');

    await assert.rejects(
      () => retry(async () => { throw err; }, {
        maxAttempts: 2,
        delayMs: 1,
        backoff: 'fixed',
        onRetry: (e, attempt) => log.push({ e, attempt }),
      })
    );

    assert.equal(log[0].e, err);
    assert.equal(log[0].attempt, 1);
  });
});

// ─── createRetry() ───────────────────────────────────────────────────────────

describe('createRetry()', () => {
  it('returns a function', () => {
    const r = createRetry({ maxAttempts: 3, delayMs: 1 });
    assert.equal(typeof r, 'function');
  });

  it('the returned wrapper resolves successfully', async () => {
    const r = createRetry({ maxAttempts: 3, delayMs: 1, backoff: 'fixed' });
    const result = await r(() => Promise.resolve('hello'));
    assert.equal(result, 'hello');
  });

  it('the returned wrapper retries using the stored options', async () => {
    let calls = 0;
    const r = createRetry({ maxAttempts: 3, delayMs: 1, backoff: 'fixed' });

    const result = await r(async () => {
      calls++;
      if (calls < 2) throw new Error('x');
      return 'value';
    });

    assert.equal(result, 'value');
    assert.equal(calls, 2);
  });

  it('can be reused for multiple invocations', async () => {
    const r = createRetry({ maxAttempts: 2, delayMs: 1, backoff: 'fixed' });

    const a = await r(() => Promise.resolve(1));
    const b = await r(() => Promise.resolve(2));
    assert.equal(a, 1);
    assert.equal(b, 2);
  });
});

// ─── withTimeout() ───────────────────────────────────────────────────────────

describe('withTimeout()', () => {
  it('resolves with the function result when it completes in time', async () => {
    const result = await withTimeout(() => Promise.resolve('fast'), 500);
    assert.equal(result, 'fast');
  });

  it('throws an Error with message "timeout" when fn is too slow', async () => {
    const slowFn = () => new Promise(resolve => setTimeout(resolve, 200));

    await assert.rejects(
      () => withTimeout(slowFn, 5),
      (err) => err instanceof Error && err.message === 'timeout'
    );
  });

  it('error is an instance of Error', async () => {
    await assert.rejects(
      () => withTimeout(() => new Promise(() => {}), 2),
      (err) => err instanceof Error
    );
  });

  it('propagates fn rejection without wrapping', async () => {
    const originalErr = new Error('fn error');

    await assert.rejects(
      () => withTimeout(() => Promise.reject(originalErr), 500),
      (err) => err === originalErr
    );
  });
});

// ─── raceTimeout() ───────────────────────────────────────────────────────────

describe('raceTimeout()', () => {
  it('resolves with the promise value when it wins', async () => {
    const result = await raceTimeout(Promise.resolve('winner'), 500);
    assert.equal(result, 'winner');
  });

  it('resolves with null when the promise is slower than timeout', async () => {
    const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 200));
    const result = await raceTimeout(slowPromise, 5);
    assert.equal(result, null);
  });

  it('returns null (not throws) on timeout', async () => {
    const neverResolves = new Promise(() => {});
    const result = await raceTimeout(neverResolves, 2);
    assert.equal(result, null);
  });

  it('works with a promise that resolves to a falsy value', async () => {
    const result = await raceTimeout(Promise.resolve(0), 500);
    assert.equal(result, 0);
  });

  it('works with a promise that resolves to false', async () => {
    const result = await raceTimeout(Promise.resolve(false), 500);
    assert.equal(result, false);
  });
});
