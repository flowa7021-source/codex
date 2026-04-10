// ─── Unit Tests: DIContainer ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createToken,
  DIContainer,
  createContainer,
} from '../../app/modules/di-container.js';

// ─── createToken ──────────────────────────────────────────────────────────────

describe('createToken', () => {
  it('returns an object with a symbol id', () => {
    const token = createToken('myService');
    assert.equal(typeof token.id, 'symbol');
  });

  it('each call produces a unique token even for the same string', () => {
    const t1 = createToken('svc');
    const t2 = createToken('svc');
    assert.notEqual(t1.id, t2.id);
  });

  it('symbol description matches the provided id string', () => {
    const token = createToken('logger');
    assert.equal(token.id.description, 'logger');
  });
});

// ─── register / resolve (singleton) ──────────────────────────────────────────

describe('DIContainer – singleton scope', () => {
  it('resolve returns the value produced by the factory', () => {
    const c = new DIContainer();
    const token = createToken('num');
    c.register(token, () => 42);
    assert.equal(c.resolve(token), 42);
  });

  it('singleton scope returns the same instance on every resolve', () => {
    const c = new DIContainer();
    const token = createToken('obj');
    c.register(token, () => ({ value: Math.random() }), 'singleton');
    const a = c.resolve(token);
    const b = c.resolve(token);
    assert.strictEqual(a, b);
  });

  it('default scope is singleton', () => {
    const c = new DIContainer();
    const token = createToken('def');
    c.register(token, () => ({ id: Math.random() }));
    assert.strictEqual(c.resolve(token), c.resolve(token));
  });

  it('factory receives the container as its argument', () => {
    const c = new DIContainer();
    const tokenA = createToken('a');
    const tokenB = createToken('b');
    c.register(tokenA, () => 10);
    c.register(tokenB, (container) => container.resolve(tokenA) * 2);
    assert.equal(c.resolve(tokenB), 20);
  });
});

// ─── register / resolve (transient) ──────────────────────────────────────────

describe('DIContainer – transient scope', () => {
  it('transient scope returns a new instance on each resolve', () => {
    const c = new DIContainer();
    const token = createToken('transient');
    c.register(token, () => ({ id: Math.random() }), 'transient');
    const a = c.resolve(token);
    const b = c.resolve(token);
    assert.notStrictEqual(a, b);
  });
});

// ─── registerValue ────────────────────────────────────────────────────────────

describe('DIContainer – registerValue', () => {
  it('resolves to the exact value that was registered', () => {
    const c = new DIContainer();
    const token = createToken('val');
    const obj = { x: 1 };
    c.registerValue(token, obj);
    assert.strictEqual(c.resolve(token), obj);
  });

  it('registerValue returns the same reference on every resolve', () => {
    const c = new DIContainer();
    const token = createToken('val2');
    const arr = [1, 2, 3];
    c.registerValue(token, arr);
    assert.strictEqual(c.resolve(token), arr);
    assert.strictEqual(c.resolve(token), arr);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('DIContainer – has', () => {
  it('returns true for a registered token', () => {
    const c = new DIContainer();
    const token = createToken('present');
    c.register(token, () => 1);
    assert.equal(c.has(token), true);
  });

  it('returns false for an unregistered token', () => {
    const c = new DIContainer();
    const token = createToken('absent');
    assert.equal(c.has(token), false);
  });
});

// ─── error on unknown token ───────────────────────────────────────────────────

describe('DIContainer – resolve unknown token', () => {
  it('throws when a token is not registered', () => {
    const c = new DIContainer();
    const token = createToken('ghost');
    assert.throws(() => c.resolve(token), /no registration found/i);
  });
});

// ─── parent / child containers ────────────────────────────────────────────────

describe('DIContainer – parent lookup', () => {
  it('child resolves tokens registered in the parent', () => {
    const parent = new DIContainer();
    const token = createToken('shared');
    parent.register(token, () => 'from-parent');
    const child = new DIContainer(parent);
    assert.equal(child.resolve(token), 'from-parent');
  });

  it('child registration shadows the parent', () => {
    const parent = new DIContainer();
    const token = createToken('shadow');
    parent.register(token, () => 'parent-value');
    const child = new DIContainer(parent);
    child.register(token, () => 'child-value');
    assert.equal(child.resolve(token), 'child-value');
    assert.equal(parent.resolve(token), 'parent-value');
  });

  it('has returns true when token is registered in an ancestor', () => {
    const parent = new DIContainer();
    const token = createToken('ancestor');
    parent.register(token, () => 1);
    const child = new DIContainer(parent);
    assert.equal(child.has(token), true);
  });
});

// ─── createScope ─────────────────────────────────────────────────────────────

describe('DIContainer – createScope / scoped lifetime', () => {
  it('createScope returns a new child DIContainer', () => {
    const c = new DIContainer();
    const scope = c.createScope();
    assert.ok(scope instanceof DIContainer);
    assert.notStrictEqual(scope, c);
  });

  it('scoped singleton is cached per scope, not shared across scopes', () => {
    const c = new DIContainer();
    const token = createToken('scoped');
    c.register(token, () => ({ id: Math.random() }), 'scoped');

    const scopeA = c.createScope();
    const scopeB = c.createScope();

    // Within the same scope the instance is stable.
    assert.strictEqual(scopeA.resolve(token), scopeA.resolve(token));
    // Across scopes the instances differ.
    assert.notStrictEqual(scopeA.resolve(token), scopeB.resolve(token));
  });
});

// ─── createContainer factory ──────────────────────────────────────────────────

describe('createContainer', () => {
  it('returns a DIContainer instance', () => {
    const c = createContainer();
    assert.ok(c instanceof DIContainer);
  });

  it('accepts a parent container', () => {
    const parent = createContainer();
    const token = createToken('p');
    parent.register(token, () => 99);
    const child = createContainer(parent);
    assert.equal(child.resolve(token), 99);
  });
});
