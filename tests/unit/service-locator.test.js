// ─── Unit Tests: ServiceLocator & Middleware ───────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ServiceLocator,
  Middleware,
  createServiceLocator,
  createMiddleware,
} from '../../app/modules/service-locator.js';

// ─── ServiceLocator – register / get ─────────────────────────────────────────

describe('ServiceLocator – register / get', () => {
  it('get returns the registered service', () => {
    const sl = new ServiceLocator();
    const svc = { value: 42 };
    sl.register('myService', svc);
    assert.strictEqual(sl.get('myService'), svc);
  });

  it('register with a string value', () => {
    const sl = new ServiceLocator();
    sl.register('greeting', 'hello');
    assert.equal(sl.get('greeting'), 'hello');
  });

  it('register with a number value', () => {
    const sl = new ServiceLocator();
    sl.register('pi', 3.14);
    assert.equal(sl.get('pi'), 3.14);
  });

  it('register overwrites a previous registration', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 'first');
    sl.register('svc', 'second');
    assert.equal(sl.get('svc'), 'second');
  });

  it('multiple distinct services coexist', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    assert.equal(sl.get('a'), 1);
    assert.equal(sl.get('b'), 2);
  });
});

// ─── ServiceLocator – get throws on unknown name ──────────────────────────────

describe('ServiceLocator – get unknown name', () => {
  it('throws when the name has not been registered', () => {
    const sl = new ServiceLocator();
    assert.throws(() => sl.get('ghost'), /not registered/i);
  });

  it('error message includes the service name', () => {
    const sl = new ServiceLocator();
    assert.throws(() => sl.get('my-service'), /my-service/);
  });
});

// ─── ServiceLocator – has ─────────────────────────────────────────────────────

describe('ServiceLocator – has', () => {
  it('returns true for a registered name', () => {
    const sl = new ServiceLocator();
    sl.register('exists', 1);
    assert.equal(sl.has('exists'), true);
  });

  it('returns false for an unknown name', () => {
    const sl = new ServiceLocator();
    assert.equal(sl.has('missing'), false);
  });
});

// ─── ServiceLocator – unregister ──────────────────────────────────────────────

describe('ServiceLocator – unregister', () => {
  it('unregister removes the service', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 42);
    sl.unregister('svc');
    assert.equal(sl.has('svc'), false);
  });

  it('get throws after unregister', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 42);
    sl.unregister('svc');
    assert.throws(() => sl.get('svc'), /not registered/i);
  });

  it('unregister on unknown name is a no-op', () => {
    const sl = new ServiceLocator();
    assert.doesNotThrow(() => sl.unregister('nonexistent'));
  });

  it('unregister does not affect other services', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.unregister('a');
    assert.equal(sl.has('b'), true);
    assert.equal(sl.get('b'), 2);
  });
});

// ─── ServiceLocator – list ────────────────────────────────────────────────────

describe('ServiceLocator – list', () => {
  it('returns all registered names', () => {
    const sl = new ServiceLocator();
    sl.register('x', 1);
    sl.register('y', 2);
    sl.register('z', 3);
    const names = sl.list().sort();
    assert.deepEqual(names, ['x', 'y', 'z']);
  });

  it('returns empty array when nothing is registered', () => {
    const sl = new ServiceLocator();
    assert.deepEqual(sl.list(), []);
  });

  it('list reflects unregister', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.unregister('a');
    assert.deepEqual(sl.list(), ['b']);
  });
});

// ─── createServiceLocator factory ─────────────────────────────────────────────

describe('createServiceLocator', () => {
  it('returns a ServiceLocator instance', () => {
    const sl = createServiceLocator();
    assert.ok(sl instanceof ServiceLocator);
  });

  it('each call returns a distinct, independent instance', () => {
    const sl1 = createServiceLocator();
    const sl2 = createServiceLocator();
    assert.notStrictEqual(sl1, sl2);
    sl1.register('key', 'val');
    assert.equal(sl2.has('key'), false);
  });
});

// ─── Middleware – use / execute ───────────────────────────────────────────────

describe('Middleware – basic chain', () => {
  it('executes a single middleware', async () => {
    const mw = new Middleware();
    let ran = false;
    mw.use(async (_ctx, next) => { ran = true; await next(); });
    await mw.execute({});
    assert.equal(ran, true);
  });

  it('execute resolves when no middleware is added', async () => {
    const mw = new Middleware();
    await assert.doesNotReject(() => mw.execute({}));
  });

  it('middleware runs in the order use() was called', async () => {
    const mw = new Middleware();
    const order = [];
    mw.use(async (ctx, next) => { order.push(1); await next(); });
    mw.use(async (ctx, next) => { order.push(2); await next(); });
    mw.use(async (ctx, next) => { order.push(3); await next(); });
    await mw.execute({});
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('middleware receives the context object', async () => {
    const mw = new Middleware();
    let received = null;
    mw.use(async (ctx, next) => { received = ctx; await next(); });
    const ctx = { foo: 'bar' };
    await mw.execute(ctx);
    assert.strictEqual(received, ctx);
  });

  it('middleware can mutate the context', async () => {
    const mw = new Middleware();
    mw.use(async (ctx, next) => { ctx.a = 1; await next(); });
    mw.use(async (ctx, next) => { ctx.b = 2; await next(); });
    const ctx = {};
    await mw.execute(ctx);
    assert.equal(ctx.a, 1);
    assert.equal(ctx.b, 2);
  });

  it('wrapping pattern: before and after next()', async () => {
    const mw = new Middleware();
    const log = [];
    mw.use(async (ctx, next) => { log.push('before-1'); await next(); log.push('after-1'); });
    mw.use(async (ctx, next) => { log.push('before-2'); await next(); log.push('after-2'); });
    await mw.execute({});
    assert.deepEqual(log, ['before-1', 'before-2', 'after-2', 'after-1']);
  });

  it('middleware that does not call next() stops the chain', async () => {
    const mw = new Middleware();
    let secondRan = false;
    mw.use(async (_ctx, _next) => { /* do not call next */ });
    mw.use(async (_ctx, next) => { secondRan = true; await next(); });
    await mw.execute({});
    assert.equal(secondRan, false);
  });
});

// ─── Middleware – typed context ────────────────────────────────────────────────

describe('Middleware – typed context', () => {
  it('works with a typed context object', async () => {
    const mw = new Middleware();
    mw.use(async (ctx, next) => { ctx.count += 1; await next(); });
    mw.use(async (ctx, next) => { ctx.count += 10; await next(); });
    const ctx = { count: 0 };
    await mw.execute(ctx);
    assert.equal(ctx.count, 11);
  });
});

// ─── createMiddleware factory ─────────────────────────────────────────────────

describe('createMiddleware', () => {
  it('returns a Middleware instance', () => {
    const mw = createMiddleware();
    assert.ok(mw instanceof Middleware);
  });

  it('each call returns a distinct, independent instance', () => {
    const mw1 = createMiddleware();
    const mw2 = createMiddleware();
    assert.notStrictEqual(mw1, mw2);
  });

  it('created middleware executes its chain', async () => {
    const mw = createMiddleware();
    let ran = false;
    mw.use(async (_ctx, next) => { ran = true; await next(); });
    await mw.execute({});
    assert.equal(ran, true);
  });
});
