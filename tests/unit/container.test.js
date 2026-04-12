// ─── Unit Tests: Container ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Container, createContainer } from '../../app/modules/container.js';

// ---------------------------------------------------------------------------
// bind() and resolve() — primitive values
// ---------------------------------------------------------------------------
describe('Container – bind() and resolve() primitives', () => {
  it('resolves a bound string', () => {
    const c = createContainer();
    c.bind('name', 'Alice');
    assert.equal(c.resolve('name'), 'Alice');
  });

  it('resolves a bound number', () => {
    const c = createContainer();
    c.bind('port', 3000);
    assert.equal(c.resolve('port'), 3000);
  });

  it('resolves a bound boolean false', () => {
    const c = createContainer();
    c.bind('debug', false);
    assert.equal(c.resolve('debug'), false);
  });

  it('resolves a bound null', () => {
    const c = createContainer();
    c.bind('nothing', null);
    assert.equal(c.resolve('nothing'), null);
  });

  it('resolves a bound undefined', () => {
    const c = createContainer();
    c.bind('undef', undefined);
    assert.equal(c.resolve('undef'), undefined);
  });

  it('resolves a bound zero', () => {
    const c = createContainer();
    c.bind('zero', 0);
    assert.equal(c.resolve('zero'), 0);
  });

  it('rebinding a token overwrites the previous value', () => {
    const c = createContainer();
    c.bind('x', 1);
    c.bind('x', 2);
    assert.equal(c.resolve('x'), 2);
  });
});

// ---------------------------------------------------------------------------
// bind() and resolve() — objects
// ---------------------------------------------------------------------------
describe('Container – bind() and resolve() objects', () => {
  it('resolves a bound plain object by reference', () => {
    const c = createContainer();
    const cfg = { debug: true, level: 3 };
    c.bind('config', cfg);
    assert.strictEqual(c.resolve('config'), cfg);
  });

  it('resolves a bound array', () => {
    const c = createContainer();
    const arr = [1, 2, 3];
    c.bind('list', arr);
    assert.strictEqual(c.resolve('list'), arr);
  });

  it('resolves a bound function', () => {
    const c = createContainer();
    const fn = () => 42;
    c.bind('fn', fn);
    assert.strictEqual(c.resolve('fn'), fn);
  });

  it('resolves a bound class instance', () => {
    const c = createContainer();
    class Svc { greet() { return 'hi'; } }
    const svc = new Svc();
    c.bind('svc', svc);
    assert.strictEqual(c.resolve('svc'), svc);
  });
});

// ---------------------------------------------------------------------------
// factory() — transient behaviour (new instance each call)
// ---------------------------------------------------------------------------
describe('Container – factory() transient', () => {
  it('calls factory on every resolve', () => {
    const c = createContainer();
    let count = 0;
    c.factory('counter', () => ++count);
    assert.equal(c.resolve('counter'), 1);
    assert.equal(c.resolve('counter'), 2);
    assert.equal(c.resolve('counter'), 3);
  });

  it('transient factory returns different object instances', () => {
    const c = createContainer();
    c.factory('obj', () => ({ id: Math.random() }));
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.notStrictEqual(a, b);
  });

  it('explicit singleton:false is also transient', () => {
    const c = createContainer();
    let n = 0;
    c.factory('n', () => ++n, { singleton: false });
    c.resolve('n');
    c.resolve('n');
    assert.equal(c.resolve('n'), 3);
  });

  it('factory is not called until resolve()', () => {
    const c = createContainer();
    let called = false;
    c.factory('lazy', () => { called = true; return 1; });
    assert.equal(called, false);
    c.resolve('lazy');
    assert.equal(called, true);
  });
});

// ---------------------------------------------------------------------------
// singleton() — same instance each call
// ---------------------------------------------------------------------------
describe('Container – singleton()', () => {
  it('returns the same object on every resolve', () => {
    const c = createContainer();
    c.singleton('db', () => ({ connection: 'open' }));
    const a = c.resolve('db');
    const b = c.resolve('db');
    assert.strictEqual(a, b);
  });

  it('factory is called exactly once', () => {
    const c = createContainer();
    let calls = 0;
    c.singleton('once', () => { calls++; return {}; });
    c.resolve('once');
    c.resolve('once');
    c.resolve('once');
    assert.equal(calls, 1);
  });

  it('factory() with { singleton: true } behaves identically', () => {
    const c = createContainer();
    let calls = 0;
    c.factory('s', () => { calls++; return {}; }, { singleton: true });
    const a = c.resolve('s');
    const b = c.resolve('s');
    assert.strictEqual(a, b);
    assert.equal(calls, 1);
  });

  it('singleton caches even a falsy value (zero)', () => {
    const c = createContainer();
    let calls = 0;
    c.singleton('zero', () => { calls++; return 0; });
    assert.equal(c.resolve('zero'), 0);
    assert.equal(c.resolve('zero'), 0);
    assert.equal(calls, 1);
  });

  it('singleton caches even a falsy value (null)', () => {
    const c = createContainer();
    let calls = 0;
    c.singleton('nil', () => { calls++; return null; });
    assert.equal(c.resolve('nil'), null);
    assert.equal(c.resolve('nil'), null);
    assert.equal(calls, 1);
  });
});

// ---------------------------------------------------------------------------
// has() / unbind() / clear()
// ---------------------------------------------------------------------------
describe('Container – has()', () => {
  it('returns true after bind()', () => {
    const c = createContainer();
    c.bind('x', 1);
    assert.equal(c.has('x'), true);
  });

  it('returns true after factory()', () => {
    const c = createContainer();
    c.factory('f', () => 1);
    assert.equal(c.has('f'), true);
  });

  it('returns false for unknown token', () => {
    const c = createContainer();
    assert.equal(c.has('ghost'), false);
  });

  it('returns false after unbind()', () => {
    const c = createContainer();
    c.bind('x', 1);
    c.unbind('x');
    assert.equal(c.has('x'), false);
  });
});

describe('Container – unbind()', () => {
  it('returns true when a binding was removed', () => {
    const c = createContainer();
    c.bind('x', 1);
    assert.equal(c.unbind('x'), true);
  });

  it('returns false when token was not registered', () => {
    const c = createContainer();
    assert.equal(c.unbind('ghost'), false);
  });

  it('resolve throws after unbind()', () => {
    const c = createContainer();
    c.bind('x', 1);
    c.unbind('x');
    assert.throws(() => c.resolve('x'), /no binding/i);
  });
});

describe('Container – clear()', () => {
  it('removes all bindings', () => {
    const c = createContainer();
    c.bind('a', 1);
    c.bind('b', 2);
    c.factory('c', () => 3);
    c.clear();
    assert.equal(c.has('a'), false);
    assert.equal(c.has('b'), false);
    assert.equal(c.has('c'), false);
  });

  it('resolve throws after clear()', () => {
    const c = createContainer();
    c.bind('x', 99);
    c.clear();
    assert.throws(() => c.resolve('x'), /no binding/i);
  });

  it('clear on empty container does not throw', () => {
    const c = createContainer();
    assert.doesNotThrow(() => c.clear());
  });
});

// ---------------------------------------------------------------------------
// Resolving an unregistered token throws
// ---------------------------------------------------------------------------
describe('Container – unregistered token throws', () => {
  it('throws an Error for unknown token', () => {
    const c = createContainer();
    assert.throws(() => c.resolve('missing'), Error);
  });

  it('error message contains the token name', () => {
    const c = createContainer();
    assert.throws(
      () => c.resolve('my-token'),
      /my-token/,
    );
  });

  it('new Container instance also throws for unknown token', () => {
    const c = new Container();
    assert.throws(() => c.resolve('anything'), Error);
  });
});

// ---------------------------------------------------------------------------
// Factory receives the container (dependency injection)
// ---------------------------------------------------------------------------
describe('Container – factory receives container', () => {
  it('factory can resolve other tokens via the container argument', () => {
    const c = createContainer();
    c.bind('host', 'localhost');
    c.bind('port', 5432);
    c.factory('dsn', (ctr) => `${ctr.resolve('host')}:${ctr.resolve('port')}`);
    assert.equal(c.resolve('dsn'), 'localhost:5432');
  });

  it('singleton factory can also inject dependencies', () => {
    const c = createContainer();
    c.bind('multiplier', 10);
    c.singleton('service', (ctr) => ({
      multiply: (n) => n * ctr.resolve('multiplier'),
    }));
    const svc = c.resolve('service');
    assert.equal(svc.multiply(7), 70);
  });

  it('deeply chained dependencies resolve correctly', () => {
    const c = createContainer();
    c.bind('a', 1);
    c.factory('b', (ctr) => ctr.resolve('a') + 1);
    c.factory('c', (ctr) => ctr.resolve('b') + 1);
    assert.equal(c.resolve('c'), 3);
  });

  it('factory receives the same container instance', () => {
    const c = createContainer();
    let received;
    c.factory('self', (ctr) => { received = ctr; return null; });
    c.resolve('self');
    assert.strictEqual(received, c);
  });
});

// ---------------------------------------------------------------------------
// Child container — inherits parent bindings
// ---------------------------------------------------------------------------
describe('Container – createChild() inherits parent', () => {
  it('child resolves token bound in parent', () => {
    const parent = createContainer();
    parent.bind('shared', 42);
    const child = parent.createChild();
    assert.equal(child.resolve('shared'), 42);
  });

  it('child has() returns true for parent token', () => {
    const parent = createContainer();
    parent.bind('p', 1);
    const child = parent.createChild();
    assert.equal(child.has('p'), true);
  });

  it('child resolves parent singleton (same instance)', () => {
    const parent = createContainer();
    parent.singleton('db', () => ({ id: 1 }));
    const child = parent.createChild();
    assert.strictEqual(child.resolve('db'), parent.resolve('db'));
  });

  it('grandchild inherits from grandparent through two levels', () => {
    const gp = createContainer();
    gp.bind('base', 'root');
    const parent = gp.createChild();
    const child = parent.createChild();
    assert.equal(child.resolve('base'), 'root');
  });

  it('child factory can inject from parent-bound token', () => {
    const parent = createContainer();
    parent.bind('env', 'test');
    const child = parent.createChild();
    child.factory('label', (ctr) => `env:${ctr.resolve('env')}`);
    assert.equal(child.resolve('label'), 'env:test');
  });
});

// ---------------------------------------------------------------------------
// Child container — overrides do not affect parent
// ---------------------------------------------------------------------------
describe('Container – createChild() isolation', () => {
  it('child override does not affect parent resolution', () => {
    const parent = createContainer();
    parent.bind('val', 'parent-val');
    const child = parent.createChild();
    child.bind('val', 'child-val');
    assert.equal(parent.resolve('val'), 'parent-val');
    assert.equal(child.resolve('val'), 'child-val');
  });

  it('unbind in child does not affect parent', () => {
    const parent = createContainer();
    parent.bind('x', 99);
    const child = parent.createChild();
    child.unbind('x');
    assert.equal(parent.resolve('x'), 99);
    // child falls back to parent because local binding was removed
    assert.equal(child.resolve('x'), 99);
  });

  it('clear() on child does not remove parent bindings', () => {
    const parent = createContainer();
    parent.bind('p', 1);
    const child = parent.createChild();
    child.bind('c', 2);
    child.clear();
    assert.equal(parent.resolve('p'), 1);
    // 'c' was only in child, now gone entirely
    assert.throws(() => child.resolve('c'), /no binding/i);
    // child still sees parent's 'p'
    assert.equal(child.resolve('p'), 1);
  });

  it('sibling children are isolated from each other', () => {
    const parent = createContainer();
    const childA = parent.createChild();
    const childB = parent.createChild();
    childA.bind('who', 'A');
    childB.bind('who', 'B');
    assert.equal(childA.resolve('who'), 'A');
    assert.equal(childB.resolve('who'), 'B');
  });

  it('parent bind after child creation is visible in child', () => {
    const parent = createContainer();
    const child = parent.createChild();
    parent.bind('late', 'added-later');
    assert.equal(child.resolve('late'), 'added-later');
  });
});

// ---------------------------------------------------------------------------
// resolveAll()
// ---------------------------------------------------------------------------
describe('Container – resolveAll()', () => {
  it('returns values in the same order as tokens', () => {
    const c = createContainer();
    c.bind('a', 1);
    c.bind('b', 2);
    c.bind('c', 3);
    assert.deepEqual(c.resolveAll(['a', 'b', 'c']), [1, 2, 3]);
  });

  it('works with an empty array', () => {
    const c = createContainer();
    assert.deepEqual(c.resolveAll([]), []);
  });

  it('throws if any token is missing', () => {
    const c = createContainer();
    c.bind('a', 1);
    assert.throws(() => c.resolveAll(['a', 'missing']), /no binding/i);
  });

  it('resolves factory-based tokens', () => {
    const c = createContainer();
    c.factory('x', () => 10);
    c.factory('y', () => 20);
    const [x, y] = c.resolveAll(['x', 'y']);
    assert.equal(x, 10);
    assert.equal(y, 20);
  });

  it('transient factories are each called once per resolveAll invocation', () => {
    const c = createContainer();
    let n = 0;
    c.factory('n', () => ++n);
    const [first, second] = c.resolveAll(['n', 'n']);
    // each 'n' in the array triggers one factory call
    assert.equal(first, 1);
    assert.equal(second, 2);
  });
});

// ---------------------------------------------------------------------------
// createContainer() factory function
// ---------------------------------------------------------------------------
describe('createContainer()', () => {
  it('returns a Container instance', () => {
    const c = createContainer();
    assert.ok(c instanceof Container);
  });

  it('each call returns a distinct container', () => {
    const a = createContainer();
    const b = createContainer();
    assert.notStrictEqual(a, b);
  });

  it('returned container starts with no bindings', () => {
    const c = createContainer();
    assert.equal(c.has('anything'), false);
  });

  it('supports the full lifecycle: bind → resolve → unbind', () => {
    const c = createContainer();
    c.bind('k', 'v');
    assert.equal(c.resolve('k'), 'v');
    assert.equal(c.unbind('k'), true);
    assert.throws(() => c.resolve('k'), /no binding/i);
  });
});
