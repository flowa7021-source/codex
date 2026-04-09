// ─── Unit Tests: chain-of-responsibility ──────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BaseHandler,
  createHandler,
  chain,
  FallbackHandler,
} from '../../app/modules/chain-of-responsibility.js';

// ─── BaseHandler ──────────────────────────────────────────────────────────────

describe('BaseHandler', () => {
  it('handle returns null when there is no next handler', () => {
    const h = new BaseHandler();
    assert.equal(h.handle('anything'), null);
  });

  it('setNext returns the next handler for fluent chaining', () => {
    const h1 = new BaseHandler();
    const h2 = new BaseHandler();
    const returned = h1.setNext(h2);
    assert.strictEqual(returned, h2);
  });

  it('handle delegates to next handler when set', () => {
    let called = false;
    const h1 = new BaseHandler();
    const h2 = createHandler(() => {
      called = true;
      return 'handled';
    });
    h1.setNext(h2);
    const result = h1.handle('req');
    assert.equal(called, true);
    assert.equal(result, 'handled');
  });

  it('subclass can override handle to intercept request', () => {
    class DoubleHandler extends BaseHandler {
      handle(req) {
        if (typeof req === 'number' && req % 2 === 0) return `even:${req}`;
        return super.handle(req);
      }
    }
    const h = new DoubleHandler();
    assert.equal(h.handle(4), 'even:4');
    assert.equal(h.handle(3), null); // no next, falls through
  });

  it('subclass delegates odd numbers to next', () => {
    class EvenHandler extends BaseHandler {
      handle(req) {
        if (req % 2 === 0) return `even:${req}`;
        return super.handle(req);
      }
    }
    const first = new EvenHandler();
    const second = createHandler((req) => `odd:${req}`);
    first.setNext(second);
    assert.equal(first.handle(2), 'even:2');
    assert.equal(first.handle(3), 'odd:3');
  });

  it('protected next is null by default', () => {
    class InspectHandler extends BaseHandler {
      getNext() { return this.next; }
    }
    const h = new InspectHandler();
    assert.equal(h.getNext(), null);
  });

  it('next is updated correctly after setNext', () => {
    class InspectHandler extends BaseHandler {
      getNext() { return this.next; }
    }
    const h1 = new InspectHandler();
    const h2 = new BaseHandler();
    h1.setNext(h2);
    assert.strictEqual(h1.getNext(), h2);
  });

  it('handle passes request unchanged to next', () => {
    const received = [];
    const h1 = new BaseHandler();
    const h2 = createHandler((req) => { received.push(req); return null; });
    h1.setNext(h2);
    h1.handle({ id: 99 });
    assert.deepEqual(received, [{ id: 99 }]);
  });
});

// ─── createHandler ────────────────────────────────────────────────────────────

describe('createHandler', () => {
  it('handler function is called with the request', () => {
    let seen = null;
    const h = createHandler((req) => { seen = req; return 'ok'; });
    h.handle('hello');
    assert.equal(seen, 'hello');
  });

  it('returns the function return value', () => {
    const h = createHandler((req) => req * 2);
    assert.equal(h.handle(5), 10);
  });

  it('returns null when function returns null', () => {
    const h = createHandler(() => null);
    assert.equal(h.handle('x'), null);
  });

  it('next() callback returns null when there is no next handler', () => {
    let nextResult = 'sentinel';
    const h = createHandler((_req, next) => {
      nextResult = next();
      return null;
    });
    h.handle('any');
    assert.equal(nextResult, null);
  });

  it('next() callback forwards to the next handler', () => {
    const second = createHandler((req) => `second:${req}`);
    const first = createHandler((_req, next) => next());
    first.setNext(second);
    assert.equal(first.handle('hello'), 'second:hello');
  });

  it('function can conditionally call next', () => {
    const second = createHandler(() => 'fallback');
    const first = createHandler((req, next) => req > 0 ? `positive:${req}` : next());
    first.setNext(second);
    assert.equal(first.handle(5), 'positive:5');
    assert.equal(first.handle(-1), 'fallback');
  });

  it('setNext is available on the returned handler', () => {
    const h1 = createHandler((_req, next) => next());
    const h2 = createHandler((req) => `got:${req}`);
    h1.setNext(h2);
    assert.equal(h1.handle('x'), 'got:x');
  });

  it('returns null when the function does not call next and returns null', () => {
    const h1 = createHandler(() => null);
    const h2 = createHandler(() => 'unreachable');
    h1.setNext(h2);
    // h1 returns null directly without calling next()
    assert.equal(h1.handle('req'), null);
  });
});

// ─── chain ────────────────────────────────────────────────────────────────────

describe('chain', () => {
  it('single handler returns its result', () => {
    const h = createHandler((req) => `only:${req}`);
    const root = chain(h);
    assert.equal(root.handle('x'), 'only:x');
  });

  it('links multiple handlers and returns first', () => {
    const h1 = createHandler((req, next) => req === 'a' ? 'A' : next());
    const h2 = createHandler((req, next) => req === 'b' ? 'B' : next());
    const h3 = createHandler(() => 'C');
    const root = chain(h1, h2, h3);
    assert.equal(root.handle('a'), 'A');
    assert.equal(root.handle('b'), 'B');
    assert.equal(root.handle('c'), 'C');
  });

  it('returns null if no handler handles the request', () => {
    const h1 = createHandler((_req, next) => next());
    const h2 = createHandler((_req, next) => next());
    const root = chain(h1, h2);
    assert.equal(root.handle('unmatched'), null);
  });

  it('throws when called with no arguments', () => {
    assert.throws(() => chain(), /at least one handler/);
  });

  it('first matching handler short-circuits the rest', () => {
    const calls = [];
    const h1 = createHandler((req, next) => { calls.push('h1'); return req > 0 ? 'positive' : next(); });
    const h2 = createHandler(() => { calls.push('h2'); return 'fallback'; });
    chain(h1, h2).handle(1);
    assert.deepEqual(calls, ['h1']);
  });

  it('handles numeric requests through three handlers', () => {
    const low = createHandler((n, next) => n < 10 ? 'low' : next());
    const mid = createHandler((n, next) => n < 100 ? 'mid' : next());
    const high = createHandler(() => 'high');
    const root = chain(low, mid, high);
    assert.equal(root.handle(5), 'low');
    assert.equal(root.handle(50), 'mid');
    assert.equal(root.handle(500), 'high');
  });

  it('handlers are mutated to point to next (setNext side-effect)', () => {
    const h1 = createHandler((_req, next) => next());
    const h2 = createHandler(() => 'reached');
    chain(h1, h2);
    // After chain, h1's next is h2
    assert.equal(h1.handle('any'), 'reached');
  });

  it('two-handler chain with fallback produces correct result', () => {
    const first = createHandler((req, next) => req.startsWith('X') ? `X-${req}` : next());
    const fb = new FallbackHandler('default');
    const root = chain(first, fb);
    assert.equal(root.handle('Xray'), 'X-Xray');
    assert.equal(root.handle('other'), 'default');
  });
});

// ─── FallbackHandler ─────────────────────────────────────────────────────────

describe('FallbackHandler', () => {
  it('always returns the default response', () => {
    const h = new FallbackHandler('default');
    assert.equal(h.handle('anything'), 'default');
    assert.equal(h.handle('something else'), 'default');
  });

  it('works with numeric default', () => {
    const h = new FallbackHandler(0);
    assert.equal(h.handle('req'), 0);
  });

  it('works with object default', () => {
    const defaultVal = { error: 'not found' };
    const h = new FallbackHandler(defaultVal);
    assert.strictEqual(h.handle('req'), defaultVal);
  });

  it('is used as terminal in a chain', () => {
    const upper = createHandler((req, next) => typeof req === 'string' && req === req.toUpperCase() ? `UPPER:${req}` : next());
    const fb = new FallbackHandler('UNKNOWN');
    chain(upper, fb);
    assert.equal(upper.handle('HELLO'), 'UPPER:HELLO');
    assert.equal(upper.handle('hello'), 'UNKNOWN');
  });

  it('setNext on FallbackHandler does not affect its response', () => {
    const fb = new FallbackHandler('fallback');
    const other = createHandler(() => 'other');
    fb.setNext(other);
    // FallbackHandler always returns its own value, ignoring next
    assert.equal(fb.handle('x'), 'fallback');
  });

  it('FallbackHandler with null default returns null', () => {
    const h = new FallbackHandler(null);
    assert.equal(h.handle('req'), null);
  });

  it('works with boolean default', () => {
    const h = new FallbackHandler(false);
    assert.equal(h.handle('any'), false);
  });

  it('every request gets the same default reference for objects', () => {
    const obj = { status: 404 };
    const h = new FallbackHandler(obj);
    assert.strictEqual(h.handle('a'), h.handle('b'));
  });
});

// ─── Integration – realistic pipeline ─────────────────────────────────────────

describe('chain-of-responsibility – integration', () => {
  it('authentication → authorization → business logic pipeline', () => {
    const authN = createHandler((req, next) => {
      if (!req.token) return { error: 'unauthenticated' };
      return next();
    });
    const authZ = createHandler((req, next) => {
      if (req.role !== 'admin') return { error: 'forbidden' };
      return next();
    });
    const business = createHandler((req) => ({ ok: true, data: req.payload }));

    const pipeline = chain(authN, authZ, business);

    assert.deepEqual(pipeline.handle({ token: null }), { error: 'unauthenticated' });
    assert.deepEqual(pipeline.handle({ token: 'x', role: 'user', payload: 'data' }), { error: 'forbidden' });
    assert.deepEqual(pipeline.handle({ token: 'x', role: 'admin', payload: 'secret' }), { ok: true, data: 'secret' });
  });

  it('numeric range router with fallback', () => {
    const small = createHandler((n, next) => n >= 1 && n <= 10 ? 'small' : next());
    const medium = createHandler((n, next) => n >= 11 && n <= 100 ? 'medium' : next());
    const large = createHandler((n, next) => n >= 101 ? 'large' : next());
    const fb = new FallbackHandler('out-of-range');

    const router = chain(small, medium, large, fb);

    assert.equal(router.handle(5), 'small');
    assert.equal(router.handle(50), 'medium');
    assert.equal(router.handle(500), 'large');
    assert.equal(router.handle(0), 'out-of-range');
    assert.equal(router.handle(-1), 'out-of-range');
  });
});
