// ─── Unit Tests: Task Scheduler ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSchedulerSupported,
  postTask,
  postUserBlockingTask,
  postBackgroundTask,
  yieldToMain,
} from '../../app/modules/task-scheduler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save and restore globalThis.scheduler around tests that mock it. */
function withSchedulerMock(mock) {
  const prev = globalThis.scheduler;
  globalThis.scheduler = mock;
  return () => {
    if (prev === undefined) {
      delete globalThis.scheduler;
    } else {
      globalThis.scheduler = prev;
    }
  };
}

// ---------------------------------------------------------------------------
// isSchedulerSupported
// ---------------------------------------------------------------------------

describe('isSchedulerSupported', () => {
  it('returns false when scheduler is not defined', () => {
    const restore = withSchedulerMock(undefined);
    delete globalThis.scheduler;
    try {
      assert.equal(isSchedulerSupported(), false);
    } finally {
      restore();
    }
  });

  it('returns false when scheduler.postTask is not a function', () => {
    const restore = withSchedulerMock({ postTask: 'not-a-function' });
    try {
      assert.equal(isSchedulerSupported(), false);
    } finally {
      restore();
    }
  });

  it('returns true when scheduler.postTask is a function', () => {
    const restore = withSchedulerMock({ postTask: () => {} });
    try {
      assert.equal(isSchedulerSupported(), true);
    } finally {
      restore();
    }
  });

  it('always returns a boolean', () => {
    assert.equal(typeof isSchedulerSupported(), 'boolean');
  });
});

// ---------------------------------------------------------------------------
// postTask – fallback path (no native scheduler)
// ---------------------------------------------------------------------------

describe('postTask – fallback path', () => {
  let restoreScheduler;

  beforeEach(() => {
    // Ensure we are testing the fallback path
    restoreScheduler = withSchedulerMock(undefined);
    delete globalThis.scheduler;
  });

  afterEach(() => {
    restoreScheduler();
  });

  it('executes callback and returns its result', async () => {
    const result = await postTask(() => 42);
    assert.equal(result, 42);
  });

  it('resolves with user-blocking priority', async () => {
    const result = await postTask(() => 'fast', { priority: 'user-blocking' });
    assert.equal(result, 'fast');
  });

  it('resolves with user-visible priority (default)', async () => {
    const result = await postTask(() => 'default');
    assert.equal(result, 'default');
  });

  it('resolves with background priority', async () => {
    const result = await postTask(() => 'bg', { priority: 'background' });
    assert.equal(result, 'bg');
  });

  it('respects delay option', async () => {
    const start = Date.now();
    const result = await postTask(() => 'delayed', { delay: 50 });
    const elapsed = Date.now() - start;
    assert.equal(result, 'delayed');
    assert.ok(elapsed >= 30, `expected at least 30ms elapsed, got ${elapsed}ms`);
  });

  it('propagates callback errors as rejections', async () => {
    await assert.rejects(
      () => postTask(() => { throw new Error('boom'); }),
      { message: 'boom' },
    );
  });

  it('rejects immediately if signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
      () => postTask(() => 'never', { signal: ac.signal }),
    );
  });

  it('rejects when signal is aborted after scheduling', async () => {
    const ac = new AbortController();
    const promise = postTask(() => 'never', { delay: 5000, signal: ac.signal });
    ac.abort();
    await assert.rejects(() => promise);
  });
});

// ---------------------------------------------------------------------------
// postTask – native scheduler path
// ---------------------------------------------------------------------------

describe('postTask – native scheduler path', () => {
  let restoreScheduler;

  beforeEach(() => {
    restoreScheduler = withSchedulerMock({
      postTask: (cb, opts) => Promise.resolve(cb()),
    });
  });

  afterEach(() => {
    restoreScheduler();
  });

  it('delegates to scheduler.postTask when available', async () => {
    const result = await postTask(() => 'native');
    assert.equal(result, 'native');
  });

  it('passes options through to scheduler.postTask', async () => {
    let receivedOpts;
    const restore = withSchedulerMock({
      postTask: (cb, opts) => {
        receivedOpts = opts;
        return Promise.resolve(cb());
      },
    });
    try {
      await postTask(() => {}, { priority: 'user-blocking', delay: 100 });
      assert.equal(receivedOpts.priority, 'user-blocking');
      assert.equal(receivedOpts.delay, 100);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// postUserBlockingTask
// ---------------------------------------------------------------------------

describe('postUserBlockingTask', () => {
  it('executes callback and returns result', async () => {
    const result = await postUserBlockingTask(() => 'blocking');
    assert.equal(result, 'blocking');
  });
});

// ---------------------------------------------------------------------------
// postBackgroundTask
// ---------------------------------------------------------------------------

describe('postBackgroundTask', () => {
  it('executes callback and returns result', async () => {
    const result = await postBackgroundTask(() => 'background');
    assert.equal(result, 'background');
  });
});

// ---------------------------------------------------------------------------
// yieldToMain
// ---------------------------------------------------------------------------

describe('yieldToMain', () => {
  it('resolves without hanging', async () => {
    await yieldToMain();
    // if we get here, it resolved
    assert.ok(true);
  });

  it('uses scheduler.yield when available', async () => {
    let called = false;
    const restore = withSchedulerMock({
      postTask: () => {},
      yield: () => { called = true; return Promise.resolve(); },
    });
    try {
      await yieldToMain();
      assert.equal(called, true);
    } finally {
      restore();
    }
  });

  it('falls back to setTimeout when scheduler.yield is not available', async () => {
    const restore = withSchedulerMock(undefined);
    delete globalThis.scheduler;
    try {
      // Should resolve without error
      await yieldToMain();
      assert.ok(true);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Fallback verification
// ---------------------------------------------------------------------------

describe('fallback path is used in Node.js', () => {
  it('isSchedulerSupported returns false in Node.js test environment', () => {
    // In Node.js, globalThis.scheduler is not defined by default
    const prev = globalThis.scheduler;
    delete globalThis.scheduler;
    try {
      assert.equal(isSchedulerSupported(), false);
    } finally {
      if (prev !== undefined) {
        globalThis.scheduler = prev;
      }
    }
  });

  it('postTask still works via setTimeout/requestIdleCallback fallback', async () => {
    const prev = globalThis.scheduler;
    delete globalThis.scheduler;
    try {
      const results = await Promise.all([
        postTask(() => 1, { priority: 'user-blocking' }),
        postTask(() => 2, { priority: 'user-visible' }),
        postTask(() => 3, { priority: 'background' }),
      ]);
      assert.deepEqual(results, [1, 2, 3]);
    } finally {
      if (prev !== undefined) {
        globalThis.scheduler = prev;
      }
    }
  });
});
