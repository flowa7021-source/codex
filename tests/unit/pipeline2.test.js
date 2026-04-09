// ─── Unit Tests: Pipeline2 ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Pipeline,
  createPipeline,
  compose,
} from '../../app/modules/pipeline2.js';

// ─── createPipeline / identity ────────────────────────────────────────────────

describe('createPipeline – identity pipeline', () => {
  it('returns a Pipeline instance', () => {
    const p = createPipeline();
    assert.ok(p instanceof Pipeline);
  });

  it('identity pipeline passes value through unchanged (string)', async () => {
    const p = createPipeline();
    const result = await p.process('hello');
    assert.equal(result, 'hello');
  });

  it('identity pipeline passes value through unchanged (number)', async () => {
    const p = createPipeline();
    const result = await p.process(42);
    assert.equal(result, 42);
  });

  it('identity pipeline passes value through unchanged (object)', async () => {
    const p = createPipeline();
    const obj = { a: 1, b: 2 };
    const result = await p.process(obj);
    assert.strictEqual(result, obj);
  });
});

// ─── pipe() ───────────────────────────────────────────────────────────────────

describe('Pipeline – pipe()', () => {
  it('pipe() returns a new Pipeline (not the same instance)', () => {
    const p1 = createPipeline();
    const p2 = p1.pipe(x => x);
    assert.notStrictEqual(p1, p2);
  });

  it('single synchronous step transforms the value', async () => {
    const p = createPipeline().pipe(s => s.toUpperCase());
    assert.equal(await p.process('hello'), 'HELLO');
  });

  it('multiple synchronous steps run left-to-right', async () => {
    const p = createPipeline()
      .pipe(s => s.trim())
      .pipe(s => s.toUpperCase())
      .pipe(s => `[${s}]`);
    assert.equal(await p.process('  world  '), '[WORLD]');
  });

  it('single async step resolves correctly', async () => {
    const p = createPipeline().pipe(async n => n * 2);
    assert.equal(await p.process(5), 10);
  });

  it('mixed sync and async steps run in order', async () => {
    const order = [];
    const p = createPipeline()
      .pipe(n => { order.push(1); return n + 1; })
      .pipe(async n => { order.push(2); return n * 2; })
      .pipe(n => { order.push(3); return n - 1; });
    const result = await p.process(3); // (3+1)*2 - 1 = 7
    assert.equal(result, 7);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('pipe() can change the value type', async () => {
    const p = createPipeline()
      .pipe(s => s.length)    // string -> number
      .pipe(n => n > 3);      // number -> boolean
    assert.equal(await p.process('hello'), true);
    assert.equal(await p.process('hi'), false);
  });

  it('pipe() on an identity pipeline does not modify original', async () => {
    const base = createPipeline();
    base.pipe(s => s + '!'); // intentionally discard
    // base still acts as identity
    assert.equal(await base.process('unchanged'), 'unchanged');
  });
});

// ─── processAll() ────────────────────────────────────────────────────────────

describe('Pipeline – processAll()', () => {
  it('processes an array of inputs and returns results in order', async () => {
    const p = createPipeline().pipe(n => n * n);
    const results = await p.processAll([1, 2, 3, 4, 5]);
    assert.deepEqual(results, [1, 4, 9, 16, 25]);
  });

  it('empty array returns empty array', async () => {
    const p = createPipeline().pipe(x => x);
    const results = await p.processAll([]);
    assert.deepEqual(results, []);
  });

  it('each item is processed independently', async () => {
    const p = createPipeline().pipe(s => s.toUpperCase());
    const results = await p.processAll(['a', 'b', 'c']);
    assert.deepEqual(results, ['A', 'B', 'C']);
  });

  it('rejects if any step throws, for the affected item', async () => {
    const p = createPipeline().pipe(n => {
      if (n === 0) throw new Error('zero not allowed');
      return n;
    });
    await assert.rejects(p.process(0), /zero not allowed/);
    // Non-zero items still work independently
    assert.equal(await p.process(5), 5);
  });
});

// ─── tap() ───────────────────────────────────────────────────────────────────

describe('Pipeline – tap()', () => {
  it('tap() does not change the value', async () => {
    const p = createPipeline().tap(() => 'ignored');
    assert.equal(await p.process(99), 99);
  });

  it('tap() side-effect is called with the current value', async () => {
    const seen = [];
    const p = createPipeline()
      .pipe(n => n + 1)
      .tap(n => seen.push(n))
      .pipe(n => n * 2);
    const result = await p.process(4); // (4+1)*2 = 10
    assert.equal(result, 10);
    assert.deepEqual(seen, [5]);
  });

  it('multiple tap() calls all fire in order', async () => {
    const log = [];
    const p = createPipeline()
      .tap(v => log.push(`a:${v}`))
      .tap(v => log.push(`b:${v}`))
      .tap(v => log.push(`c:${v}`));
    await p.process('x');
    assert.deepEqual(log, ['a:x', 'b:x', 'c:x']);
  });

  it('tap() returns a new Pipeline instance', () => {
    const p = createPipeline();
    const p2 = p.tap(() => {});
    assert.notStrictEqual(p, p2);
  });

  it('tap() does not affect value type through subsequent steps', async () => {
    const p = createPipeline()
      .pipe(s => s.length)
      .tap(n => { assert.equal(typeof n, 'number'); });
    assert.equal(await p.process('hello'), 5);
  });
});

// ─── catch() ─────────────────────────────────────────────────────────────────

describe('Pipeline – catch()', () => {
  it('catch() handler is called when a step throws', async () => {
    const p = createPipeline()
      .pipe(() => { throw new Error('oops'); })
      .catch(err => `recovered: ${err.message}`);
    assert.equal(await p.process('input'), 'recovered: oops');
  });

  it('catch() handler is NOT called when no error occurs', async () => {
    let handlerCalled = false;
    const p = createPipeline()
      .pipe(s => s.toUpperCase())
      .catch(() => { handlerCalled = true; return 'fallback'; });
    const result = await p.process('hello');
    assert.equal(result, 'HELLO');
    assert.equal(handlerCalled, false);
  });

  it('steps after catch() continue with the recovered value', async () => {
    const p = createPipeline()
      .pipe(() => { throw new Error('fail'); })
      .catch(() => 0)
      .pipe(n => n + 10);
    assert.equal(await p.process('x'), 10);
  });

  it('catch() handler can rethrow to propagate the error', async () => {
    const p = createPipeline()
      .pipe(() => { throw new Error('original'); })
      .catch(err => { throw new Error(`wrapped: ${err.message}`); });
    await assert.rejects(p.process('x'), /wrapped: original/);
  });

  it('errors thrown after catch() are not caught by earlier handlers', async () => {
    const p = createPipeline()
      .pipe(() => { throw new Error('first'); })
      .catch(() => 'recovered')
      .pipe(() => { throw new Error('second'); });
    await assert.rejects(p.process('x'), /second/);
  });
});

// ─── clone() ─────────────────────────────────────────────────────────────────

describe('Pipeline – clone()', () => {
  it('clone() returns a different instance', () => {
    const p = createPipeline().pipe(x => x);
    const c = p.clone();
    assert.notStrictEqual(p, c);
  });

  it('clone produces the same results as the original', async () => {
    const p = createPipeline().pipe(n => n * 3).pipe(n => n + 1);
    const c = p.clone();
    assert.equal(await p.process(4), 13);
    assert.equal(await c.process(4), 13);
  });

  it('extending a clone does not affect the original', async () => {
    const p = createPipeline().pipe(s => s.trim());
    const extended = p.clone().pipe(s => s.toUpperCase());

    assert.equal(await p.process('  hello  '), 'hello');
    assert.equal(await extended.process('  hello  '), 'HELLO');
  });

  it('extending the original does not affect a pre-existing clone', async () => {
    const p = createPipeline().pipe(n => n + 1);
    const c = p.clone();

    // Extend original after cloning
    const extended = p.pipe(n => n * 10);
    assert.equal(await c.process(2), 3);      // clone unaffected
    assert.equal(await extended.process(2), 30); // extended sees both steps
  });
});

// ─── compose() ───────────────────────────────────────────────────────────────

describe('compose()', () => {
  it('compose connects two pipelines end-to-end', async () => {
    const f = createPipeline().pipe(s => s.trim());
    const g = createPipeline().pipe(s => s.toUpperCase());
    const fg = compose(f, g);
    assert.equal(await fg.process('  hello  '), 'HELLO');
  });

  it('composed pipeline returns a Pipeline instance', () => {
    const f = createPipeline();
    const g = createPipeline();
    const fg = compose(f, g);
    assert.ok(fg instanceof Pipeline);
  });

  it('compose(f, g) applies f first then g', async () => {
    const order = [];
    const f = createPipeline().pipe(n => { order.push('f'); return n + 1; });
    const g = createPipeline().pipe(n => { order.push('g'); return n * 2; });
    const fg = compose(f, g);
    const result = await fg.process(3); // (3+1)*2 = 8
    assert.equal(result, 8);
    assert.deepEqual(order, ['f', 'g']);
  });

  it('compose with identity pipelines passes value through', async () => {
    const f = createPipeline();
    const g = createPipeline();
    const fg = compose(f, g);
    assert.equal(await fg.process(42), 42);
  });

  it('compose is chainable (compose multiple pipelines)', async () => {
    const a = createPipeline().pipe(n => n + 1);  // +1
    const b = createPipeline().pipe(n => n * 2);  // *2
    const c = createPipeline().pipe(n => n - 3);  // -3
    const abc = compose(compose(a, b), c);
    // (5+1)*2 - 3 = 9
    assert.equal(await abc.process(5), 9);
  });

  it('errors in the first pipeline propagate through compose', async () => {
    const f = createPipeline().pipe(() => { throw new Error('from f'); });
    const g = createPipeline().pipe(n => n * 2);
    const fg = compose(f, g);
    await assert.rejects(fg.process(1), /from f/);
  });

  it('errors in the second pipeline propagate through compose', async () => {
    const f = createPipeline().pipe(n => n + 1);
    const g = createPipeline().pipe(() => { throw new Error('from g'); });
    const fg = compose(f, g);
    await assert.rejects(fg.process(1), /from g/);
  });

  it('processAll works on composed pipelines', async () => {
    const f = createPipeline().pipe(s => s.split('').reverse().join(''));
    const g = createPipeline().pipe(s => s.toUpperCase());
    const fg = compose(f, g);
    const results = await fg.processAll(['abc', 'xyz']);
    assert.deepEqual(results, ['CBA', 'ZYX']);
  });
});
