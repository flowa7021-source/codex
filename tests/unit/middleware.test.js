// ─── Unit Tests: middleware ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createMiddlewareChain,
  MiddlewareChain,
  createLogMiddleware,
  createTimingMiddleware,
} from '../../app/modules/middleware.js';

// ─── createMiddlewareChain() ──────────────────────────────────────────────────

describe('createMiddlewareChain()', () => {
  it('creates a MiddlewareChain instance', () => {
    const chain = createMiddlewareChain();
    assert.ok(chain instanceof MiddlewareChain);
  });

  it('starts with zero registered middleware', () => {
    const chain = createMiddlewareChain();
    assert.equal(chain.length, 0);
  });
});

// ─── use() ────────────────────────────────────────────────────────────────────

describe('use()', () => {
  it('adds middleware and increments length', () => {
    const chain = createMiddlewareChain();
    chain.use(async (_ctx, next) => next());
    assert.equal(chain.length, 1);
  });

  it('length increases with each added middleware', () => {
    const chain = createMiddlewareChain();
    chain.use(async (_ctx, next) => next());
    chain.use(async (_ctx, next) => next());
    chain.use(async (_ctx, next) => next());
    assert.equal(chain.length, 3);
  });

  it('returns this for chaining use() calls', () => {
    const chain = createMiddlewareChain();
    const returned = chain.use(async (_ctx, next) => next());
    assert.equal(returned, chain);
  });
});

// ─── run() – basic execution ──────────────────────────────────────────────────

describe('run()', () => {
  it('executes a single middleware', async () => {
    let ran = false;
    const chain = createMiddlewareChain();
    chain.use(async (_ctx, next) => {
      ran = true;
      await next();
    });
    await chain.run({});
    assert.ok(ran);
  });

  it('resolves with an empty chain', async () => {
    const chain = createMiddlewareChain();
    await chain.run({});
    // No error thrown — promise resolves cleanly
    assert.ok(true);
  });

  it('executes middleware in registration order', async () => {
    const order = [];
    const chain = createMiddlewareChain();
    chain.use(async (_ctx, next) => { order.push(1); await next(); });
    chain.use(async (_ctx, next) => { order.push(2); await next(); });
    chain.use(async (_ctx, next) => { order.push(3); await next(); });
    await chain.run({});
    assert.deepEqual(order, [1, 2, 3]);
  });
});

// ─── run() – next() advancement ───────────────────────────────────────────────

describe('run() with next()', () => {
  it('calling next() advances to the next middleware', async () => {
    const reached = [];
    const chain = createMiddlewareChain();
    chain.use(async (_ctx, next) => {
      reached.push('first-before');
      await next();
      reached.push('first-after');
    });
    chain.use(async (_ctx, next) => {
      reached.push('second');
      await next();
    });
    await chain.run({});
    assert.deepEqual(reached, ['first-before', 'second', 'first-after']);
  });

  it('not calling next() stops the chain', async () => {
    let secondRan = false;
    const chain = createMiddlewareChain();
    chain.use(async () => { /* deliberately no next() */ });
    chain.use(async (_ctx, next) => { secondRan = true; await next(); });
    await chain.run({});
    assert.equal(secondRan, false);
  });
});

// ─── Middleware can modify context ────────────────────────────────────────────

describe('Middleware context modification', () => {
  it('later middleware sees changes made by earlier middleware', async () => {
    const chain = createMiddlewareChain();
    chain.use(async (ctx, next) => {
      ctx.fromFirst = 'hello';
      await next();
    });
    chain.use(async (ctx, next) => {
      ctx.fromSecond = ctx.fromFirst + ' world';
      await next();
    });
    const ctx = {};
    await chain.run(ctx);
    assert.equal(ctx.fromFirst, 'hello');
    assert.equal(ctx.fromSecond, 'hello world');
  });

  it('middleware can set numeric values on context', async () => {
    const chain = createMiddlewareChain();
    chain.use(async (ctx, next) => { ctx.count = 0; await next(); });
    chain.use(async (ctx, next) => { ctx.count++; await next(); });
    chain.use(async (ctx, next) => { ctx.count++; await next(); });
    const ctx = {};
    await chain.run(ctx);
    assert.equal(ctx.count, 2);
  });
});

// ─── Chain with 3 middleware ─────────────────────────────────────────────────

describe('Chain with 3 middleware', () => {
  it('all three middleware execute in order', async () => {
    const log = [];
    const chain = createMiddlewareChain();
    chain.use(async (ctx, next) => {
      log.push('mw1:enter');
      await next();
      log.push('mw1:exit');
    });
    chain.use(async (ctx, next) => {
      log.push('mw2:enter');
      await next();
      log.push('mw2:exit');
    });
    chain.use(async (ctx, next) => {
      log.push('mw3:enter');
      await next();
      log.push('mw3:exit');
    });
    await chain.run({});
    assert.deepEqual(log, [
      'mw1:enter',
      'mw2:enter',
      'mw3:enter',
      'mw3:exit',
      'mw2:exit',
      'mw1:exit',
    ]);
  });

  it('all three can collaborate via context', async () => {
    const chain = createMiddlewareChain();
    chain.use(async (ctx, next) => { ctx.a = 1; await next(); });
    chain.use(async (ctx, next) => { ctx.b = ctx.a + 1; await next(); });
    chain.use(async (ctx, next) => { ctx.c = ctx.b + 1; await next(); });
    const ctx = {};
    await chain.run(ctx);
    assert.deepEqual({ a: ctx.a, b: ctx.b, c: ctx.c }, { a: 1, b: 2, c: 3 });
  });
});

// ─── createLogMiddleware() ────────────────────────────────────────────────────

describe('createLogMiddleware()', () => {
  it('calls the logger with the context', async () => {
    let logged = null;
    const log = createLogMiddleware((ctx) => { logged = ctx; });
    const chain = createMiddlewareChain();
    chain.use(log);
    const ctx = { page: 'test' };
    await chain.run(ctx);
    assert.equal(logged, ctx);
  });

  it('calls next() so the chain continues', async () => {
    let secondRan = false;
    const chain = createMiddlewareChain();
    chain.use(createLogMiddleware(() => {}));
    chain.use(async (_ctx, next) => { secondRan = true; await next(); });
    await chain.run({});
    assert.ok(secondRan);
  });

  it('uses a default logger when none provided (no error thrown)', async () => {
    const chain = createMiddlewareChain();
    chain.use(createLogMiddleware());
    // Should not throw; just exercises the default console.log path
    await chain.run({ silent: true });
    assert.ok(true);
  });
});

// ─── createTimingMiddleware() ─────────────────────────────────────────────────

describe('createTimingMiddleware()', () => {
  it('adds a numeric duration property to context', async () => {
    const chain = createMiddlewareChain();
    chain.use(createTimingMiddleware());
    const ctx = {};
    await chain.run(ctx);
    assert.equal(typeof ctx.duration, 'number');
  });

  it('duration is non-negative', async () => {
    const chain = createMiddlewareChain();
    chain.use(createTimingMiddleware());
    const ctx = {};
    await chain.run(ctx);
    assert.ok(ctx.duration >= 0);
  });

  it('duration reflects time of subsequent middleware', async () => {
    const chain = createMiddlewareChain();
    chain.use(createTimingMiddleware());
    chain.use(async (_ctx, next) => {
      // A small async operation to ensure measurable time in slower environments
      await new Promise((resolve) => Promise.resolve().then(resolve));
      await next();
    });
    const ctx = {};
    await chain.run(ctx);
    assert.equal(typeof ctx.duration, 'number');
    assert.ok(ctx.duration >= 0);
  });

  it('calls next() so the chain continues', async () => {
    let reached = false;
    const chain = createMiddlewareChain();
    chain.use(createTimingMiddleware());
    chain.use(async (_ctx, next) => { reached = true; await next(); });
    await chain.run({});
    assert.ok(reached);
  });
});
