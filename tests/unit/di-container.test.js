// ─── Unit Tests: DIContainer ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIContainer,
  createContainer,
} from '../../app/modules/di-container.js';

// ─── register / resolve (singleton) ──────────────────────────────────────────

describe('DIContainer – register singleton', () => {
  it('resolve returns the value produced by the factory', () => {
    const c = new DIContainer();
    c.register('num', () => 42, true);
    assert.equal(c.resolve('num'), 42);
  });

  it('singleton returns the same instance on every resolve', () => {
    const c = new DIContainer();
    c.register('obj', () => ({ value: Math.random() }), true);
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.strictEqual(a, b);
  });

  it('factory receives the container as its argument', () => {
    const c = new DIContainer();
    c.register('a', () => 10, true);
    c.register('b', (container) => container.resolve('a') * 2, true);
    assert.equal(c.resolve('b'), 20);
  });

  it('factory is called exactly once for singletons', () => {
    const c = new DIContainer();
    let calls = 0;
    c.register('once', () => { calls++; return 'value'; }, true);
    c.resolve('once');
    c.resolve('once');
    c.resolve('once');
    assert.equal(calls, 1);
  });
});

// ─── register / resolve (transient) ──────────────────────────────────────────

describe('DIContainer – register transient', () => {
  it('transient returns a new instance on each resolve', () => {
    const c = new DIContainer();
    c.register('rand', () => ({ id: Math.random() }), false);
    const a = c.resolve('rand');
    const b = c.resolve('rand');
    assert.notStrictEqual(a, b);
  });

  it('default registration (no third arg) is transient', () => {
    const c = new DIContainer();
    c.register('t', () => ({ id: Math.random() }));
    const a = c.resolve('t');
    const b = c.resolve('t');
    assert.notStrictEqual(a, b);
  });

  it('transient factory is called on every resolve', () => {
    const c = new DIContainer();
    let calls = 0;
    c.register('calls', () => ++calls);
    assert.equal(c.resolve('calls'), 1);
    assert.equal(c.resolve('calls'), 2);
    assert.equal(c.resolve('calls'), 3);
  });
});

// ─── registerValue ────────────────────────────────────────────────────────────

describe('DIContainer – registerValue', () => {
  it('resolves to the exact value that was registered', () => {
    const c = new DIContainer();
    const obj = { x: 1 };
    c.registerValue('val', obj);
    assert.strictEqual(c.resolve('val'), obj);
  });

  it('registerValue returns the same reference on every resolve', () => {
    const c = new DIContainer();
    const arr = [1, 2, 3];
    c.registerValue('arr', arr);
    assert.strictEqual(c.resolve('arr'), c.resolve('arr'));
  });

  it('registerValue works with primitive values', () => {
    const c = new DIContainer();
    c.registerValue('pi', 3.14);
    assert.equal(c.resolve('pi'), 3.14);
  });

  it('registerValue works with null', () => {
    const c = new DIContainer();
    c.registerValue('nothing', null);
    assert.equal(c.resolve('nothing'), null);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('DIContainer – has', () => {
  it('returns true for a registered token', () => {
    const c = new DIContainer();
    c.register('present', () => 1);
    assert.equal(c.has('present'), true);
  });

  it('returns false for an unregistered token', () => {
    const c = new DIContainer();
    assert.equal(c.has('absent'), false);
  });

  it('returns true for a value registered with registerValue', () => {
    const c = new DIContainer();
    c.registerValue('v', 42);
    assert.equal(c.has('v'), true);
  });
});

// ─── resolve throws on unknown token ─────────────────────────────────────────

describe('DIContainer – resolve unknown token', () => {
  it('throws when a token is not registered', () => {
    const c = new DIContainer();
    assert.throws(() => c.resolve('ghost'), /no registration found/i);
  });

  it('error message includes the token name', () => {
    const c = new DIContainer();
    assert.throws(() => c.resolve('my-token'), /my-token/);
  });
});

// ─── unregister ──────────────────────────────────────────────────────────────

describe('DIContainer – unregister', () => {
  it('unregister removes the registration', () => {
    const c = new DIContainer();
    c.register('svc', () => 1);
    c.unregister('svc');
    assert.equal(c.has('svc'), false);
  });

  it('resolve throws after unregister', () => {
    const c = new DIContainer();
    c.register('svc', () => 1);
    c.unregister('svc');
    assert.throws(() => c.resolve('svc'), /no registration found/i);
  });

  it('unregister on unknown token is a no-op', () => {
    const c = new DIContainer();
    assert.doesNotThrow(() => c.unregister('nonexistent'));
  });

  it('unregister does not affect other tokens', () => {
    const c = new DIContainer();
    c.register('a', () => 1);
    c.register('b', () => 2);
    c.unregister('a');
    assert.equal(c.has('b'), true);
    assert.equal(c.resolve('b'), 2);
  });
});

// ─── child container ─────────────────────────────────────────────────────────

describe('DIContainer – child', () => {
  it('child() returns a new DIContainer instance', () => {
    const c = new DIContainer();
    const kid = c.child();
    assert.ok(kid instanceof DIContainer);
    assert.notStrictEqual(kid, c);
  });

  it('child resolves tokens registered in the parent', () => {
    const parent = new DIContainer();
    parent.register('shared', () => 'from-parent', true);
    const child = parent.child();
    assert.equal(child.resolve('shared'), 'from-parent');
  });

  it('child registration shadows the parent', () => {
    const parent = new DIContainer();
    parent.register('svc', () => 'parent-value', true);
    const child = parent.child();
    child.register('svc', () => 'child-value', true);
    assert.equal(child.resolve('svc'), 'child-value');
    assert.equal(parent.resolve('svc'), 'parent-value');
  });

  it('has returns true when token is registered in an ancestor', () => {
    const parent = new DIContainer();
    parent.register('ancestor', () => 1);
    const child = parent.child();
    assert.equal(child.has('ancestor'), true);
  });

  it('has returns false for token not in child or parent', () => {
    const parent = new DIContainer();
    const child = parent.child();
    assert.equal(child.has('ghost'), false);
  });

  it('registrations added to child do not affect parent', () => {
    const parent = new DIContainer();
    const child = parent.child();
    child.register('kidOnly', () => 42);
    assert.equal(parent.has('kidOnly'), false);
  });

  it('multi-level ancestry: grandchild resolves grandparent token', () => {
    const gp = new DIContainer();
    gp.register('gp-token', () => 'gp-value', true);
    const parent = gp.child();
    const child = parent.child();
    assert.equal(child.resolve('gp-token'), 'gp-value');
  });

  it('unregister in child does not affect parent', () => {
    const parent = new DIContainer();
    parent.register('shared', () => 'value', true);
    const child = parent.child();
    child.unregister('shared');
    // child falls back to parent after local unregister
    assert.equal(child.resolve('shared'), 'value');
    assert.equal(parent.has('shared'), true);
  });
});

// ─── createContainer factory ──────────────────────────────────────────────────

describe('createContainer', () => {
  it('returns a DIContainer instance', () => {
    const c = createContainer();
    assert.ok(c instanceof DIContainer);
  });

  it('returned container is initially empty', () => {
    const c = createContainer();
    assert.equal(c.has('anything'), false);
  });

  it('two calls produce independent containers', () => {
    const c1 = createContainer();
    const c2 = createContainer();
    c1.register('svc', () => 'c1');
    assert.equal(c2.has('svc'), false);
  });

  it('child() on created container works correctly', () => {
    const c = createContainer();
    c.register('svc', () => 'hello', true);
    const kid = c.child();
    assert.equal(kid.resolve('svc'), 'hello');
  });
});
