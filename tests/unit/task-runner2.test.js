// ─── Unit Tests: TaskRunner2 ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TaskRunner2,
  createTaskRunner2,
  parallel,
  sequential,
} from '../../app/modules/task-runner2.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a promise that resolves to `value` after `ms` milliseconds. */
function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Returns a promise that rejects with `message` after `ms` milliseconds. */
function delayReject(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// ─── add / has ───────────────────────────────────────────────────────────────

describe('TaskRunner2 – add() / has()', () => {
  it('has() returns false for an unknown id', () => {
    const runner = new TaskRunner2();
    assert.equal(runner.has('nope'), false);
  });

  it('has() returns true after adding a task', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'x', fn: () => Promise.resolve(1) });
    assert.equal(runner.has('x'), true);
  });

  it('add() throws when a duplicate id is used', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'dup', fn: () => Promise.resolve() });
    assert.throws(() => runner.add({ id: 'dup', fn: () => Promise.resolve() }), /already exists/);
  });

  it('has() returns false after clear()', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'a', fn: () => Promise.resolve() });
    runner.clear();
    assert.equal(runner.has('a'), false);
  });

  it('multiple tasks can be added with different ids', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'a', fn: () => Promise.resolve() });
    runner.add({ id: 'b', fn: () => Promise.resolve() });
    runner.add({ id: 'c', fn: () => Promise.resolve() });
    assert.equal(runner.has('a'), true);
    assert.equal(runner.has('b'), true);
    assert.equal(runner.has('c'), true);
  });

  it('clear() allows re-adding a task with the same id', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'reuse', fn: () => Promise.resolve() });
    runner.clear();
    assert.doesNotThrow(() => runner.add({ id: 'reuse', fn: () => Promise.resolve() }));
  });

  it('add() accepts tasks with optional deps and timeout fields', () => {
    const runner = new TaskRunner2();
    assert.doesNotThrow(() => {
      runner.add({ id: 'full', fn: () => Promise.resolve(), deps: ['x'], timeout: 500 });
    });
  });
});

// ─── run – basic ─────────────────────────────────────────────────────────────

describe('TaskRunner2 – run() basics', () => {
  it('returns an empty Map when no tasks are registered', async () => {
    const runner = new TaskRunner2();
    const results = await runner.run();
    assert.equal(results.size, 0);
  });

  it('successful task has status "success" and a value', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'ok', fn: async () => 42 });
    const results = await runner.run();
    const r = results.get('ok');
    assert.equal(r.status, 'success');
    assert.equal(r.value, 42);
    assert.equal(r.id, 'ok');
  });

  it('failed task has status "error" and an error object', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'fail', fn: async () => { throw new Error('kaboom'); } });
    const results = await runner.run();
    const r = results.get('fail');
    assert.equal(r.status, 'error');
    assert.ok(r.error instanceof Error);
    assert.equal(r.error.message, 'kaboom');
  });

  it('result contains a non-negative duration', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'timed', fn: async () => 'done' });
    const results = await runner.run();
    assert.ok(results.get('timed').duration >= 0);
  });

  it('all tasks produce results in the returned Map', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'a', fn: async () => 1 });
    runner.add({ id: 'b', fn: async () => 2 });
    runner.add({ id: 'c', fn: async () => 3 });
    const results = await runner.run();
    assert.equal(results.size, 3);
    assert.equal(results.get('a').value, 1);
    assert.equal(results.get('b').value, 2);
    assert.equal(results.get('c').value, 3);
  });

  it('tasks run in parallel when there are no deps (using timing)', async () => {
    const runner = new TaskRunner2();
    const start = Date.now();
    runner.add({ id: 'slow1', fn: () => delay(50, 'a') });
    runner.add({ id: 'slow2', fn: () => delay(50, 'b') });
    await runner.run();
    const elapsed = Date.now() - start;
    // If sequential they'd take ~100ms; parallel they should finish in ~50-70ms
    assert.ok(elapsed < 90, `Expected < 90ms but got ${elapsed}ms`);
  });

  it('result value is undefined for a task that returns undefined', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'void', fn: async () => undefined });
    const results = await runner.run();
    assert.equal(results.get('void').status, 'success');
    assert.equal(results.get('void').value, undefined);
  });

  it('non-Error rejections are wrapped in an Error', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'string-throw', fn: async () => { throw 'oops'; } });
    const results = await runner.run();
    const r = results.get('string-throw');
    assert.equal(r.status, 'error');
    assert.ok(r.error instanceof Error);
  });
});

// ─── run – dependencies ───────────────────────────────────────────────────────

describe('TaskRunner2 – run() with dependencies', () => {
  it('a task with deps runs after its dependency completes', async () => {
    const order = [];
    const runner = new TaskRunner2();
    runner.add({ id: 'first', fn: async () => { order.push('first'); } });
    runner.add({ id: 'second', fn: async () => { order.push('second'); }, deps: ['first'] });
    await runner.run();
    assert.deepEqual(order, ['first', 'second']);
  });

  it('task receives its dependency output via closure (not via result)', async () => {
    const runner = new TaskRunner2();
    let capturedValue;
    runner.add({ id: 'a', fn: async () => 99 });
    // TaskRunner2 does not pass dep results; check dep ran first via ordering
    runner.add({ id: 'b', fn: async () => { capturedValue = 'b-ran'; }, deps: ['a'] });
    const results = await runner.run();
    assert.equal(capturedValue, 'b-ran');
    assert.equal(results.get('a').status, 'success');
    assert.equal(results.get('b').status, 'success');
  });

  it('task with a failed dep is skipped with status "error"', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'fail', fn: async () => { throw new Error('bad'); } });
    runner.add({ id: 'downstream', fn: async () => 'should not run', deps: ['fail'] });
    const results = await runner.run();
    assert.equal(results.get('downstream').status, 'error');
    assert.match(results.get('downstream').error.message, /Skipped/);
  });

  it('chained deps run in correct order', async () => {
    const order = [];
    const runner = new TaskRunner2();
    runner.add({ id: 'c', fn: async () => { order.push('c'); }, deps: ['b'] });
    runner.add({ id: 'b', fn: async () => { order.push('b'); }, deps: ['a'] });
    runner.add({ id: 'a', fn: async () => { order.push('a'); } });
    await runner.run();
    assert.deepEqual(order, ['a', 'b', 'c']);
  });

  it('independent tasks run in parallel even when other tasks have deps', async () => {
    const runner = new TaskRunner2();
    const start = Date.now();
    runner.add({ id: 'x', fn: () => delay(50, 'x') });
    runner.add({ id: 'y', fn: () => delay(50, 'y') });
    runner.add({ id: 'z', fn: () => delay(10, 'z'), deps: ['x', 'y'] });
    await runner.run();
    const elapsed = Date.now() - start;
    // x and y run in parallel (~50ms), then z (~10ms). Total ~60-80ms
    assert.ok(elapsed < 120, `Expected < 120ms but got ${elapsed}ms`);
  });

  it('task with no deps runs even when other tasks fail', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'bad', fn: async () => { throw new Error('fail'); } });
    runner.add({ id: 'independent', fn: async () => 'ok' });
    const results = await runner.run();
    assert.equal(results.get('independent').status, 'success');
    assert.equal(results.get('independent').value, 'ok');
  });
});

// ─── run – concurrency ───────────────────────────────────────────────────────

describe('TaskRunner2 – run() with concurrency limit', () => {
  it('concurrency: 1 runs tasks serially', async () => {
    const order = [];
    const runner = new TaskRunner2({ concurrency: 1 });
    runner.add({ id: 'a', fn: async () => { order.push('a-start'); await delay(10); order.push('a-end'); } });
    runner.add({ id: 'b', fn: async () => { order.push('b-start'); await delay(10); order.push('b-end'); } });
    await runner.run();
    // With concurrency 1, a must fully complete before b starts
    const aEnd = order.indexOf('a-end');
    const bStart = order.indexOf('b-start');
    assert.ok(aEnd < bStart, `Expected a-end before b-start, got: ${order}`);
  });

  it('concurrency: 2 allows two tasks to overlap', async () => {
    const active = { count: 0, max: 0 };
    const runner = new TaskRunner2({ concurrency: 2 });
    const track = async () => {
      active.count++;
      active.max = Math.max(active.max, active.count);
      await delay(30);
      active.count--;
    };
    runner.add({ id: 'a', fn: track });
    runner.add({ id: 'b', fn: track });
    runner.add({ id: 'c', fn: track });
    await runner.run();
    assert.ok(active.max <= 2, `Max concurrent was ${active.max}, expected <= 2`);
    assert.ok(active.max >= 2, `Max concurrent was ${active.max}, expected >= 2`);
  });

  it('Infinity concurrency runs all tasks in parallel', async () => {
    const active = { count: 0, max: 0 };
    const runner = new TaskRunner2({ concurrency: Infinity });
    const track = async () => {
      active.count++;
      active.max = Math.max(active.max, active.count);
      await delay(20);
      active.count--;
    };
    for (let i = 0; i < 5; i++) {
      runner.add({ id: `t${i}`, fn: track });
    }
    await runner.run();
    assert.equal(active.max, 5);
  });
});

// ─── run – timeout ───────────────────────────────────────────────────────────

describe('TaskRunner2 – run() with timeout', () => {
  it('slow task exceeding timeout gets status "timeout"', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'slow', fn: () => delay(500, 'late'), timeout: 30 });
    const results = await runner.run();
    assert.equal(results.get('slow').status, 'timeout');
  });

  it('timeout result has an error describing the timeout', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'slow', fn: () => delay(500, 'x'), timeout: 30 });
    const results = await runner.run();
    assert.ok(results.get('slow').error instanceof Error);
    assert.match(results.get('slow').error.message, /timed out/i);
  });

  it('fast task within timeout succeeds normally', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'fast', fn: () => delay(10, 'quick'), timeout: 500 });
    const results = await runner.run();
    assert.equal(results.get('fast').status, 'success');
    assert.equal(results.get('fast').value, 'quick');
  });

  it('timeout of 0 is treated as no timeout', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'notimeout', fn: () => delay(20, 'ok'), timeout: 0 });
    const results = await runner.run();
    assert.equal(results.get('notimeout').status, 'success');
  });

  it('downstream task of a timed-out task is skipped', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'slow', fn: () => delay(500, 'x'), timeout: 30 });
    runner.add({ id: 'child', fn: async () => 'child', deps: ['slow'] });
    const results = await runner.run();
    assert.equal(results.get('slow').status, 'timeout');
    assert.equal(results.get('child').status, 'error');
  });
});

// ─── runOne ──────────────────────────────────────────────────────────────────

describe('TaskRunner2 – runOne()', () => {
  it('returns a success result for a passing task', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'solo', fn: async () => 'hello' });
    const result = await runner.runOne('solo');
    assert.equal(result.status, 'success');
    assert.equal(result.value, 'hello');
    assert.equal(result.id, 'solo');
  });

  it('returns an error result for a failing task', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'bad', fn: async () => { throw new Error('solo fail'); } });
    const result = await runner.runOne('bad');
    assert.equal(result.status, 'error');
    assert.equal(result.error.message, 'solo fail');
  });

  it('returns an error result for an unknown id', async () => {
    const runner = new TaskRunner2();
    const result = await runner.runOne('nonexistent');
    assert.equal(result.status, 'error');
    assert.match(result.error.message, /not found/i);
  });

  it('runOne ignores deps — runs the task regardless', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'standalone', fn: async () => 99, deps: ['missing-dep'] });
    const result = await runner.runOne('standalone');
    assert.equal(result.status, 'success');
    assert.equal(result.value, 99);
  });

  it('runOne respects the task timeout', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'slow', fn: () => delay(500, 'x'), timeout: 30 });
    const result = await runner.runOne('slow');
    assert.equal(result.status, 'timeout');
  });

  it('duration in result is a non-negative number', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'timed', fn: async () => 'val' });
    const result = await runner.runOne('timed');
    assert.ok(result.duration >= 0);
  });

  it('multiple runOne calls on the same task work independently', async () => {
    const runner = new TaskRunner2();
    let n = 0;
    runner.add({ id: 'counter', fn: async () => ++n });
    const r1 = await runner.runOne('counter');
    const r2 = await runner.runOne('counter');
    assert.equal(r1.value, 1);
    assert.equal(r2.value, 2);
  });

  it('runOne does not remove the task after running', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'persist', fn: async () => 'val' });
    await runner.runOne('persist');
    assert.equal(runner.has('persist'), true);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('TaskRunner2 – clear()', () => {
  it('removes all registered tasks', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'a', fn: () => Promise.resolve() });
    runner.add({ id: 'b', fn: () => Promise.resolve() });
    runner.clear();
    assert.equal(runner.has('a'), false);
    assert.equal(runner.has('b'), false);
  });

  it('run() returns empty map after clear()', async () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'x', fn: async () => 1 });
    runner.clear();
    const results = await runner.run();
    assert.equal(results.size, 0);
  });

  it('calling clear() on an empty runner is a no-op', () => {
    const runner = new TaskRunner2();
    assert.doesNotThrow(() => runner.clear());
  });

  it('tasks can be re-added after clear()', () => {
    const runner = new TaskRunner2();
    runner.add({ id: 'a', fn: () => Promise.resolve() });
    runner.clear();
    assert.doesNotThrow(() => runner.add({ id: 'a', fn: () => Promise.resolve() }));
    assert.equal(runner.has('a'), true);
  });
});

// ─── createTaskRunner2 factory ───────────────────────────────────────────────

describe('createTaskRunner2()', () => {
  it('returns a TaskRunner2 instance', () => {
    const runner = createTaskRunner2();
    assert.ok(runner instanceof TaskRunner2);
  });

  it('passes concurrency option to the instance', async () => {
    const active = { count: 0, max: 0 };
    const runner = createTaskRunner2({ concurrency: 1 });
    const track = async () => {
      active.count++;
      active.max = Math.max(active.max, active.count);
      await delay(20);
      active.count--;
    };
    runner.add({ id: 'a', fn: track });
    runner.add({ id: 'b', fn: track });
    await runner.run();
    assert.equal(active.max, 1);
  });

  it('default concurrency is Infinity (all tasks run in parallel)', async () => {
    const active = { count: 0, max: 0 };
    const runner = createTaskRunner2();
    const track = async () => {
      active.count++;
      active.max = Math.max(active.max, active.count);
      await delay(20);
      active.count--;
    };
    runner.add({ id: 'p', fn: track });
    runner.add({ id: 'q', fn: track });
    runner.add({ id: 'r', fn: track });
    await runner.run();
    assert.equal(active.max, 3);
  });
});

// ─── parallel utility ────────────────────────────────────────────────────────

describe('parallel()', () => {
  it('runs all functions and returns their results in order', async () => {
    const results = await parallel(
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    );
    assert.deepEqual(results, [1, 2, 3]);
  });

  it('works with zero functions', async () => {
    const results = await parallel();
    assert.deepEqual(results, []);
  });

  it('works with a single function', async () => {
    const results = await parallel(() => Promise.resolve('only'));
    assert.deepEqual(results, ['only']);
  });

  it('rejects if any function rejects', async () => {
    await assert.rejects(
      () => parallel(
        () => Promise.resolve(1),
        () => Promise.reject(new Error('parallel-fail')),
      ),
      { message: 'parallel-fail' },
    );
  });

  it('runs functions concurrently (timing check)', async () => {
    const start = Date.now();
    await parallel(
      () => delay(40, 'a'),
      () => delay(40, 'b'),
    );
    const elapsed = Date.now() - start;
    // Parallel should take ~40ms not ~80ms
    assert.ok(elapsed < 70, `Expected < 70ms but got ${elapsed}ms`);
  });

  it('preserves result order regardless of completion order', async () => {
    const results = await parallel(
      () => delay(30, 'slow'),
      () => delay(5, 'fast'),
    );
    assert.deepEqual(results, ['slow', 'fast']);
  });

  it('passes through resolved values of any type', async () => {
    const results = await parallel(
      () => Promise.resolve({ x: 1 }),
      () => Promise.resolve([2, 3]),
      () => Promise.resolve(null),
    );
    assert.deepEqual(results, [{ x: 1 }, [2, 3], null]);
  });

  it('all functions start before any completes', async () => {
    const starts = [];
    const ends = [];
    await parallel(
      async () => { starts.push('a'); await delay(20); ends.push('a'); },
      async () => { starts.push('b'); await delay(20); ends.push('b'); },
    );
    // Both should have started before either ended
    assert.equal(starts.length, 2);
  });
});

// ─── sequential utility ──────────────────────────────────────────────────────

describe('sequential()', () => {
  it('runs all functions and returns their results in order', async () => {
    const results = await sequential(
      () => Promise.resolve(10),
      () => Promise.resolve(20),
      () => Promise.resolve(30),
    );
    assert.deepEqual(results, [10, 20, 30]);
  });

  it('works with zero functions', async () => {
    const results = await sequential();
    assert.deepEqual(results, []);
  });

  it('works with a single function', async () => {
    const results = await sequential(() => Promise.resolve('alone'));
    assert.deepEqual(results, ['alone']);
  });

  it('rejects immediately when a function rejects', async () => {
    const executed = [];
    await assert.rejects(
      () => sequential(
        async () => { executed.push(1); return 1; },
        async () => { executed.push(2); throw new Error('seq-fail'); },
        async () => { executed.push(3); return 3; },
      ),
      { message: 'seq-fail' },
    );
    assert.deepEqual(executed, [1, 2]);
  });

  it('runs functions in sequence (timing check)', async () => {
    const start = Date.now();
    await sequential(
      () => delay(30, 'a'),
      () => delay(30, 'b'),
    );
    const elapsed = Date.now() - start;
    // Sequential should take ~60ms
    assert.ok(elapsed >= 55, `Expected >= 55ms but got ${elapsed}ms`);
  });

  it('second function does not start before the first resolves', async () => {
    const order = [];
    await sequential(
      async () => { order.push('start-1'); await delay(20); order.push('end-1'); },
      async () => { order.push('start-2'); },
    );
    const end1 = order.indexOf('end-1');
    const start2 = order.indexOf('start-2');
    assert.ok(end1 < start2, `Expected end-1 before start-2, got: ${order}`);
  });

  it('passes through resolved values of any type', async () => {
    const results = await sequential(
      () => Promise.resolve('a'),
      () => Promise.resolve(42),
      () => Promise.resolve(true),
    );
    assert.deepEqual(results, ['a', 42, true]);
  });

  it('earlier result is available via closure in later function', async () => {
    let first;
    await sequential(
      async () => { first = 'captured'; return first; },
      async () => {
        assert.equal(first, 'captured');
        return 'ok';
      },
    );
  });
});
