// ─── Unit Tests: Pipeline ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Pipeline,
  AsyncPipeline,
  pipeline,
  asyncPipeline,
  pipeValue,
} from '../../app/modules/pipeline.js';

// ─── Pipeline basic pipe() and execute() ─────────────────────────────────────

describe('Pipeline – basic pipe() and execute()', () => {
  it('execute() returns the input unchanged with no steps', () => {
    const p = new Pipeline();
    assert.equal(p.execute(42), 42);
  });

  it('pipe() transforms value with a single function', () => {
    const result = new Pipeline().pipe((n) => n * 2).execute(5);
    assert.equal(result, 10);
  });

  it('execute() returns string input unchanged', () => {
    const p = new Pipeline();
    assert.equal(p.execute('hello'), 'hello');
  });

  it('pipe() can change the type of the value', () => {
    const result = new Pipeline().pipe((n) => String(n)).execute(42);
    assert.equal(result, '42');
  });

  it('run() is an alias for execute()', () => {
    const p = new Pipeline().pipe((n) => n + 1);
    assert.equal(p.run(9), p.execute(9));
  });

  it('run() returns the correct value', () => {
    const result = new Pipeline().pipe((n) => n * 3).run(7);
    assert.equal(result, 21);
  });

  it('pipe() returns a new Pipeline instance', () => {
    const p1 = new Pipeline();
    const p2 = p1.pipe((n) => n);
    assert.ok(p2 instanceof Pipeline);
    assert.notEqual(p1, p2);
  });

  it('original pipeline is unaffected when a derived one is created', () => {
    const p1 = new Pipeline().pipe((n) => n + 1);
    const p2 = p1.pipe((n) => n * 100);
    assert.equal(p1.execute(5), 6);
    assert.equal(p2.execute(5), 600);
  });
});

// ─── Pipeline multiple steps (composition) ───────────────────────────────────

describe('Pipeline – multiple steps', () => {
  it('chains two pipe steps correctly', () => {
    const result = new Pipeline()
      .pipe((n) => n + 1)
      .pipe((n) => n * 2)
      .execute(3);
    assert.equal(result, 8);
  });

  it('chains three pipe steps correctly', () => {
    const result = new Pipeline()
      .pipe((n) => n + 1)
      .pipe((n) => n * 3)
      .pipe((n) => n - 1)
      .execute(1);
    assert.equal(result, 5);
  });

  it('map() over array produces mapped results', () => {
    const result = new Pipeline()
      .map((n) => n * 2)
      .execute([1, 2, 3]);
    assert.deepEqual(result, [2, 4, 6]);
  });

  it('filter() removes items that fail the predicate', () => {
    const result = new Pipeline()
      .filter((n) => n > 2)
      .execute([1, 2, 3, 4]);
    assert.deepEqual(result, [3, 4]);
  });

  it('pipe after map transforms the whole array', () => {
    const result = new Pipeline()
      .map((n) => n * 2)
      .pipe((arr) => arr.length)
      .execute([1, 2, 3]);
    assert.equal(result, 3);
  });

  it('map() wraps scalar in array and maps it', () => {
    const result = new Pipeline()
      .map((n) => n + 10)
      .execute(5);
    assert.deepEqual(result, [15]);
  });

  it('filter() passes scalar value through unchanged', () => {
    const result = new Pipeline()
      .filter(() => false)
      .execute(42);
    assert.equal(result, 42);
  });
});

// ─── Pipeline tap() ───────────────────────────────────────────────────────────

describe('Pipeline – tap()', () => {
  it('does not change the value', () => {
    const result = new Pipeline().tap((_n) => 9999).execute(7);
    assert.equal(result, 7);
  });

  it('calls the side-effect function', () => {
    let called = false;
    new Pipeline().tap(() => { called = true; }).execute(1);
    assert.ok(called);
  });

  it('passes the current value to the side-effect', () => {
    let seen;
    new Pipeline().tap((n) => { seen = n; }).execute(55);
    assert.equal(seen, 55);
  });

  it('returns Pipeline instance', () => {
    const p = new Pipeline().tap(() => {});
    assert.ok(p instanceof Pipeline);
  });

  it('side effect sees the value after prior pipe steps', () => {
    let seen;
    new Pipeline()
      .pipe((n) => n * 10)
      .tap((n) => { seen = n; })
      .execute(3);
    assert.equal(seen, 30);
  });

  it('multiple taps all fire in order', () => {
    const log = [];
    new Pipeline()
      .tap((n) => log.push(n))
      .pipe((n) => n + 1)
      .tap((n) => log.push(n))
      .pipe((n) => n + 1)
      .tap((n) => log.push(n))
      .execute(0);
    assert.deepEqual(log, [0, 1, 2]);
  });
});

// ─── Pipeline catch() ────────────────────────────────────────────────────────

describe('Pipeline – catch()', () => {
  it('recovers from a thrown error', () => {
    const result = new Pipeline()
      .pipe(() => { throw new Error('boom'); })
      .catch((err) => `caught: ${err.message}`)
      .execute(1);
    assert.equal(result, 'caught: boom');
  });

  it('passes through cleanly when no error is thrown', () => {
    const result = new Pipeline()
      .pipe((n) => n * 2)
      .catch((err) => `error: ${err.message}`)
      .execute(5);
    assert.equal(result, 10);
  });

  it('error in second step is caught', () => {
    const result = new Pipeline()
      .pipe((n) => n + 1)
      .pipe(() => { throw new Error('step2'); })
      .catch((err) => err.message)
      .execute(0);
    assert.equal(result, 'step2');
  });

  it('throws when no catch and step throws', () => {
    const p = new Pipeline().pipe(() => { throw new Error('uncaught'); });
    assert.throws(() => p.execute(0), /uncaught/);
  });

  it('catch handler receives the Error object', () => {
    let caughtErr;
    new Pipeline()
      .pipe(() => { throw new Error('test error'); })
      .catch((err) => { caughtErr = err; return null; })
      .execute(0);
    assert.ok(caughtErr instanceof Error);
    assert.equal(caughtErr.message, 'test error');
  });
});

// ─── AsyncPipeline with async steps ──────────────────────────────────────────

describe('AsyncPipeline – async steps', () => {
  it('execute() with no steps returns input', async () => {
    const result = await new AsyncPipeline().execute(42);
    assert.equal(result, 42);
  });

  it('pipe() with an async function', async () => {
    const result = await new AsyncPipeline()
      .pipe(async (n) => n * 2)
      .execute(5);
    assert.equal(result, 10);
  });

  it('pipe() with a sync function', async () => {
    const result = await new AsyncPipeline()
      .pipe((n) => n + 10)
      .execute(5);
    assert.equal(result, 15);
  });

  it('run() is an alias for execute()', async () => {
    const p = new AsyncPipeline().pipe(async (n) => n + 1);
    assert.equal(await p.run(9), await p.execute(9));
  });

  it('map() resolves async mapper over array', async () => {
    const result = await new AsyncPipeline()
      .map(async (n) => n * 3)
      .execute([1, 2, 3]);
    assert.deepEqual(result, [3, 6, 9]);
  });

  it('filter() resolves async predicate over array', async () => {
    const result = await new AsyncPipeline()
      .filter(async (n) => n % 2 === 0)
      .execute([1, 2, 3, 4]);
    assert.deepEqual(result, [2, 4]);
  });
});

// ─── AsyncPipeline multiple async steps ──────────────────────────────────────

describe('AsyncPipeline – multiple async steps', () => {
  it('chains two async pipe steps', async () => {
    const result = await new AsyncPipeline()
      .pipe(async (n) => n + 1)
      .pipe(async (n) => n * 2)
      .execute(3);
    assert.equal(result, 8);
  });

  it('chains three async and sync steps', async () => {
    const result = await new AsyncPipeline()
      .pipe((n) => n + 1)
      .pipe(async (n) => n * 3)
      .pipe((n) => n - 1)
      .execute(1);
    assert.equal(result, 5);
  });

  it('tap() runs side effect and passes value through', async () => {
    let seen;
    const result = await new AsyncPipeline()
      .tap(async (n) => { seen = n; })
      .execute(99);
    assert.equal(result, 99);
    assert.equal(seen, 99);
  });

  it('tap() awaits the async side effect before proceeding', async () => {
    const log = [];
    await new AsyncPipeline()
      .tap(async () => { log.push('tap'); })
      .pipe((n) => { log.push('pipe'); return n; })
      .execute(1);
    assert.deepEqual(log, ['tap', 'pipe']);
  });

  it('filter() scalar passes through unchanged', async () => {
    const result = await new AsyncPipeline()
      .filter(async () => false)
      .execute(42);
    assert.equal(result, 42);
  });

  it('map() then pipe() chains correctly', async () => {
    const result = await new AsyncPipeline()
      .map(async (n) => n * 2)
      .pipe((arr) => arr.reduce((a, b) => a + b, 0))
      .execute([1, 2, 3]);
    assert.equal(result, 12);
  });
});

// ─── AsyncPipeline catch() ────────────────────────────────────────────────────

describe('AsyncPipeline – catch()', () => {
  it('recovers from async error', async () => {
    const result = await new AsyncPipeline()
      .pipe(async () => { throw new Error('async boom'); })
      .catch(async (err) => `caught: ${err.message}`)
      .execute(1);
    assert.equal(result, 'caught: async boom');
  });

  it('passes through cleanly when no error occurs', async () => {
    const result = await new AsyncPipeline()
      .pipe(async (n) => n * 2)
      .catch(async (err) => `error: ${err.message}`)
      .execute(5);
    assert.equal(result, 10);
  });

  it('catches error thrown in second step', async () => {
    const result = await new AsyncPipeline()
      .pipe(async (n) => n + 1)
      .pipe(async () => { throw new Error('step2 async'); })
      .catch((err) => err.message)
      .execute(0);
    assert.equal(result, 'step2 async');
  });

  it('rejects when no catch and step throws', async () => {
    const p = new AsyncPipeline().pipe(async () => { throw new Error('no catch'); });
    await assert.rejects(() => p.execute(0), /no catch/);
  });

  it('catch handler receives the Error object', async () => {
    let caughtErr;
    await new AsyncPipeline()
      .pipe(async () => { throw new Error('async error obj'); })
      .catch(async (err) => { caughtErr = err; return null; })
      .execute(0);
    assert.ok(caughtErr instanceof Error);
    assert.equal(caughtErr.message, 'async error obj');
  });
});

// ─── pipeline() factory ───────────────────────────────────────────────────────

describe('pipeline() factory', () => {
  it('returns a Pipeline instance', () => {
    const p = pipeline();
    assert.ok(p instanceof Pipeline);
  });

  it('pipeline can execute immediately', () => {
    assert.equal(pipeline().execute(99), 99);
  });

  it('pipeline factory with pipe and execute', () => {
    const result = pipeline().pipe((n) => n * 2).execute(6);
    assert.equal(result, 12);
  });

  it('pipeline factory with multiple steps', () => {
    const result = pipeline()
      .pipe((s) => s.trim())
      .pipe((s) => s.toUpperCase())
      .execute('  hello  ');
    assert.equal(result, 'HELLO');
  });

  it('pipeline factory produces independent pipelines', () => {
    const p1 = pipeline().pipe((n) => n + 1);
    const p2 = pipeline().pipe((n) => n * 2);
    assert.equal(p1.execute(5), 6);
    assert.equal(p2.execute(5), 10);
  });
});

// ─── asyncPipeline() factory ──────────────────────────────────────────────────

describe('asyncPipeline() factory', () => {
  it('returns an AsyncPipeline instance', () => {
    const p = asyncPipeline();
    assert.ok(p instanceof AsyncPipeline);
  });

  it('asyncPipeline can execute immediately', async () => {
    assert.equal(await asyncPipeline().execute(77), 77);
  });

  it('asyncPipeline factory with async pipe', async () => {
    const result = await asyncPipeline()
      .pipe(async (n) => n + 5)
      .execute(10);
    assert.equal(result, 15);
  });

  it('asyncPipeline factory with multiple steps', async () => {
    const result = await asyncPipeline()
      .pipe(async (n) => n * 2)
      .pipe((n) => n + 1)
      .execute(4);
    assert.equal(result, 9);
  });

  it('asyncPipeline factory produces independent pipelines', async () => {
    const p1 = asyncPipeline().pipe(async (n) => n + 1);
    const p2 = asyncPipeline().pipe(async (n) => n * 2);
    assert.equal(await p1.execute(5), 6);
    assert.equal(await p2.execute(5), 10);
  });
});

// ─── pipeValue() ─────────────────────────────────────────────────────────────

describe('pipeValue()', () => {
  it('returns value unchanged when no functions are provided', () => {
    assert.equal(pipeValue(42), 42);
  });

  it('applies a single function', () => {
    assert.equal(pipeValue(5, (n) => n * 10), 50);
  });

  it('pipes value left to right through two functions', () => {
    const addOne = (n) => n + 1;
    const double = (n) => n * 2;
    assert.equal(pipeValue(3, addOne, double), 8);
  });

  it('pipes value left to right through three functions', () => {
    const result = pipeValue(
      '  hello world  ',
      (s) => s.trim(),
      (s) => s.toUpperCase(),
      (s) => s.replace(' ', '_'),
    );
    assert.equal(result, 'HELLO_WORLD');
  });

  it('applies functions in left-to-right order', () => {
    const order = [];
    const a = (n) => { order.push('a'); return n; };
    const b = (n) => { order.push('b'); return n; };
    const c = (n) => { order.push('c'); return n; };
    pipeValue(0, a, b, c);
    assert.deepEqual(order, ['a', 'b', 'c']);
  });

  it('works with string transformations', () => {
    const result = pipeValue('hello', (s) => s + ' world', (s) => s.length);
    assert.equal(result, 11);
  });

  it('works with object input', () => {
    const result = pipeValue({ x: 1 }, (o) => ({ ...o, y: 2 }), (o) => o.x + o.y);
    assert.equal(result, 3);
  });
});
