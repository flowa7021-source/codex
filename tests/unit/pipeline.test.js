// ─── Unit Tests: pipeline ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  pipeline,
  Pipeline,
  asyncPipeline,
  AsyncPipeline,
  compose,
  pipeThrough,
} from '../../app/modules/pipeline.js';

// ─── pipeline() factory ───────────────────────────────────────────────────────

describe('pipeline()', () => {
  it('creates a Pipeline with the initial value', () => {
    const p = pipeline(42);
    assert.ok(p instanceof Pipeline);
    assert.equal(p.value(), 42);
  });

  it('works with string values', () => {
    const p = pipeline('hello');
    assert.equal(p.value(), 'hello');
  });

  it('works with object values', () => {
    const obj = { a: 1 };
    const p = pipeline(obj);
    assert.equal(p.value(), obj);
  });
});

// ─── Pipeline.pipe() ──────────────────────────────────────────────────────────

describe('Pipeline.pipe()', () => {
  it('transforms the value with a function', () => {
    const result = pipeline(5).pipe((n) => n * 2).value();
    assert.equal(result, 10);
  });

  it('returns a new Pipeline instance', () => {
    const p1 = pipeline(1);
    const p2 = p1.pipe((n) => n + 1);
    assert.ok(p2 instanceof Pipeline);
    assert.notEqual(p1, p2);
  });

  it('can change the type of the value', () => {
    const result = pipeline(42).pipe((n) => String(n)).value();
    assert.equal(result, '42');
  });
});

// ─── Pipeline.value() ─────────────────────────────────────────────────────────

describe('Pipeline.value()', () => {
  it('returns the current wrapped value', () => {
    assert.equal(pipeline(99).value(), 99);
  });

  it('returns the value after transforms', () => {
    const p = pipeline(10).pipe((n) => n + 5).pipe((n) => n * 2);
    assert.equal(p.value(), 30);
  });
});

// ─── Pipeline.when() ──────────────────────────────────────────────────────────

describe('Pipeline.when()', () => {
  it('applies transform when condition is true (boolean)', () => {
    const result = pipeline(10).when(true, (n) => n * 2).value();
    assert.equal(result, 20);
  });

  it('skips transform when condition is false (boolean)', () => {
    const result = pipeline(10).when(false, (n) => n * 2).value();
    assert.equal(result, 10);
  });

  it('applies transform when predicate returns true', () => {
    const result = pipeline(10).when((n) => n > 5, (n) => n + 1).value();
    assert.equal(result, 11);
  });

  it('skips transform when predicate returns false', () => {
    const result = pipeline(10).when((n) => n > 100, (n) => n + 1).value();
    assert.equal(result, 10);
  });

  it('predicate receives the current value', () => {
    let seen;
    pipeline(42).when((n) => { seen = n; return false; }, (n) => n);
    assert.equal(seen, 42);
  });
});

// ─── Pipeline.tap() ───────────────────────────────────────────────────────────

describe('Pipeline.tap()', () => {
  it('calls the side-effect function', () => {
    let called = false;
    pipeline(7).tap(() => { called = true; });
    assert.ok(called);
  });

  it('does not change the value', () => {
    const result = pipeline(7).tap((n) => n * 100).value();
    assert.equal(result, 7);
  });

  it('passes the current value to the side-effect', () => {
    let seen;
    pipeline(55).tap((n) => { seen = n; });
    assert.equal(seen, 55);
  });

  it('returns the same Pipeline type', () => {
    const p = pipeline(1).tap(() => {});
    assert.ok(p instanceof Pipeline);
  });
});

// ─── Chaining ────────────────────────────────────────────────────────────────

describe('Pipeline chaining', () => {
  it('chains multiple pipes and produces the correct result', () => {
    const result = pipeline(1)
      .pipe((n) => n + 1)   // 2
      .pipe((n) => n * 3)   // 6
      .pipe((n) => n - 1)   // 5
      .value();
    assert.equal(result, 5);
  });

  it('chains pipe, when, and tap together', () => {
    const log = [];
    const result = pipeline(2)
      .pipe((n) => n * 10)          // 20
      .tap((n) => log.push(n))      // side effect: [20]
      .when(true, (n) => n + 5)     // 25
      .when(false, (n) => n * 100)  // skipped
      .pipe((n) => n - 5)           // 20
      .value();
    assert.equal(result, 20);
    assert.deepEqual(log, [20]);
  });

  it('preserves intermediate values across chain steps', () => {
    const steps = [];
    pipeline(0)
      .tap((n) => steps.push(n))
      .pipe((n) => n + 1)
      .tap((n) => steps.push(n))
      .pipe((n) => n + 1)
      .tap((n) => steps.push(n));
    assert.deepEqual(steps, [0, 1, 2]);
  });
});

// ─── asyncPipeline() factory ──────────────────────────────────────────────────

describe('asyncPipeline()', () => {
  it('creates an AsyncPipeline from a plain value', () => {
    const p = asyncPipeline(10);
    assert.ok(p instanceof AsyncPipeline);
  });

  it('creates an AsyncPipeline from a Promise', () => {
    const p = asyncPipeline(Promise.resolve(10));
    assert.ok(p instanceof AsyncPipeline);
  });
});

// ─── AsyncPipeline.pipe() ────────────────────────────────────────────────────

describe('AsyncPipeline.pipe()', () => {
  it('applies a synchronous transform', async () => {
    const result = await asyncPipeline(5).pipe((n) => n * 2).resolve();
    assert.equal(result, 10);
  });

  it('applies an async transform', async () => {
    const result = await asyncPipeline(5)
      .pipe(async (n) => n + 10)
      .resolve();
    assert.equal(result, 15);
  });

  it('chains multiple async transforms', async () => {
    const result = await asyncPipeline(1)
      .pipe(async (n) => n + 1)
      .pipe(async (n) => n * 3)
      .pipe(async (n) => n - 1)
      .resolve();
    assert.equal(result, 5);
  });

  it('can mix sync and async transforms', async () => {
    const result = await asyncPipeline(2)
      .pipe((n) => n * 5)
      .pipe(async (n) => n + 1)
      .resolve();
    assert.equal(result, 11);
  });
});

// ─── AsyncPipeline.resolve() ─────────────────────────────────────────────────

describe('AsyncPipeline.resolve()', () => {
  it('resolves to the final value', async () => {
    const result = await asyncPipeline(100).resolve();
    assert.equal(result, 100);
  });

  it('resolves a Promise-wrapped initial value', async () => {
    const result = await asyncPipeline(Promise.resolve(42)).resolve();
    assert.equal(result, 42);
  });

  it('resolves after multiple transforms', async () => {
    const result = await asyncPipeline(3)
      .pipe((n) => n * n)
      .pipe((n) => n + 1)
      .resolve();
    assert.equal(result, 10);
  });
});

// ─── AsyncPipeline.when() ────────────────────────────────────────────────────

describe('AsyncPipeline.when()', () => {
  it('applies transform when boolean condition is true', async () => {
    const result = await asyncPipeline(5).when(true, (n) => n * 2).resolve();
    assert.equal(result, 10);
  });

  it('skips transform when boolean condition is false', async () => {
    const result = await asyncPipeline(5).when(false, (n) => n * 2).resolve();
    assert.equal(result, 5);
  });

  it('applies transform when async predicate resolves true', async () => {
    const result = await asyncPipeline(5)
      .when(async (n) => n > 3, (n) => n + 10)
      .resolve();
    assert.equal(result, 15);
  });

  it('skips transform when async predicate resolves false', async () => {
    const result = await asyncPipeline(5)
      .when(async (n) => n > 100, (n) => n + 10)
      .resolve();
    assert.equal(result, 5);
  });
});

// ─── AsyncPipeline.tap() ─────────────────────────────────────────────────────

describe('AsyncPipeline.tap()', () => {
  it('calls the side-effect and does not change the value', async () => {
    let called = false;
    const result = await asyncPipeline(9)
      .tap(async () => { called = true; })
      .resolve();
    assert.equal(result, 9);
    assert.ok(called);
  });

  it('awaits async side effects before continuing', async () => {
    const log = [];
    await asyncPipeline(1)
      .tap(async () => { log.push('tap'); })
      .pipe((n) => { log.push('pipe'); return n; })
      .resolve();
    assert.deepEqual(log, ['tap', 'pipe']);
  });
});

// ─── compose() ───────────────────────────────────────────────────────────────

describe('compose()', () => {
  it('composes two functions right to left', () => {
    const addOne = (n) => n + 1;
    const double = (n) => n * 2;
    // compose(double, addOne)(3) = double(addOne(3)) = double(4) = 8
    const fn = compose(double, addOne);
    assert.equal(fn(3), 8);
  });

  it('composes three functions right to left', () => {
    const addOne  = (n) => n + 1;
    const double  = (n) => n * 2;
    const square  = (n) => n * n;
    // compose(addOne, double, square)(3) = addOne(double(square(3)))
    //   = addOne(double(9)) = addOne(18) = 19
    const fn = compose(addOne, double, square);
    assert.equal(fn(3), 19);
  });

  it('returns identity-like behaviour with a single function', () => {
    const triple = (n) => n * 3;
    assert.equal(compose(triple)(4), 12);
  });

  it('applies functions in right-to-left order (not left-to-right)', () => {
    const order = [];
    const a = (n) => { order.push('a'); return n; };
    const b = (n) => { order.push('b'); return n; };
    const c = (n) => { order.push('c'); return n; };
    compose(a, b, c)(0);
    assert.deepEqual(order, ['c', 'b', 'a']);
  });

  it('works with string transforms', () => {
    const trim  = (s) => s.trim();
    const upper = (s) => s.toUpperCase();
    const fn = compose(upper, trim);
    assert.equal(fn('  hello  '), 'HELLO');
  });
});

// ─── pipeThrough() ───────────────────────────────────────────────────────────

describe('pipeThrough()', () => {
  it('pipes value left to right through functions', () => {
    const addOne = (n) => n + 1;
    const double = (n) => n * 2;
    // pipeThrough(3, addOne, double) = double(addOne(3)) = double(4) = 8
    assert.equal(pipeThrough(3, addOne, double), 8);
  });

  it('applies functions in left-to-right order', () => {
    const order = [];
    const a = (n) => { order.push('a'); return n; };
    const b = (n) => { order.push('b'); return n; };
    const c = (n) => { order.push('c'); return n; };
    pipeThrough(0, a, b, c);
    assert.deepEqual(order, ['a', 'b', 'c']);
  });

  it('returns the value unchanged when no functions provided', () => {
    assert.equal(pipeThrough(42), 42);
  });

  it('works with a single function', () => {
    assert.equal(pipeThrough(5, (n) => n * 10), 50);
  });

  it('chains three transforms correctly', () => {
    const result = pipeThrough(
      '  hello world  ',
      (s) => s.trim(),
      (s) => s.toUpperCase(),
      (s) => s.replace(' ', '_'),
    );
    assert.equal(result, 'HELLO_WORLD');
  });
});
